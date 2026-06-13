import {
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light');
  const isDark = computed === 'dark';
  const Icon = isDark ? IconSun : IconMoon;

  return (
    <Tooltip label={isDark ? 'Light' : 'Dark'}>
      <ActionIcon
        aria-label="Toggle theme"
        variant="subtle"
        color="gray"
        size="lg"
        onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
      >
        <Icon size={18} stroke={1.8} />
      </ActionIcon>
    </Tooltip>
  );
}
