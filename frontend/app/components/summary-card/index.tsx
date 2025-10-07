import { Text, Group, RingProgress, Paper, Center } from '@mantine/core';
import { IconLink } from '@tabler/icons-react';

interface StatCardProps {
  label: string;
  value: string | number;
}

export function SummaryCard({ label, value }: StatCardProps) {
  return (
    <Paper withBorder radius="md" p="xs">
      <Group>
        <RingProgress
          size={80}
          roundCaps
          thickness={8}
          sections={[{ value: 100, color: 'green' }]}
          label={
            <Center>
              <IconLink size={20} stroke={1.5} />
            </Center>
          }
        />

        <div>
          <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
            {label}
          </Text>
          <Text fw={700} size="xl">
            {value}
          </Text>
        </div>
      </Group>
    </Paper>
  );
}
