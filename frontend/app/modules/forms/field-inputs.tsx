import type { BioTheme } from '../bio-page/themes';
import type { FormField } from '@internal/core/types/Form';

export type Answer = string | number | boolean | string[] | undefined;

type Props = {
  field: FormField;
  value: Answer;
  onChange: (value: Answer) => void;
  theme: BioTheme;
  inputId: string;
};

const inputBase =
  'w-full rounded-lg px-3 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-current';

export function FieldInput({ field, value, onChange, theme, inputId }: Props) {
  const common = { id: inputId, 'aria-describedby': `${inputId}-help` };

  switch (field.type) {
    case 'short_text':
    case 'email':
      return (
        <input
          {...common}
          type={field.type === 'email' ? 'email' : 'text'}
          inputMode={field.type === 'email' ? 'email' : undefined}
          autoComplete={field.type === 'email' ? 'email' : 'off'}
          maxLength={field.type === 'email' ? 254 : 500}
          value={(value as string) ?? ''}
          onChange={event => onChange(event.target.value)}
          className={`${inputBase} ${theme.button}`}
        />
      );
    case 'long_text':
      return (
        <textarea
          {...common}
          rows={5}
          maxLength={5000}
          value={(value as string) ?? ''}
          onChange={event => onChange(event.target.value)}
          className={`${inputBase} ${theme.button} resize-none`}
        />
      );
    case 'number':
      return (
        <input
          {...common}
          type="number"
          inputMode="decimal"
          step="any"
          min={field.min}
          max={field.max}
          value={(value as string) ?? ''}
          onChange={event => onChange(event.target.value)}
          className={`${inputBase} ${theme.button}`}
        />
      );
    case 'date':
      return (
        <input
          {...common}
          type="date"
          min="1900-01-01"
          max="2100-12-31"
          value={(value as string) ?? ''}
          onChange={event => onChange(event.target.value)}
          className={`${inputBase} ${theme.button}`}
        />
      );
    case 'single_choice':
      return (
        <fieldset id={inputId} className="space-y-2">
          {field.choices?.map(choice => (
            <label
              key={choice.id}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${theme.button}`}
            >
              <input
                type="radio"
                name={inputId}
                checked={value === choice.id}
                onChange={() => onChange(choice.id)}
              />
              <span className="whitespace-pre-line">{choice.label}</span>
            </label>
          ))}
        </fieldset>
      );
    case 'multiple_choice': {
      const selected = (value as string[] | undefined) ?? [];
      const max = field.max_choices ?? field.choices?.length ?? 0;
      return (
        <fieldset id={inputId} className="space-y-2">
          {max < (field.choices?.length ?? 0) && (
            <p className={`text-xs ${theme.bio}`}>Choose up to {max}</p>
          )}
          {field.choices?.map(choice => {
            const checked = selected.includes(choice.id);
            return (
              <label
                key={choice.id}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${theme.button}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && selected.length >= max}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter(id => id !== choice.id)
                        : [...selected, choice.id]
                    )
                  }
                />
                <span className="whitespace-pre-line">{choice.label}</span>
              </label>
            );
          })}
        </fieldset>
      );
    }
    case 'yes_no':
      return (
        <fieldset id={inputId} className="grid grid-cols-2 gap-2">
          {[
            { label: 'Yes', answer: true },
            { label: 'No', answer: false },
          ].map(option => (
            <label
              key={option.label}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 ${theme.button} ${
                value === option.answer ? 'ring-2 ring-current' : ''
              }`}
            >
              <input
                type="radio"
                name={inputId}
                className="sr-only"
                checked={value === option.answer}
                onChange={() => onChange(option.answer)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      );
    case 'rating': {
      const scale = field.scale ?? 5;
      return (
        <fieldset id={inputId} className="grid grid-cols-5 gap-2">
          {Array.from({ length: scale }, (_, index) => index + 1).map(point => (
            <label
              key={point}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 py-2 ${theme.button} ${
                value === point ? 'ring-2 ring-current' : ''
              }`}
            >
              <input
                type="radio"
                name={inputId}
                className="sr-only"
                checked={value === point}
                onChange={() => onChange(point)}
              />
              {point}
            </label>
          ))}
        </fieldset>
      );
    }
    default:
      return null;
  }
}
