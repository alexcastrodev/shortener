import { useLoginVerifyRequest } from '@internal/core/actions/login-verify/login-verify.hook';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useLocation, useNavigate } from 'react-router';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useUserState } from '@internal/core/states/use-user-state';
import { useEffect, useRef } from 'react';
import { z } from 'zod/v4';
import type { ResponseError } from '@internal/core/types/ResponseError';

export function useConfirmation() {
  const router = useNavigate();
  const { setup } = useUserState();
  const location = useLocation();
  const email = location.state?.email;
  const autoSubmitted = useRef(false);

  const schema = z.object({
    code: z
      .string()
      .min(7, 'Code must be at least 7 characters long')
      .max(7, 'Code must be at most 7 characters long'),
  });

  useEffect(() => {
    if (!email) {
      router('/login', { replace: true });
    }
  }, [email, router]);

  const { mutate, isPending } = useLoginVerifyRequest({
    onSuccess: ({ token, user }) => {
      setup(token, user);
      router('/app');
    },
    onError: (error: ResponseError & { response?: { status?: number } }) => {
      form.setFieldValue('code', '');
      autoSubmitted.current = false;

      const status = error?.response?.status;
      if (status === 403) {
        notifications.show({
          title: 'Account deactivated',
          message:
            'Your account has been deactivated. Contact support if you believe this is a mistake.',
          color: 'red',
          autoClose: false,
        });
        return;
      }

      notifications.show({
        title: 'Error',
        message: 'Pin code is invalid, please try again.',
        color: 'red',
      });
    },
  });

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      code: '',
    },
    validate: zod4Resolver(schema),
  });

  function handleRequestLogin(data: typeof form.values) {
    if (autoSubmitted.current) return;
    mutate({ code: data.code, email });
  }

  function handleChange(value: string) {
    form.getInputProps('code').onChange(value);

    if (value.length === 7 && !isPending) {
      autoSubmitted.current = true;
      mutate({ code: value, email });
    }
  }

  return { form, handleRequestLogin, email, handleChange, loading: isPending };
}
