import type { FormField } from '@internal/core/types/Form';
import type { BioTheme } from '../bio-page/themes';
import { hasLabel, helpId } from './field-title.ts';

export function QuestionHeading({
  field,
  inputId,
  theme,
  gap,
}: {
  field: FormField;
  inputId: string;
  theme: BioTheme;
  gap: 'mb-3' | 'mb-4';
}) {
  const labelled = hasLabel(field);
  if (!labelled && !field.help) return null;
  return (
    <>
      {labelled && (
        <label
          htmlFor={inputId}
          className={`text-xl font-semibold ${theme.title}`}
        >
          {field.label}
          {field.required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      <p
        id={helpId(inputId)}
        className={`${labelled ? 'mt-1' : ''} ${gap} text-sm ${theme.bio}`}
      >
        {field.help}
      </p>
    </>
  );
}
