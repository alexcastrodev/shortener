import { createTheme, type MantineThemeOverride } from '@mantine/core';

/**
 * Custom Mantine Theme
 * Centralizes theme configuration with violet primary color
 */
export const mantineTheme: MantineThemeOverride = createTheme({
  primaryColor: 'violet',

  colors: {
    violet: [
      '#f5f3ff',
      '#ede9fe',
      '#ddd6fe',
      '#c4b5fd',
      '#a78bfa',
      '#8b5cf6',
      '#7c3aed', // Main violet
      '#6d28d9',
      '#5b21b6',
      '#4c1d95',
    ],
  },

  defaultRadius: 'md',

  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: (_: any, props: { variant: string; color: string }) => ({
        root: {
          // Violet primary button
          ...(props.variant === 'filled' &&
            props.color === 'violet' && {
              backgroundColor: '#7c3aed',
              '&:hover': {
                backgroundColor: '#6d28d9',
              },
            }),
          // Outline dark theme
          ...(props.variant === 'outline' && {
            borderColor: '#3f3f46',
            color: '#a1a1aa',
            '&:hover': {
              backgroundColor: 'rgba(63, 63, 70, 0.5)',
              color: '#ffffff',
              borderColor: '#3f3f46',
            },
          }),
          // Subtle navigation button
          ...(props.variant === 'subtle' && {
            color: '#a1a1aa',
            '&:hover': {
              backgroundColor: 'rgba(63, 63, 70, 0.5)',
              color: '#ffffff',
            },
          }),
        },
      }),
    },

    TextInput: {
      styles: {
        input: {
          backgroundColor: 'rgba(24, 24, 27, 0.5)',
          borderColor: '#3f3f46',
          color: '#ffffff',
          '&::placeholder': {
            color: '#71717a',
          },
          '&:focus': {
            borderColor: '#7c3aed',
          },
        },
      },
    },

    Menu: {
      styles: {
        dropdown: {
          backgroundColor: '#27272a',
          borderColor: '#3f3f46',
        },
        item: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: 'rgba(63, 63, 70, 0.5)',
          },
        },
      },
    },

    ActionIcon: {
      styles: (_: any, props: { variant: string }) => ({
        root: {
          ...(props.variant === 'subtle' && {
            color: '#a1a1aa',
            '&:hover': {
              backgroundColor: 'rgba(63, 63, 70, 0.5)',
            },
          }),
          ...(props.variant === 'light' && {
            backgroundColor: 'rgba(124, 58, 237, 0.2)',
            color: '#a78bfa',
            '&:hover': {
              backgroundColor: 'rgba(124, 58, 237, 0.3)',
            },
          }),
        },
      }),
    },

    PinInput: {
      styles: {
        input: {
          backgroundColor: 'rgba(24, 24, 27, 0.5)',
          borderColor: '#3f3f46',
          color: '#ffffff',
          '&:focus': {
            borderColor: '#7c3aed',
          },
        },
      },
    },

    Loader: {
      defaultProps: {
        color: 'violet',
      },
    },
  },
});
