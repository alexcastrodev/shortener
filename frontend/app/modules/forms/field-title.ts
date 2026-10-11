import type { FormFieldType } from '@internal/core/types/Form';

type Titled = { type: FormFieldType; label?: string | null };

export const hasLabel = (field: Pick<Titled, 'label'>) =>
  Boolean(field.label?.trim());

export const helpId = (inputId: string) => `${inputId}-help`;

export const helpIdFor = (
  field: { help?: string | null },
  inputId: string
) => (field.help ? helpId(inputId) : undefined);

export const fieldTitle = (
  field: Titled,
  typeName: (type: FormFieldType) => string
) => (hasLabel(field) ? field.label!.trim() : typeName(field.type));
