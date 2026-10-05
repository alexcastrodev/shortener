import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Form } from '@internal/core/types/Form';
import { getBioTheme } from '../bio-page/themes';
import { FieldInput, focusFirstInput, isBlank, type Answer, type UploadImage } from './field-inputs';
import { isSection, sectionOf } from './field-types';
import { PagedForm } from './paged-form';

export type RenderableForm = Pick<
  Form,
  'title' | 'description' | 'thank_you_message' | 'theme' | 'layout' | 'fields'
>;

export type SubmitFailure = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type Props = {
  form: RenderableForm;
  mode: 'preview' | 'live';
  onSubmit?: (answers: Record<string, Answer>) => Promise<void> | void;
  onUploadImage?: UploadImage;
  onStart?: () => void;
  lastStepSlot?: ReactNode;
  footer?: ReactNode;
  activeFieldId?: string | null;
  onSelectField?: (id: string) => void;
};

export function FormRenderer(props: Props) {
  return props.form.layout === 'one_at_a_time' ? (
    <SequentialForm {...props} />
  ) : (
    <PagedForm {...props} />
  );
}

function SequentialForm({
  form,
  mode,
  onSubmit,
  onUploadImage,
  onStart,
  lastStepSlot,
  footer,
  activeFieldId,
  onSelectField,
}: Props) {
  const theme = getBioTheme(form.theme);
  const uid = useId();
  const questions = form.fields.filter(item => !isSection(item));
  const total = questions.length;
  const activeAt = form.fields.findIndex(item => item.id === activeFieldId);
  const activeQuestion =
    activeAt < 0 ? undefined : form.fields.slice(activeAt).find(item => !isSection(item));
  const activeIndex = activeQuestion ? questions.indexOf(activeQuestion) : -1;
  const [step, setStep] = useState(activeIndex);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeIndex >= 0) setStep(activeIndex);
  }, [activeIndex]);

  useEffect(() => {
    if (mode === 'live' && step >= 0 && step < total) focusFirstInput(container.current);
  }, [mode, step, total]);

  const field = step >= 0 && step < total ? questions[step] : null;
  const done = step >= total && total > 0;
  const shell = `flex flex-col px-[max(1.25rem,calc((100%-36rem)/2))] py-8 ${theme.page} ${
    mode === 'live' ? 'min-h-dvh' : 'min-h-full'
  }`;
  const primary = `min-h-11 rounded-lg px-5 py-2 font-medium ${theme.button}`;

  const next = async () => {
    if (!field) return;
    if (field.required && isBlank(answers[field.id])) {
      setError('This question is required');
      return;
    }
    setError(null);
    if (step < total - 1) {
      setStep(step + 1);
      return;
    }
    if (mode === 'live' && onSubmit) {
      setSubmitting(true);
      try {
        await onSubmit(answers);
        setStep(total);
      } catch (failure) {
        const { message, fieldErrors } = (failure ?? {}) as SubmitFailure;
        const invalid = fieldErrors
          ? questions.findIndex(item => fieldErrors[item.id])
          : -1;
        if (invalid >= 0) setStep(invalid);
        setError(
          invalid >= 0
            ? 'Please check this answer.'
            : (message ?? 'We could not send your answers. Please try again.')
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setStep(total);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' || event.shiftKey || !field) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON') return;
    if (field.type === 'long_text' && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    void next();
  };

  if (total === 0) {
    return (
      <div className={shell}>
        <h1 className={`text-2xl font-semibold ${theme.title}`}>{form.title}</h1>
        <p className={`mt-3 ${theme.bio}`}>This form has no questions yet.</p>
        {footer}
      </div>
    );
  }

  if (step === -1) {
    return (
      <div className={`${shell} justify-center`}>
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
              setStep(0);
            }}
          >
            Start
          </button>
          <span className={`ml-4 hidden text-xs sm:inline ${theme.bio}`}>press Enter ↵</span>
          <span className={`ml-4 text-sm ${theme.bio}`}>
            ~{Math.max(1, Math.ceil(total / 4))} min
          </span>
        </div>
        {footer}
      </div>
    );
  }

  if (done) {
    return (
      <div className={`${shell} justify-center`} role="status">
        <h1 className={`text-2xl font-semibold ${theme.title}`}>Thank you</h1>
        <p className={`mt-3 whitespace-pre-line ${theme.bio}`}>
          {form.thank_you_message || 'Your answers were sent.'}
        </p>
        {mode === 'preview' && (
          <div className="mt-8">
            <button
              type="button"
              className={`text-sm underline ${theme.footer}`}
              onClick={() => {
                setAnswers({});
                setStep(-1);
              }}
            >
              Restart preview
            </button>
          </div>
        )}
        {footer}
      </div>
    );
  }

  const inputId = `${uid}-${field!.id}`;
  return (
    <div
      ref={container}
      className={shell}
      onKeyDown={onKeyDown}
      onClick={mode === 'preview' ? () => onSelectField?.(field!.id) : undefined}
    >
      <div
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step + 1}
        className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-current/15"
      >
        <div
          className="h-full rounded-full bg-current transition-[width] motion-reduce:transition-none"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>
      <p aria-live="polite" className={`mb-2 text-xs ${theme.bio}`}>
        {sectionOf(form.fields, field!.id) && (
          <span className="mr-2 font-mono uppercase">{sectionOf(form.fields, field!.id)}</span>
        )}
        <span className="sr-only">
          Question {step + 1} of {total}
        </span>
      </p>
      <label htmlFor={inputId} className={`text-xl font-semibold ${theme.title}`}>
        <span aria-hidden="true" className={`mr-3 font-mono text-xs ${theme.bio}`}>
          {String(step + 1).padStart(2, '0')} →
        </span>
        {field!.label}
        {field!.required && <span aria-hidden="true"> *</span>}
      </label>
      <p id={`${inputId}-help`} className={`mt-1 mb-4 text-sm ${theme.bio}`}>
        {field!.help}
      </p>
      <FieldInput
        key={field!.id}
        field={field!}
        value={answers[field!.id]}
        onChange={value => {
          setError(null);
          setAnswers(current => ({ ...current, [field!.id]: value }));
        }}
        theme={theme}
        inputId={inputId}
        upload={mode === 'live' ? onUploadImage : undefined}
      />
      {step === total - 1 && lastStepSlot}
      {error && (
        <p
          role="alert"
          className="mt-3 self-start rounded-md bg-[#fee2e2] px-3 py-1.5 text-sm font-medium text-[#991b1b]"
        >
          {error}
        </p>
      )}
      <div className="mt-8 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            aria-label="Back"
            className={`min-h-11 rounded-lg px-4 ${theme.button}`}
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
          >
            ←
          </button>
        )}
        <button type="button" className={primary} disabled={submitting} onClick={() => void next()}>
          {step === total - 1 ? (submitting ? 'Sending…' : 'Submit') : 'Next'}
        </button>
        <span className={`hidden text-xs sm:inline ${theme.bio}`}>press Enter ↵</span>
        <span className={`ml-auto font-mono text-xs ${theme.bio}`}>
          {step + 1} / {total}
        </span>
      </div>
      {footer}
    </div>
  );
}
