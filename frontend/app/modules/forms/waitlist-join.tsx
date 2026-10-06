import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FullSlot } from '@internal/core/actions/get-form-slots/get-form-slots.types';
import type { BioTheme } from '../bio-page/themes';

export type JoinWaitlist = (params: {
  service: string;
  date: string;
  time: string;
  name: string;
  email: string;
}) => Promise<void>;

type Chosen = { date: string; time: string };

export function WaitlistJoin({
  serviceId,
  full,
  theme,
  chip,
  dayLabel,
  join,
}: {
  serviceId: string;
  full: FullSlot[];
  theme: BioTheme;
  chip: (selected: boolean) => string;
  dayLabel: (iso: string) => string;
  join: JoinWaitlist;
}) {
  const { t } = useTranslation('respond');
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  if (full.length === 0) return null;

  const submit = async () => {
    if (!chosen || state === 'busy') return;
    setState('busy');
    setProblem(null);
    try {
      await join({
        service: serviceId,
        ...chosen,
        name: name.trim(),
        email: email.trim(),
      });
      setState('done');
    } catch (error) {
      setState('idle');
      setProblem(
        error === 'not_full'
          ? t('waitlist_not_full')
          : error === 'waitlist_full'
            ? t('waitlist_list_full')
            : error === 'invalid'
              ? t('waitlist_invalid')
              : t('waitlist_failed')
      );
    }
  };

  if (state === 'done' && chosen) {
    return (
      <p
        role="status"
        className="rounded-lg border border-current/20 px-3 py-2 text-sm"
      >
        {t('waitlist_joined', {
          when: `${dayLabel(chosen.date)} · ${chosen.time}`,
        })}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-current/20 px-3 py-3">
      <p className="text-sm font-medium">{t('waitlist_title')}</p>
      <p className={`text-xs ${theme.bio}`}>{t('waitlist_hint')}</p>
      <div className="flex flex-wrap gap-2">
        {full.map(slot => {
          const selected =
            chosen?.date === slot.date && chosen.time === slot.time;
          return (
            <button
              key={slot.starts_at}
              type="button"
              aria-pressed={selected}
              className={chip(selected)}
              onClick={() => setChosen({ date: slot.date, time: slot.time })}
            >
              {dayLabel(slot.date)} · {slot.time}
            </button>
          );
        })}
      </div>
      {chosen && (
        <div className="space-y-2">
          <label className="block text-sm">
            {t('waitlist_name')}
            <input
              value={name}
              maxLength={100}
              autoComplete="name"
              onChange={event => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-current/30 bg-transparent px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t('waitlist_email')}
            <input
              type="email"
              value={email}
              maxLength={254}
              autoComplete="email"
              onChange={event => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-current/30 bg-transparent px-3 py-2"
            />
          </label>
          {problem && (
            <p role="alert" className="text-sm font-medium">
              {problem}
            </p>
          )}
          <button
            type="button"
            disabled={
              state === 'busy' || name.trim() === '' || email.trim() === ''
            }
            className={`min-h-10 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${theme.button}`}
            onClick={submit}
          >
            {t('waitlist_join')}
          </button>
        </div>
      )}
    </div>
  );
}
