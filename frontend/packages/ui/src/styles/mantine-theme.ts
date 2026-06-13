import { createTheme, type MantineThemeOverride } from '@mantine/core';

export const mantineTheme: MantineThemeOverride = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 7, dark: 4 },
  defaultRadius: 'md',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',

  colors: {
    brand: [
      '#e8fbfb',
      '#d6f4f3',
      '#ace6e4',
      '#7fd6d3',
      '#5ac6c3',
      '#3bb7b4',
      '#239895',
      '#167875',
      '#0e5d5b',
      '#063c3b',
    ],
  },

  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 600,
        },
      },
    },

    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
    },

    Card: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-card-foreground)',
        },
      },
    },

    Paper: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-card-foreground)',
        },
      },
    },

    TextInput: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        label: {
          color: 'var(--app-foreground)',
          fontWeight: 600,
        },
        input: {
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-foreground)',
        },
      },
    },

    PinInput: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        input: {
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-foreground)',
        },
      },
    },

    Menu: {
      styles: {
        dropdown: {
          backgroundColor: 'var(--app-card)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-card-foreground)',
        },
        item: {
          color: 'var(--app-card-foreground)',
        },
      },
    },

    Loader: {
      defaultProps: {
        color: 'brand',
      },
    },
  },
});
