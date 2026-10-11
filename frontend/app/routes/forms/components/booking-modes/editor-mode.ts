import type { UseFormReturnType } from '@mantine/form';
import type { TFunction } from 'i18next';
import type { ComponentType } from 'react';
import type { BookingMode, DAYS, Values } from '@internal/booking';
import type { FormFieldInput } from '@internal/core/types/Form';

export type BookingForm = UseFormReturnType<Values>;

export type DayLabels = Record<(typeof DAYS)[number], string>;

export type ItemWords = {
  unnamed: string;
  remove: (name: string) => string;
  removeTitle: string;
  removeBody: string;
};

export type ItemList = {
  expanded: Set<string>;
  toggle: (key: string) => void;
  add: () => void;
  remove: (key: string) => void;
};

export type FlowProps = {
  form: BookingForm;
  editor: EditorMode;
  dayLabels: DayLabels;
  list: ItemList;
};

export type ItemFieldsProps = {
  form: BookingForm;
  index: number;
  dayLabels: DayLabels;
};

export type RulesExtrasProps = { form: BookingForm };

export type EditorMode = {
  mode: BookingMode;
  create: () => FormFieldInput;
  choice: (t: TFunction<'forms'>) => { label: string; hint: string };
  words: (t: TFunction<'booking'>) => ItemWords;
  Flow: ComponentType<FlowProps>;
  ItemFields: ComponentType<ItemFieldsProps>;
  RulesExtras?: ComponentType<RulesExtrasProps>;
};
