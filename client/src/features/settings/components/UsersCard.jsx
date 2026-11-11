import { HardDriveIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { ErrorState } from '@/components/common/ErrorState';
import { FormDialog } from '@/components/common/FormDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DriveAccessDialog } from '@/features/drive/components/access/DriveAccessDialog';
import { formatRelativeTime } from '@/lib/format';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '../hooks/useSettings';

const ROLE_HELP = {
  admin: 'Can change everything',
  viewer: 'Can only look',
};

function toFieldErrors(messages) {
  return messages?.map((message) => ({ message }));
}

function RoleSelect({ id, value, onChange, disabled }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-32" aria-label="Role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="viewer">Viewer</SelectItem>
      </SelectContent>
    </Select>
  );
}

function AddUserDialog({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' });
  const createUser = useCreateUser();
  const details = createUser.error?.details ?? {};
  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Add user"
      description="They sign in with this email and password, and can change the password later."
      submitLabel="Add user"
      isPending={createUser.isPending}
      error={createUser.isError && !Object.keys(details).length ? createUser.error.message : null}
      onSubmit={() =>
        createUser.mutate(form, {
          onSuccess: (user) => {
            onClose();
            toast.success(`${user.name} added`);
          },
        })
      }
    >
      <Field data-invalid={Boolean(details.name)}>
        <FieldLabel htmlFor="user-name">Name</FieldLabel>
        <Input id="user-name" value={form.name} onChange={setField('name')} autoFocus maxLength={80} />
        <FieldError errors={toFieldErrors(details.name)} />
      </Field>
      <Field data-invalid={Boolean(details.email)}>
        <FieldLabel htmlFor="user-email">Email</FieldLabel>
        <Input id="user-email" type="email" value={form.email} onChange={setField('email')} />
        <FieldError errors={toFieldErrors(details.email)} />
      </Field>
      <Field data-invalid={Boolean(details.password)}>
        <FieldLabel htmlFor="user-password">Password</FieldLabel>
        <Input
          id="user-password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={setField('password')}
        />
        <FieldDescription>At least 8 characters.</FieldDescription>
        <FieldError errors={toFieldErrors(details.password)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="user-role">Role</FieldLabel>
        <RoleSelect
          id="user-role"
          value={form.role}
          onChange={(role) => setForm((current) => ({ ...current, role }))}
        />
        <FieldDescription>{ROLE_HELP[form.role]}</FieldDescription>
      </Field>
    </FormDialog>
  );
}

function UserRoleCell({ user, isSelf }) {
  const updateUser = useUpdateUser();
  return (
    <RoleSelect
      value={user.role}
      disabled={isSelf || updateUser.isPending}
      onChange={(role) =>
        updateUser.mutate(
          { id: user.id, role },
          {
            onSuccess: () => toast.success(`${user.name} is now ${role === 'admin' ? 'an admin' : 'a viewer'}`),
            onError: (error) => toast.error(error.message),
          },
        )
      }
    />
  );
}

function buildColumns(currentUserId, { onDelete, onDriveAccess }) {
  return [
    {
      accessorKey: 'name',
      header: 'User',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.name}
            {row.original.id === currentUserId && (
              <Badge variant="secondary" className="ml-2">
                You
              </Badge>
            )}
          </span>
          <span className="text-xs text-muted-foreground">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => <UserRoleCell user={row.original} isSelf={row.original.id === currentUserId} />,
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Last sign in',
      cell: ({ getValue }) => formatRelativeTime(getValue()),
      meta: { className: 'hidden sm:table-cell' },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {row.original.role !== 'admin' && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDriveAccess(row.original)}
              aria-label={`Drive access for ${row.original.name}`}
              title="Drive access"
            >
              <HardDriveIcon aria-hidden="true" />
            </Button>
          )}
          {row.original.id !== currentUserId && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(row.original)}
              aria-label={`Delete ${row.original.name}`}
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
      meta: { className: 'w-20 text-right' },
    },
  ];
}

export function UsersCard({ currentUserId }) {
  const { data: users, isPending, isError, error, refetch, isRefetching } = useUsers();
  const deleteUser = useDeleteUser();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [driveUser, setDriveUser] = useState(null);

  let content;
  if (isPending) {
    content = <Skeleton className="h-32 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else {
    content = (
      <DataTable
        columns={buildColumns(currentUserId, { onDelete: setDeleting, onDriveAccess: setDriveUser })}
        data={users}
        getRowId={(user) => user.id}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Admins can change everything. Viewers can only look, and use the Drive only as allowed here.</CardDescription>
        <CardAction>
          <Button onClick={() => setAdding(true)}>
            <PlusIcon aria-hidden="true" />
            Add user
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>{content}</CardContent>

      {adding && <AddUserDialog onClose={() => setAdding(false)} />}
      {driveUser && (
        <DriveAccessDialog
          open
          onOpenChange={(open) => !open && setDriveUser(null)}
          userId={driveUser.id}
          userName={driveUser.name}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="They can no longer sign in. This cannot be undone."
        confirmLabel="Delete user"
        destructive
        isPending={deleteUser.isPending}
        onConfirm={() =>
          deleteUser.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(`${deleting.name} deleted`);
              setDeleting(null);
            },
            onError: (deleteError) => toast.error(deleteError.message),
          })
        }
      />
    </Card>
  );
}
