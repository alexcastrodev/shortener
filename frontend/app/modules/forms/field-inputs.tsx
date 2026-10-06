import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import type { BookingAnswer } from '@internal/core/types/Form';
import { BookingInput, type LoadSlots } from './booking-input';
import type { BioTheme } from '../bio-page/themes';
import type { FormField } from '@internal/core/types/Form';

export type Answer = string | number | boolean | string[] | BookingAnswer | undefined;

export const isBlank = (value: Answer) =>
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !Array.isArray(value) && value.sessions.length === 0);

export function focusFirstInput(root: HTMLElement | null) {
  requestAnimationFrame(() =>
    root
      ?.querySelector<HTMLElement>(
        'input:not([type=radio]):not([type=checkbox]), textarea, select'
      )
      ?.focus({ preventScroll: true })
  );
}

export type UploadImage = (fieldId: string, file: File) => Promise<string>;

type Props = {
  field: FormField;
  value: Answer;
  onChange: (value: Answer) => void;
  theme: BioTheme;
  inputId: string;
  upload?: UploadImage;
  loadSlots?: LoadSlots;
  invalid?: string;
};

const inputBase =
  'w-full rounded-lg px-3 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-current';

export function FieldInput({ field, value, onChange, theme, inputId, upload, loadSlots, invalid }: Props) {
  const { t } = useTranslation('respond');
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
            <p className={`text-xs ${theme.bio}`}>{t('choose_up_to', { max })}</p>
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
            { label: t('yes'), answer: true },
            { label: t('no'), answer: false },
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
    case 'booking':
      return (
        <BookingInput
          field={field}
          value={value as BookingAnswer | undefined}
          onChange={onChange}
          theme={theme}
          inputId={inputId}
          loadSlots={loadSlots}
          reloadKey={invalid}
        />
      );
    case 'image':
      return (
        <ImageInput
          field={field}
          value={value as string | undefined}
          onChange={onChange}
          theme={theme}
          inputId={inputId}
          upload={upload}
        />
      );
    default:
      return null;
  }
}

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

function uploadMessage(status?: number) {
  const t = i18n.getFixedT(null, 'respond');
  if (status === 503) return t('upload_unavailable');
  if (status === 429) return t('upload_rate_limited');
  if (status === 413) return t('upload_too_large');
  return t('upload_invalid');
}

function ImageInput({ field, value, onChange, theme, inputId, upload }: Props & { value: string | undefined }) {
  const { t } = useTranslation('respond');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const choose = async (file: File | undefined) => {
    if (!file || !upload) return;
    setProblem(null);
    if (file.size > IMAGE_MAX_BYTES) {
      setProblem(uploadMessage(413));
      return;
    }
    setBusy(true);
    try {
      onChange(await upload(field.id, file));
      setName(file.name);
    } catch (failure) {
      setProblem(uploadMessage((failure as { status?: number })?.status));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={input}
        id={inputId}
        aria-describedby={`${inputId}-help`}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        disabled={busy || !upload}
        onChange={event => void choose(event.target.files?.[0])}
        className={`${inputBase} ${theme.button}`}
      />
      {busy && <p className={`text-sm ${theme.bio}`}>{t('uploading')}</p>}
      {value && !busy && (
        <p className={`flex items-center gap-3 text-sm ${theme.bio}`}>
          <span className="truncate">{name ? t('attached_name', { name }) : t('attached')}</span>
          <button type="button" className="underline" onClick={() => { setName(''); onChange(undefined); }}>
            {t('remove')}
          </button>
        </p>
      )}
      {problem && (
        <p role="alert" className="text-sm text-red-500">
          {problem}
        </p>
      )}
    </div>
  );
}
