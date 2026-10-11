import { Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { FlowProps } from './booking-modes/editor-mode';
import { ServiceCard } from './service-card';

export function ItemsSection({
  form,
  editor,
  dayLabels,
  list,
  title,
  count,
  empty,
  addLabel,
  before,
}: FlowProps & {
  title: string;
  count: string;
  empty: string;
  addLabel: string;
  before?: ReactNode;
}) {
  const { services } = form.values;

  return (
    <section
      aria-labelledby="booking-services-title"
      className="flex flex-col gap-4 border-t border-border pt-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="booking-services-title" className="text-sm font-medium">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {before}
      {services.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      )}
      {services.map((service, index) => (
        <ServiceCard
          key={service.key}
          form={form}
          editor={editor}
          index={index}
          dayLabels={dayLabels}
          expanded={list.expanded.has(service.key)}
          onToggle={() => list.toggle(service.key)}
          onRemove={() => list.remove(service.key)}
        />
      ))}
      <Button
        variant="default"
        fullWidth
        style={{ borderStyle: 'dashed' }}
        leftSection={<IconPlus size={14} />}
        onClick={list.add}
      >
        {addLabel}
      </Button>
    </section>
  );
}
