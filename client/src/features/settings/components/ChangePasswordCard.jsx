import { LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useChangePassword } from '../hooks/useSettings';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };
const MIN_LENGTH = 8;

function toFieldErrors(messages) {
  return messages?.map((message) => ({ message }));
}

export function ChangePasswordCard() {
  const [form, setForm] = useState(EMPTY);
  const [mismatch, setMismatch] = useState(false);
  const changePassword = useChangePassword();
  const details = changePassword.error?.details ?? {};

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    changePassword.mutate(form, {
      onSuccess: () => {
        setForm(EMPTY);
        toast.success('Password changed. Other sessions are signed out.');
      },
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Other browsers signed in to your account are signed out.</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <FieldGroup className="max-w-sm">
            <Field data-invalid={Boolean(details.currentPassword)}>
              <FieldLabel htmlFor="current-password">Current password</FieldLabel>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={setField('currentPassword')}
              />
              <FieldError errors={toFieldErrors(details.currentPassword)} />
            </Field>
            <Field data-invalid={Boolean(details.newPassword)}>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                value={form.newPassword}
                onChange={setField('newPassword')}
              />
              <FieldError errors={toFieldErrors(details.newPassword)} />
            </Field>
            <Field data-invalid={mismatch}>
              <FieldLabel htmlFor="confirm-password">Repeat new password</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
              />
              <FieldError errors={mismatch ? [{ message: 'Passwords do not match' }] : undefined} />
            </Field>
            {changePassword.isError && !Object.keys(details).length && (
              <p role="alert" className="text-sm text-danger">
                {changePassword.error.message}
              </p>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            disabled={changePassword.isPending || !form.currentPassword || !form.newPassword}
          >
            {changePassword.isPending && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
