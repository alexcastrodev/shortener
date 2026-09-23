import { PasswordInput, Progress } from '@mantine/core';
import { useState } from 'react';

export const MIN_PASSWORD_LENGTH = 8;

// A new password typed twice. The form's button stays enabled: `check()` on
// submit says whether it can go ahead and, if not, marks the fields with what
// is missing (a disabled button that does not say why is a dead end).
export function useNewPassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [attempted, setAttempted] = useState(false);

  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  const mismatch =
    (confirmation.length > 0 &&
      confirmation !== password.slice(0, confirmation.length)) ||
    (attempted && confirmation !== password);

  return {
    password,
    valid: !tooShort && password === confirmation,
    // Call on submit: true when the form can be sent.
    check: () => {
      setAttempted(true);
      return !tooShort && password === confirmation;
    },
    reset: () => {
      setPassword('');
      setConfirmation('');
      setAttempted(false);
    },
    fields: {
      password,
      setPassword,
      confirmation,
      setConfirmation,
      tooShort,
      mismatch,
      attempted,
    },
  };
}

// Length first (NIST 800-63B), with a nudge for mixing kinds of characters.
function strength(password: string) {
  const length = password.length;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(pattern =>
    pattern.test(password)
  ).length;

  if (length < MIN_PASSWORD_LENGTH) {
    return {
      value: Math.max(6, (length / MIN_PASSWORD_LENGTH) * 40),
      color: 'red',
      label: 'Too short',
    };
  }
  if (length >= 16 || (length >= 12 && kinds >= 3)) {
    return { value: 100, color: 'green', label: 'Strong' };
  }
  // Accepted, but short passwords are the easiest to guess.
  return {
    value: Math.min(85, 50 + (length - MIN_PASSWORD_LENGTH) * 5),
    color: 'yellow',
    label: 'Okay',
  };
}

function StrengthBar({ password }: { password: string }) {
  const { value, color, label } = strength(password);

  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <Progress
        value={password ? value : 0}
        color={color}
        size="sm"
        radius="xl"
        className="flex-1"
        transitionDuration={200}
        aria-label="Password strength"
      />
      <span
        className="w-16 text-right text-xs font-medium"
        style={{
          color: password ? `var(--mantine-color-${color}-text)` : undefined,
        }}
      >
        {password ? label : ''}
      </span>
    </div>
  );
}

export function NewPasswordFields({
  label = 'Password',
  size,
  fields,
}: {
  label?: string;
  size?: 'sm' | 'md';
  fields: ReturnType<typeof useNewPassword>['fields'];
}) {
  const {
    password,
    setPassword,
    confirmation,
    setConfirmation,
    tooShort,
    mismatch,
    attempted,
  } = fields;
  const count = password.length;

  return (
    <>
      <PasswordInput
        label={label}
        size={size}
        autoComplete="new-password"
        description={`At least ${MIN_PASSWORD_LENGTH} characters. A few words work well.`}
        error={
          attempted && tooShort
            ? `Use at least ${MIN_PASSWORD_LENGTH} characters (${count} so far).`
            : undefined
        }
        value={password}
        onChange={event => setPassword(event.currentTarget.value)}
        inputContainer={children => (
          <>
            {children}
            <StrengthBar password={password} />
          </>
        )}
        required
      />
      <PasswordInput
        label={`Confirm ${label.toLowerCase()}`}
        size={size}
        autoComplete="new-password"
        value={confirmation}
        error={mismatch ? "Passwords don't match" : undefined}
        onChange={event => setConfirmation(event.currentTarget.value)}
        required
      />
    </>
  );
}
