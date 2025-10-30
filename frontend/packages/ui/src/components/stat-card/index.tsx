import { Card, Text, Group, Stack } from '@mantine/core';
import { Sparkline } from '@mantine/charts';

interface StatCardProps {
  label: string;
  value: string | number;
  data: number[];
}

export function StatCard({ label, value, data = [] }: StatCardProps) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Text size="sm" c="dimmed" fw={500}>
            {label}
          </Text>
        </Group>

        <Text size="xl" fw={700}>
          {value}
        </Text>

        <Sparkline
          h={60}
          data={data}
          curveType="linear"
          color="blue"
          fillOpacity={0.6}
          strokeWidth={2}
        />
      </Stack>
    </Card>
  );
}
