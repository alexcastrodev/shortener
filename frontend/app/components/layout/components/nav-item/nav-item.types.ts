import type { ActionIconProps } from '@mantine/core';
import type { ComponentPropsWithoutRef } from 'react';

export interface ActionIconAnchorProps
  extends ActionIconProps,
    Omit<ComponentPropsWithoutRef<'a'>, keyof ActionIconProps> {}
