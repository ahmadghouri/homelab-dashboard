import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { FormDialog } from '@/components/common/FormDialog';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAddDevice } from '../hooks/useDeviceMutations';
import { AgentTokenDialog } from './AgentTokenDialog';

export function AddDeviceButton() {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [created, setCreated] = useState(null);
  const addDevice = useAddDevice();

  const nameError = addDevice.error?.details?.name;
  const generalError = addDevice.isError && !nameError ? addDevice.error.message : null;

  const handleOpenChange = (open) => {
    setFormOpen(open);
    if (!open) {
      setName('');
      addDevice.reset();
    }
  };

  const handleSubmit = () => {
    addDevice.mutate(
      { name },
      {
        onSuccess: ({ device, token }) => {
          handleOpenChange(false);
          setCreated({ name: device.name, token });
        },
      },
    );
  };

  return (
    <>
      <Button onClick={() => setFormOpen(true)}>
        <PlusIcon aria-hidden="true" />
        Add device
      </Button>

      <FormDialog
        open={formOpen}
        onOpenChange={handleOpenChange}
        title="Add device"
        description="Give the PC a name. You get a token to connect its agent."
        submitLabel="Add device"
        isPending={addDevice.isPending}
        error={generalError}
        onSubmit={handleSubmit}
      >
        <Field data-invalid={Boolean(nameError)}>
          <FieldLabel htmlFor="device-name">Name</FieldLabel>
          <Input
            id="device-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Living room PC"
            maxLength={60}
            autoFocus
            aria-invalid={Boolean(nameError)}
          />
          <FieldDescription>Only shown in the dashboard.</FieldDescription>
          <FieldError errors={nameError?.map((message) => ({ message }))} />
        </Field>
      </FormDialog>

      {created && (
        <AgentTokenDialog
          open
          onOpenChange={(open) => !open && setCreated(null)}
          deviceName={created.name}
          token={created.token}
        />
      )}
    </>
  );
}
