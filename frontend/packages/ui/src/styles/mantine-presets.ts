/**
 * Mantine Component Style Presets
 * Reusable style configurations for Mantine components
 */

import type { ButtonProps, TextInputProps } from '@mantine/core';

/**
 * Button Styles
 */
export const buttonStyles = {
  // Primary violet button
  violet: {
    root: {
      backgroundColor: '#7c3aed',
      '&:hover': {
        backgroundColor: '#6d28d9',
      },
    },
  } satisfies ButtonProps['styles'],

  // Outline button with dark theme
  outline: {
    root: {
      borderColor: '#3f3f46',
      color: '#a1a1aa',
      '&:hover': {
        backgroundColor: 'rgba(63, 63, 70, 0.5)',
        color: '#ffffff',
      },
    },
  } satisfies ButtonProps['styles'],

  // Subtle button for navigation
  subtle: {
    root: {
      color: '#a1a1aa',
      '&:hover': {
        backgroundColor: 'rgba(63, 63, 70, 0.5)',
        color: '#ffffff',
      },
    },
  } satisfies ButtonProps['styles'],

  // Red button for destructive actions
  danger: {
    root: {
      color: '#fca5a5',
      '&:hover': {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
      },
    },
  } satisfies ButtonProps['styles'],
};

/**
 * TextInput Styles
 */
export const inputStyles = {
  // Dark themed input
  dark: {
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
  } satisfies TextInputProps['styles'],

  // Dark input with violet focus
  violet: {
    input: {
      backgroundColor: 'rgba(39, 39, 42, 0.5)',
      borderColor: '#3f3f46',
      color: '#ffffff',
      '&::placeholder': {
        color: '#71717a',
      },
      '&:focus': {
        borderColor: '#7c3aed',
      },
    },
  } satisfies TextInputProps['styles'],
};

/**
 * Action Icon Styles
 */
export const actionIconStyles = {
  dark: {
    root: {
      color: '#a1a1aa',
      '&:hover': {
        backgroundColor: 'rgba(63, 63, 70, 0.5)',
      },
    },
  },

  violet: {
    root: {
      backgroundColor: 'rgba(124, 58, 237, 0.2)',
      color: '#a78bfa',
      '&:hover': {
        backgroundColor: 'rgba(124, 58, 237, 0.3)',
      },
    },
  },
};

/**
 * Menu Dropdown Styles
 */
export const menuDropdownStyles = {
  dark: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
  },
};

/**
 * Menu Item Styles
 */
export const menuItemStyles = {
  dark: {
    color: '#ffffff',
    '&:hover': {
      backgroundColor: 'rgba(63, 63, 70, 0.5)',
    },
  },
};

/**
 * PinInput Styles
 */
export const pinInputStyles = {
  dark: {
    input: {
      backgroundColor: 'rgba(24, 24, 27, 0.5)',
      borderColor: '#3f3f46',
      color: '#ffffff',
      '&:focus': {
        borderColor: '#7c3aed',
      },
    },
  },
};
