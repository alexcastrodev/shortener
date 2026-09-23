import { useLoginRequest } from '@internal/core/actions/login-request/login-request.hook';
import { useForm } from '@mantine/form';
import { notifyError } from '@internal/core/utils/notify';
import { useNavigate } from 'react-router';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';
import { useRef, useState } from 'react';
import type { ResponseError } from '@internal/core/types/ResponseError';
import {
  TURNSTILE_SITE_KEY,
  type TurnstileHandle,
} from '../../../modules/auth/turnstile';

const schema = z.object({
  email: z.email(),
});

type LoginError = ResponseError & {
  response?: { status?: number; data?: { error?: string } };
};

// What the API's error codes mean for the person signing in.
function explain(error: LoginError): [message: string, title?: string] {
  const status = error?.response?.status;
  const code = error?.response?.data?.error;

  if (status === 429) {
    return [
      'Too many sign-in requests. Please wait a few minutes and try again.',
      'Slow down',
    ];
  }
  if (code === 'captcha_failed') {
    return [
      'We could not confirm you are human. Please try again.',
      'Check failed',
    ];
  }
  if (code === 'invalid_email') {
    return ['That does not look like a valid email address.'];
  }
  if (code === 'undeliverable_email') {
    return [
      'We cannot send email to that address. Temporary and disposable addresses are not accepted.',
      'Use another email',
    ];
  }
  if (code === 'new_address_limit') {
    return [
      'New sign-ups are paused for today. If you already have an account, you can still sign in.',
      'Try again tomorrow',
    ];
  }
  if (code === 'daily_limit' || code === 'monthly_limit') {
    return [
      'Kurz has sent all the emails it can for now. Please try again later.',
      'Email limit reached',
    ];
  }
  return ['Something went wrong, please try again later.'];
}

export function useLogin() {
  const router = useNavigate();
  const turnstile = useRef<TurnstileHandle>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const { mutate, isPending } = useLoginRequest({
    onSuccess: () => {
      router('/login-confirmation', { state: { email: form.values.email } });
    },
    onError: (error: LoginError) => {
      const [message, title] = explain(error);
      notifyError(message, title);
    },
    // The token was spent on this request, whatever the outcome.
    onSettled: () => turnstile.current?.reset(),
  });

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      email: '',
    },

    validate: zod4Resolver(schema),
  });

  function handleRequestLogin(data: typeof form.values) {
    mutate({ ...data, turnstile_token: turnstileToken ?? undefined });
  }

  // Wait for Turnstile's (usually invisible, sub-second) check first.
  const waitingForCheck = !!TURNSTILE_SITE_KEY && !turnstileToken;

  return {
    form,
    handleRequestLogin,
    loading: isPending,
    turnstile,
    setTurnstileToken,
    waitingForCheck,
  };
}
