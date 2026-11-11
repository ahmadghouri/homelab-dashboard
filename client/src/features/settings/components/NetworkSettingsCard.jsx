import { LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useUpdateSettings } from '../hooks/useSettings';

export function NetworkSettingsCard({ settings }) {
  const [scanInterval, setScanInterval] = useState(String(settings.network.scanIntervalMin));
  const update = useUpdateSettings();
  const error = update.error?.details?.network ?? (update.isError ? [update.error.message] : null);
  const isDirty = Number(scanInterval) !== settings.network.scanIntervalMin;

  const handleSave = (event) => {
    event.preventDefault();
    update.mutate(
      { network: { scanIntervalMin: Number(scanInterval) } },
      { onSuccess: () => toast.success('Scan interval saved') },
    );
  };

  return (
    <Card>
      <form onSubmit={handleSave} noValidate>
        <CardHeader>
          <CardTitle>Network scan</CardTitle>
          <CardDescription>How often the server looks for devices on the network.</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="scan-interval">Scan every (minutes)</FieldLabel>
            <Input
              id="scan-interval"
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={scanInterval}
              onChange={(event) => setScanInterval(event.target.value)}
              className="max-w-32"
            />
            <FieldDescription>Between 1 and 60. A scan takes a few seconds.</FieldDescription>
            <FieldError errors={error?.map((message) => ({ message }))} />
          </Field>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
