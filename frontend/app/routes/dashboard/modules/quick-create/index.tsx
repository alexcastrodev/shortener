import { Card, Text, Stack, Group, TextInput, Button } from '@mantine/core';
import styles from './quick-create.module.css';
import { useQuickCreate } from './use-quick-create';

export function QuickCreate() {
  const { form, handleSubmit, loading } = useQuickCreate();

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      className={styles.root}
    >
      <Stack gap="sm">
        <Group className={styles.headerRow}>
          <Text className={styles.title}>Quick create</Text>
        </Group>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <div>
              <Text size="sm" style={{ marginBottom: 8 }}>
                Title (optional)
              </Text>
              <TextInput
                placeholder="My Link Title"
                key={form.key('title')}
                {...form.getInputProps('title')}
              />
            </div>

            <div>
              <Text size="sm" style={{ marginBottom: 8 }}>
                Enter your destination URL
              </Text>
              <TextInput
                placeholder="https://example.com/my-long-url"
                className={styles.input}
                key={form.key('original_url')}
                {...form.getInputProps('original_url')}
              />
            </div>

            <Button
              className={styles.button}
              type="submit"
              color="blue"
              fullWidth
              loading={loading}
            >
              Create your Shortener link
            </Button>
          </Stack>
        </form>
      </Stack>
    </Card>
  );
}

export default QuickCreate;
