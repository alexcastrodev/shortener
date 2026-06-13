import type { ButtonProps, TextInputProps } from '@mantine/core';

export const buttonStyles = {
  brand: {
    root: {
      backgroundColor: 'var(--app-primary)',
      color: 'var(--app-primary-foreground)',
    },
  } satisfies ButtonProps['styles'],

  violet: {
    root: {
      backgroundColor: 'var(--app-primary)',
      color: 'var(--app-primary-foreground)',
    },
  } satisfies ButtonProps['styles'],

  outline: {
    root: {
      borderColor: 'var(--app-border)',
      color: 'var(--app-foreground)',
    },
  } satisfies ButtonProps['styles'],

  subtle: {
    root: {
      color: 'var(--app-muted-foreground)',
    },
  } satisfies ButtonProps['styles'],

  danger: {
    root: {
      color: 'var(--app-destructive)',
    },
  } satisfies ButtonProps['styles'],
};

export const inputStyles = {
  dark: {
    input: {
      backgroundColor: 'var(--app-card)',
      borderColor: 'var(--app-border)',
      color: 'var(--app-foreground)',
    },
  } satisfies TextInputProps['styles'],

  violet: {
    input: {
      backgroundColor: 'var(--app-card)',
      borderColor: 'var(--app-border)',
      color: 'var(--app-foreground)',
    },
  } satisfies TextInputProps['styles'],
};

export const actionIconStyles = {
  dark: {
    root: {
      color: 'var(--app-muted-foreground)',
    },
  },

  violet: {
    root: {
      backgroundColor: 'var(--app-accent)',
      color: 'var(--app-accent-foreground)',
    },
  },
};

export const menuDropdownStyles = {
  dark: {
    backgroundColor: 'var(--app-card)',
    borderColor: 'var(--app-border)',
  },
};

export const menuItemStyles = {
  dark: {
    color: 'var(--app-card-foreground)',
  },
};

export const pinInputStyles = {
  dark: {
    input: {
      backgroundColor: 'var(--app-card)',
      borderColor: 'var(--app-border)',
      color: 'var(--app-foreground)',
    },
  },
};
