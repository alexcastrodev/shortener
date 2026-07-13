import { useLoginRequest } from '@internal/core/actions/login-request/login-request.hook';
import { useForm } from '@mantine/form';
import { notifyError } from '@internal/core/utils/notify';
import { useNavigate } from 'react-router';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';

const schema = z.object({
  email: z.email(),
});

export function useLogin() {
  const router = useNavigate();
  const { mutate, isPending } = useLoginRequest({
    onSuccess: () => {
      router('/login-confirmation', { state: { email: form.values.email } });
    },
    onError: () => {
      notifyError('Something went wrong, please try again later.');
    },
  });

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      email: '',
    },

    validate: zod4Resolver(schema),
  });

  function handleRequestLogin(data: typeof form.values) {
    mutate(data);
  }

  return { form, handleRequestLogin, loading: isPending };
}
