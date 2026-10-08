import { Button } from '@mantine/core';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function useOpenOnErrors(
  errors: Record<string, ReactNode>,
  owns: (key: string) => boolean
) {
  const signature = Object.entries(errors)
    .filter(([key]) => owns(key))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join('|');
  const [open, setOpen] = useState(signature !== '');

  useEffect(() => {
    if (signature !== '') setOpen(true);
  }, [signature]);

  return [open, setOpen] as const;
}

export function SummarySection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('booking');
  const id = useId();

  return (
    <section
      className="border-t border-border pt-6"
      aria-labelledby={`${id}-title`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="text-sm font-medium">
            {title}
          </h3>
          <p className="break-words text-sm text-muted-foreground">{summary}</p>
        </div>
        <Button
          variant="subtle"
          size="compact-sm"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
        >
          {open ? t('sec_close') : t('sec_edit')}
        </Button>
      </div>
      {open && (
        <div id={`${id}-panel`} className="mt-4">
          {children}
        </div>
      )}
    </section>
  );
}
