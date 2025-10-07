import { Card, Text, Stack, Group, TextInput, Button } from '@mantine/core';
import styles from './quick-create.module.css';

export function QuickCreate() {
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

        <div>
          <Text size="sm" style={{ marginBottom: 8 }}>
            Enter your destination URL
          </Text>
          <Group className={styles.inputRow}>
            <TextInput
              placeholder="https://example.com/my-long-url"
              className={styles.input}
            />
            <Button className={styles.button} color="blue">
              Create your Shortener link
            </Button>
          </Group>
        </div>
      </Stack>
    </Card>
  );
}

export default QuickCreate;
