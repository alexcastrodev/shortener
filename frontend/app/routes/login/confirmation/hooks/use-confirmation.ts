import { useLoginVerifyRequest } from '@internal/core/actions/login-verify/login-verify.hook';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useLocation, useNavigate } from 'react-router';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useUserState } from '@internal/core/states/use-user-state';
import { useEffect } from 'react';
import { z } from 'zod/v4';

export function useConfirmation() {
  const router = useNavigate()
  const { setup } = useUserState()
  const location = useLocation()
  const email = location.state?.email
  const schema = z.object({
    code: z.string().min(7, 'Code must be at least 7 characters long').max(7, 'Code must be at most 7 characters long'),
  })

  useEffect(() => {
    if (!email) {
      router('/login', { replace: true })
    }
  }, [email])

  const { mutate, isPending} = useLoginVerifyRequest({
    onSuccess: ({ jwt, user }) => {
      setup(jwt, user)
      router('/')
    },
    onError: () => {
      form.setFieldValue('code', '')
      notifications.show({
          title: 'Error',
          message: 'Pin code is invalid, please try again.',
          color: 'red',
      })
    },
  })
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      code: '',
    },

    validate: zod4Resolver(schema),
  });

  function handleRequestLogin(data: typeof form.values) {
    mutate({ code: data.code, email })
  }

  function handleChange(value: string) {
    form.getInputProps('code').onChange(value)

    if (value.length === 7) {
      mutate({ code: value, email })
    }
  }

  return { form, handleRequestLogin, email, handleChange, loading: isPending }
}