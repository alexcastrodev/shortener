import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormField } from '@internal/core/types/Form';
import { getBioTheme } from '../bio-page/themes';
import { FieldInput, focusFirstInput, isBlank, type Answer } from './field-inputs';
import { isSection } from './field-types';
import type { Props, SubmitFailure, SubmitFormReceipt } from './form-renderer';
import { BookingReceipt } from './booking-receipt';
import { FormCover } from './form-cover';

const alertClass =
  'rounded-md bg-[#fee2e2] px-3 py-1.5 text-sm font-medium text-[#991b1b]';

function splitPages(fields: FormField[], layout: Props['form']['layout']) {
  if (layout !== 'steps') return [fields];
  const pages: FormField[][] = [[]];
  for (const field of fields) {
    if (isSection(field) && pages.at(-1)!.length) pages.push([]);
    pages.at(-1)!.push(field);
  }
  return pages;
}

export function PagedForm({
  form,
  coverUrl,
  mode,
  onSubmit,
  onUploadImage,
  loadSlots,
  onStart,
  lastStepSlot,
  footer,
  activeFieldId,
  onSelectField,
}: Props) {
  const { t } = useTranslation('respond');
  const theme = getBioTheme(form.theme, form.custom_colors);
  const uid = useId();
  const pages = splitPages(form.fields, form.layout);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState<SubmitFormReceipt | null>(null);
  const [introduced, setIntroduced] = useState(!form.intro_enabled);
  const started = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const current = Math.min(page, pages.length - 1);
  const last = current === pages.length - 1;
  const primary = `min-h-11 rounded-lg px-5 py-2 font-medium ${theme.button}`;
  const shell = `flex flex-col px-[max(1.25rem,calc((100%-36rem)/2))] py-8 ${theme.page} ${
    mode === 'live' ? 'min-h-dvh' : 'min-h-full'
  }`;

  useEffect(() => {
    if (mode === 'live' && page > 0) focusFirstInput(root.current);
  }, [mode, page]);

  useEffect(() => {
    if (!activeFieldId) return;
    setIntroduced(true);
    const at = pages.findIndex(fields => fields.some(item => item.id === activeFieldId));
    if (at >= 0) setPage(at);
    requestAnimationFrame(() =>
      document
        .getElementById(`${uid}-wrap-${activeFieldId}`)
        ?.scrollIntoView({ block: 'center' })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFieldId]);

  const missing = (fields: FormField[]) =>
    Object.fromEntries(
      fields
        .filter(item => item.required && !isSection(item) && isBlank(answers[item.id]))
        .map(item => [item.id, t('required')])
    );

  const next = async () => {
    const invalid = missing(pages[current]);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setFormError(null);
    if (!last) {
      setPage(current + 1);
      return;
    }
    if (mode === 'live' && onSubmit) {
      setSubmitting(true);
      try {
        setReceipt((await onSubmit(answers)) ?? null);
        setDone(true);
      } catch (failure) {
        const { message, fieldErrors } = (failure ?? {}) as SubmitFailure;
        const failing = fieldErrors
          ? form.fields.find(item => fieldErrors[item.id])
          : undefined;
        if (failing) {
          setErrors({ [failing.id]: fieldErrors![failing.id][0] === 'unavailable' ? t('booking_taken') : t('check_answer') });
          setPage(Math.max(0, pages.findIndex(fields => fields.includes(failing))));
        }
        setFormError(
          failing ? null : (message ?? t('send_failed'))
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setDone(true);
  };

  if (form.fields.every(isSection)) {
    return (
      <div className={shell} style={theme.style}>
        <h1 className={`text-2xl font-semibold ${theme.title}`}>{form.title}</h1>
        <p className={`mt-3 ${theme.bio}`}>{t('no_questions')}</p>
        {footer}
      </div>
    );
  }

  if (done) {
    return (
      <div className={`${shell} justify-center`} style={theme.style} role="status">
        <h1 className={`text-2xl font-semibold ${theme.title}`}>{t('thank_you')}</h1>
        <p className={`mt-3 whitespace-pre-line ${theme.bio}`}>
          {form.thank_you_message || t('answers_sent')}
        </p>
        <BookingReceipt receipt={receipt} linkClass={theme.footer} textClass={theme.bio} />
        {mode === 'preview' && (
          <div className="mt-8">
            <button
              type="button"
              className={`text-sm underline ${theme.footer}`}
              onClick={() => {
                setAnswers({});
                setErrors({});
                setPage(0);
                setDone(false);
              }}
            >
              {t('restart_preview')}
            </button>
          </div>
        )}
        {footer}
      </div>
    );
  }

  if (!introduced) {
    return (
      <div className={`${shell} justify-center`} style={theme.style}>
        <FormCover url={coverUrl} position={form.cover_position} />
        <h1 className={`text-2xl font-semibold ${theme.title}`}>{form.title}</h1>
        {form.description && (
          <p className={`mt-3 whitespace-pre-line ${theme.bio}`}>{form.description}</p>
        )}
        <div className="mt-8">
          <button
            type="button"
            autoFocus={mode === 'live'}
            className={primary}
            onClick={() => {
              onStart?.();
              setIntroduced(true);
            }}
          >
            {form.start_label || t('start')}
          </button>
        </div>
        {footer}
      </div>
    );
  }

  let number = pages
    .slice(0, current)
    .flat()
    .filter(item => !isSection(item)).length;

  return (
    <div ref={root} className={shell} style={theme.style}>
      {pages.length > 1 && (
        <div
          role="progressbar"
          aria-label={t('progress')}
          aria-valuemin={0}
          aria-valuemax={pages.length}
          aria-valuenow={current + 1}
          className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-current/15"
        >
          <div
            className="h-full rounded-full bg-current transition-[width] motion-reduce:transition-none"
            style={{ width: `${((current + 1) / pages.length) * 100}%` }}
          />
        </div>
      )}
      {current === 0 && (
        <header className="mb-8">
          {!form.intro_enabled && <FormCover url={coverUrl} position={form.cover_position} />}
          <h1 className={`text-2xl font-semibold ${theme.title}`}>{form.title}</h1>
          {form.description && (
            <p className={`mt-3 whitespace-pre-line ${theme.bio}`}>{form.description}</p>
          )}
        </header>
      )}
      <div className="space-y-8">
        {pages[current].map((field, index) => {
          const outline =
            mode === 'preview' && field.id === activeFieldId
              ? 'rounded-lg outline-2 outline-dashed outline-offset-8 outline-current/50'
              : '';
          if (isSection(field)) {
            const divider = current > 0 || index > 0 ? 'border-t border-current/15 pt-8' : '';
            return (
              <div
                key={field.id}
                id={`${uid}-wrap-${field.id}`}
                className={`${outline} ${divider}`}
                onClick={mode === 'preview' ? () => onSelectField?.(field.id) : undefined}
              >
                <h2 className={`text-xl font-semibold ${theme.title}`}>{field.label}</h2>
                {field.help && (
                  <p className={`mt-1 whitespace-pre-line text-sm ${theme.bio}`}>{field.help}</p>
                )}
              </div>
            );
          }
          number += 1;
          const inputId = `${uid}-${field.id}`;
          return (
            <div
              key={field.id}
              id={`${uid}-wrap-${field.id}`}
              className={outline}
              onClick={mode === 'preview' ? () => onSelectField?.(field.id) : undefined}
            >
              <label htmlFor={inputId} className={`text-lg font-semibold ${theme.title}`}>
                <span className={`mr-2 font-mono text-xs ${theme.bio}`}>
                  {String(number).padStart(2, '0')}
                </span>
                {field.label}
                {field.required && <span aria-hidden="true"> *</span>}
              </label>
              <p id={`${inputId}-help`} className={`mt-1 mb-3 text-sm ${theme.bio}`}>
                {field.help}
              </p>
              <FieldInput
                field={field}
                value={answers[field.id]}
                onChange={value => {
                  if (!started.current) {
                    started.current = true;
                    onStart?.();
                  }
                  setErrors(({ [field.id]: _cleared, ...rest }) => rest);
                  setAnswers(previous => ({ ...previous, [field.id]: value }));
                }}
                theme={theme}
                inputId={inputId}
                upload={mode === 'live' ? onUploadImage : undefined}
                loadSlots={mode === 'live' ? loadSlots : undefined}
                invalid={errors[field.id]}
              />
              {errors[field.id] && (
                <p role="alert" className={`mt-3 inline-block ${alertClass}`}>
                  {errors[field.id]}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {last && lastStepSlot}
      {formError && (
        <p role="alert" className={`mt-3 self-start ${alertClass}`}>
          {formError}
        </p>
      )}
      <div className="mt-8 flex items-center justify-between gap-3">
        {current > 0 ? (
          <button
            type="button"
            className={`text-sm underline ${theme.footer}`}
            onClick={() => setPage(current - 1)}
          >
            {t('back')}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4">
          {pages.length > 1 && (
            <span className={`font-mono text-xs ${theme.bio}`}>
              {t('step_of', { current: current + 1, total: pages.length })}
            </span>
          )}
          <button
            type="button"
            className={primary}
            disabled={submitting}
            onClick={() => void next()}
          >
            {last ? (submitting ? t('sending') : t('submit')) : t('next')}
          </button>
        </div>
      </div>
      {footer}
    </div>
  );
}
