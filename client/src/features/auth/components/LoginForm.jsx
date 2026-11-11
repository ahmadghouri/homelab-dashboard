import { LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useLogin } from '../hooks/useLogin';

function toFieldErrors(messages) {
  return messages?.map((message) => ({ message }));
}

export function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();

  const fieldErrors = loginMutation.error?.details ?? {};
  // Field-level problems show under each input; everything else shows as one message.
  const formError = loginMutation.isError && !loginMutation.error.details;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (loginMutation.isPending) {
      return;
    }
    loginMutation.mutate({ email, password }, { onSuccess });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(fieldErrors.email)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          <FieldError errors={toFieldErrors(fieldErrors.email)} />
        </Field>

        <Field data-invalid={Boolean(fieldErrors.password)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          <FieldError errors={toFieldErrors(fieldErrors.password)} />
        </Field>

        {formError && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {loginMutation.error.message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
          {loginMutation.isPending ? 'Signing in' : 'Sign in'}
        </Button>
      </FieldGroup>
    </form>
  );
}
