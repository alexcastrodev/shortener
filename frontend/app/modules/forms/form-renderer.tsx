import { useId, useRef, useState } from 'react';
import type { Form } from '@internal/core/types/Form';
import { getBioTheme } from '../bio-page/themes';
import { FieldInput, type Answer } from './field-inputs';

export type RenderableForm = Pick<
  Form,
  'title' | 'description' | 'thank_you_message' | 'theme' | 'fields'
>;

type Props = {
  form: RenderableForm;
  mode: 'preview' | 'live';
  onSubmit?: (answers: Record<string, Answer>) => Promise<void> | void;
};

const isBlank = (value: Answer) =>
  value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

export function FormRenderer({ form, mode, onSubmit }: Props) {
  const theme = getBioTheme(form.theme);
  const uid = useId();
  const total = form.fields.length;
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const field = step >= 0 && step < total ? form.fields[step] : null;
  const done = step >= total && total > 0;
  const shell = `flex flex-col px-5 py-8 ${theme.page} ${
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
      } catch {
        setError('We could not send your answers. Please try again.');
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
          <button type="button" className={primary} onClick={() => setStep(0)}>
            Start
          </button>
        </div>
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
      </div>
    );
  }

  const inputId = `${uid}-${field!.id}`;
  return (
    <div ref={container} className={shell} onKeyDown={onKeyDown}>
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
        Question {step + 1} of {total}
      </p>
      <label htmlFor={inputId} className={`text-xl font-semibold ${theme.title}`}>
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
      />
      {error && (
        <p
          role="alert"
          className="mt-3 self-start rounded-md bg-[#fee2e2] px-3 py-1.5 text-sm font-medium text-[#991b1b]"
        >
          {error}
        </p>
      )}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          className={`text-sm underline ${theme.footer}`}
          onClick={() => {
            setError(null);
            setStep(step - 1);
          }}
        >
          Back
        </button>
        <button type="button" className={primary} disabled={submitting} onClick={() => void next()}>
          {step === total - 1 ? (submitting ? 'Sending…' : 'Submit') : 'OK'}
        </button>
      </div>
    </div>
  );
}
