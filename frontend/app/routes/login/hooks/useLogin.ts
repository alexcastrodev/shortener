import { useLoginRequest } from '@internal/core/actions/login-request/login-request.hook';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';

const schema = z.object({
  email: z.email(),
})

export function useLogin() {
  const router = useNavigate()
  const { mutate } = useLoginRequest({
    onSuccess: () => {
      router('/login-confirmation', { state: { email: form.values.email }})
    },
    onError: () => {
      notifications.show({
          title: 'Error',
          message: 'Something went wrong, please try again later.',
          color: 'red',
      })

    },
  })

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      email: '',
    },

    validate: zod4Resolver(schema)
  });

  function handleRequestLogin(data: typeof form.values) {
    mutate(data)
  }

return { form, handleRequestLogin }
}