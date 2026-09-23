import {
  ActionIcon,
  Button,
  Drawer,
  Popover,
  Switch,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconEyeOff,
  IconGripVertical,
  IconPlus,
  IconTemplate,
  IconTrash,
} from '@tabler/icons-react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { z } from 'zod/v4';
import { useCreatePageLink } from '@internal/core/actions/create-page-link/create-page-link.hook';
import { useUpdatePageLink } from '@internal/core/actions/update-page-link/update-page-link.hook';
import { useDeletePageLink } from '@internal/core/actions/delete-page-link/delete-page-link.hook';
import { useReorderPageLinks } from '@internal/core/actions/reorder-page-links/reorder-page-links.hook';
import type { UpdatePageLinkRequestBody } from '@internal/core/actions/update-page-link/update-page-link.types';
import type { Page, PageLink } from '@internal/core/types/Page';
import {
  SOCIAL_NETWORKS,
  detectSocialNetwork,
  getBioTheme,
  isValidSocialValue,
  socialLinkUrl,
  socialNetworkById,
  type SocialNetwork,
} from '../../../modules/bio-page';

// The phone preview doubles as the editor: every element opens its own
// settings when clicked, and the "+" buttons sit where the new item will
// appear (icon row, end of a section, bottom of the page). Nobody has to
// know about "kinds": where you click decides what you add.

type Header = Pick<Page, 'slug' | 'display_title' | 'bio' | 'theme' | 'avatar_url'>;

const linkSchema = z.object({
  label: z.string().trim().min(1, 'Required').max(80),
  url: z.url({ protocol: /^https?$/, error: 'Must be an http(s) URL' }),
});

const sectionSchema = z.object({
  label: z.string().trim().min(1, 'Required').max(80),
});

function errorMessage(error: unknown) {
  const errors = (error as { errors?: unknown } | undefined)?.errors;
  if (Array.isArray(errors)) return errors.join(', ');
  if (errors && typeof errors === 'object') {
    return Object.entries(errors)
      .map(([key, value]) => `${key} ${value}`)
      .join(', ');
  }
  return 'Something went wrong, please try again later.';
}

function showError(error: unknown) {
  notifications.show({ title: 'Error', message: errorMessage(error), color: 'red' });
}

interface PageContentEditorProps {
  pageId: number;
  header: Header;
  links: PageLink[];
  onChange: () => void;
  // Offered while the page is still empty.
  onPickTemplate?: () => void;
}

export function PageContentEditor({
  pageId,
  header,
  links,
  onChange,
  onPickTemplate,
}: PageContentEditorProps) {
  const theme = getBioTheme(header.theme);
  const title = header.display_title || `@${header.slug}`;
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Local copy so a drop shows the new order immediately, before the API
  // answers (otherwise the item would jump back for a moment).
  const [items, setItems] = useState(links);
  useEffect(() => setItems(links), [links]);

  const socials = items.filter(link => link.kind === 'social');
  const flow = items.filter(link => link.kind !== 'social');

  const close = () => setOpenKey(null);
  const done = () => {
    close();
    onChange();
  };

  const { mutate: create, isPending: isCreating } = useCreatePageLink({ onError: showError });
  const { mutate: update, isPending: isUpdating } = useUpdatePageLink({
    onSuccess: done,
    onError: showError,
  });
  const { mutate: remove } = useDeletePageLink({ onSuccess: done, onError: showError });
  const { mutate: reorder } = useReorderPageLinks({
    onSuccess: onChange,
    onError: error => {
      showError(error);
      setItems(links);
    },
  });

  // Social icons are always drawn in their own row, so they are kept first
  // in the stored order; buttons and section titles follow in page order.
  const saveOrder = (nextSocials: PageLink[], nextFlow: PageLink[]) => {
    const next = [...nextSocials, ...nextFlow];
    setItems(next);
    reorder({ pageId, ids: next.map(link => link.id) });
  };

  function onDragEnd({ source, destination }: DropResult) {
    if (!destination || destination.index === source.index) return;
    const list = source.droppableId === 'socials' ? [...socials] : [...flow];
    const [moved] = list.splice(source.index, 1);
    list.splice(destination.index, 0, moved);
    if (source.droppableId === 'socials') saveOrder(list, flow);
    else saveOrder(socials, list);
  }

  // New buttons are created at the end of the page; when added from a
  // section title they are then moved to the end of that section.
  function addLink(data: { label: string; url: string }, reset: () => void, section?: PageLink) {
    create(
      { pageId, data: { ...data, kind: 'link', icon: detectSocialNetwork(data.url)?.id } },
      {
        onSuccess: created => {
          reset();
          close();
          if (!section) return onChange();

          const start = flow.findIndex(link => link.id === section.id);
          const nextHeader = flow.findIndex((link, index) => index > start && link.kind === 'header');
          const insertAt = nextHeader === -1 ? flow.length : nextHeader;
          if (insertAt === flow.length) return onChange();

          const nextFlow = [...flow];
          nextFlow.splice(insertAt, 0, created);
          saveOrder(socials, nextFlow);
        },
      }
    );
  }

  function addSocial(data: { label: string; url: string; icon: string }, reset: () => void) {
    create(
      { pageId, data: { ...data, kind: 'social' } },
      { onSuccess: () => { reset(); done(); } }
    );
  }

  function addSection(label: string, reset: () => void) {
    create({ pageId, data: { kind: 'header', label } }, { onSuccess: () => { reset(); done(); } });
  }

  const itemControls = (item: PageLink) => (
    <ItemControls
      item={item}
      onToggle={active => update({ pageId, id: item.id, data: { active } })}
      onDelete={() => remove({ pageId, id: item.id })}
    />
  );

  const saveItem = (item: PageLink, data: UpdatePageLinkRequestBody) =>
    update({ pageId, id: item.id, data });

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={`flex min-h-full flex-col ${theme.page}`}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 pt-10 pb-6">
          {header.avatar_url ? (
            <img src={header.avatar_url} alt="" className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold ${theme.avatar}`}
            >
              {title.replace('@', '').charAt(0).toUpperCase()}
            </div>
          )}
          <p className={`mt-4 text-center text-xl font-semibold ${theme.title}`}>{title}</p>
          {header.bio && (
            <p className={`mt-2 text-center text-sm whitespace-pre-line ${theme.bio}`}>{header.bio}</p>
          )}

          {/* Social icons row: drag sideways to reorder */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-1">
            <Droppable droppableId="socials" direction="horizontal">
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex items-center gap-1">
                  {socials.map((item, index) => {
                    const network = socialNetworkById(item.icon);
                    if (!network) return null;
                    const key = `item-${item.id}`;
                    return (
                      <Draggable
                        key={item.id}
                        draggableId={String(item.id)}
                        index={index}
                        // The icon itself (a button) is the handle: a click
                        // edits, a drag reorders.
                        disableInteractiveElementBlocking
                      >
                        {(drag, snapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            className={`cursor-grab active:cursor-grabbing ${snapshot.isDragging ? 'scale-110' : ''}`}
                          >
                            <EditPopover
                              opened={openKey === key}
                              onClose={close}
                              target={
                                <Tooltip label="Click to edit · drag to reorder">
                                  <EditableTarget
                                    item={item}
                                    onClick={() => setOpenKey(key)}
                                    className={`flex size-11 items-center justify-center rounded-full ${theme.title}`}
                                    label={`Edit ${network.name}`}
                                  >
                                    <network.icon size={26} stroke={1.8} />
                                  </EditableTarget>
                                </Tooltip>
                              }
                            >
                              <PopoverTitle>
                                {network.name} icon · {item.clicks_count}{' '}
                                {item.clicks_count === 1 ? 'click' : 'clicks'}
                              </PopoverTitle>
                              <LinkFields
                                initial={{ label: item.label, url: item.url ?? '' }}
                                hideLabel
                                submitLabel="Save"
                                isPending={isUpdating}
                                onSubmit={values => saveItem(item, { url: values.url })}
                              />
                              <Button
                                variant="subtle"
                                size="xs"
                                fullWidth
                                mt="xs"
                                onClick={() => saveItem(item, { kind: 'link' })}
                              >
                                Show as a button instead
                              </Button>
                              {itemControls(item)}
                            </EditPopover>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            <EditPopover
              opened={openKey === 'add-social'}
              onClose={close}
              width={320}
              target={
                <Tooltip label="Add a social icon">
                  <button
                    type="button"
                    onClick={() => setOpenKey('add-social')}
                    aria-label="Add a social icon"
                    className={`flex size-11 items-center justify-center rounded-full border-2 border-dashed border-current opacity-50 transition-opacity hover:opacity-100 ${theme.title}`}
                  >
                    <IconPlus size={18} />
                  </button>
                </Tooltip>
              }
            >
              <PopoverTitle>Add a social icon</PopoverTitle>
              <SocialForm isPending={isCreating} onSubmit={addSocial} />
            </EditPopover>
          </div>

          {/* Buttons and section titles: one list, drag by the handle */}
          <Droppable droppableId="flow">
            {provided => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="mt-8 flex w-full flex-col">
                {flow.map((item, index) => {
                  const key = `item-${item.id}`;
                  const isHeader = item.kind === 'header';
                  const network = socialNetworkById(item.icon);
                  return (
                    <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={`flex items-center gap-1 pb-3 ${isHeader && index > 0 ? 'pt-6' : ''}`}
                        >
                          <span
                            {...drag.dragHandleProps}
                            aria-label={`Drag to reorder ${item.label}`}
                            className={`flex h-10 w-5 shrink-0 cursor-grab items-center justify-center rounded opacity-40 transition-opacity hover:opacity-100 active:cursor-grabbing ${snapshot.isDragging ? 'opacity-100' : ''} ${theme.title}`}
                          >
                            <IconGripVertical size={16} />
                          </span>
                          <div className={`min-w-0 flex-1 ${snapshot.isDragging ? 'shadow-2xl' : ''}`}>
                            {isHeader ? (
                              <div className="flex items-center gap-1">
                                <EditPopover
                                  opened={openKey === key}
                                  onClose={close}
                                  target={
                                    <EditableTarget
                                      item={item}
                                      onClick={() => setOpenKey(key)}
                                      className={`w-full rounded-md py-2 ${theme.title}`}
                                      label={`Edit section ${item.label}`}
                                    >
                                      <span className="text-xs font-bold tracking-widest uppercase">
                                        {item.label}
                                      </span>
                                    </EditableTarget>
                                  }
                                >
                                  <PopoverTitle>Section title</PopoverTitle>
                                  <SectionForm
                                    initial={item.label}
                                    submitLabel="Save"
                                    isPending={isUpdating}
                                    onSubmit={label => saveItem(item, { label })}
                                  />
                                  {itemControls(item)}
                                </EditPopover>
                                <EditPopover
                                  opened={openKey === `add-to-${item.id}`}
                                  onClose={close}
                                  width={320}
                                  target={
                                    <Tooltip label={`Add a link to “${item.label}”`}>
                                      <button
                                        type="button"
                                        onClick={() => setOpenKey(`add-to-${item.id}`)}
                                        aria-label={`Add a link to ${item.label}`}
                                        className={`flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-current opacity-50 transition-opacity hover:opacity-100 ${theme.title}`}
                                      >
                                        <IconPlus size={14} />
                                      </button>
                                    </Tooltip>
                                  }
                                >
                                  <PopoverTitle>Add a link to “{item.label}”</PopoverTitle>
                                  <LinkFields
                                    initial={{ label: '', url: '' }}
                                    withShortcuts
                                    submitLabel="Add link"
                                    isPending={isCreating}
                                    onSubmit={(values, reset) => addLink(values, reset, item)}
                                  />
                                </EditPopover>
                              </div>
                            ) : (
                              <EditPopover
                                opened={openKey === key}
                                onClose={close}
                                target={
                                  <EditableTarget
                                    item={item}
                                    onClick={() => setOpenKey(key)}
                                    className={`relative flex w-full items-center justify-center rounded-lg py-3 ${network ? 'px-12' : 'px-4'} ${theme.button}`}
                                    label={`Edit ${item.label}`}
                                  >
                                    {network && (
                                      <network.icon size={20} stroke={1.8} className="absolute left-4" />
                                    )}
                                    <span className="text-center text-sm font-medium">{item.label}</span>
                                  </EditableTarget>
                                }
                              >
                                <PopoverTitle>
                                  Button · {item.clicks_count} {item.clicks_count === 1 ? 'click' : 'clicks'}
                                </PopoverTitle>
                                <LinkFields
                                  initial={{ label: item.label, url: item.url ?? '' }}
                                  submitLabel="Save"
                                  isPending={isUpdating}
                                  onSubmit={values =>
                                    saveItem(item, { ...values, icon: detectSocialNetwork(values.url)?.id ?? null })
                                  }
                                />
                                {network && (
                                  <Button
                                    variant="subtle"
                                    size="xs"
                                    fullWidth
                                    mt="xs"
                                    onClick={() => saveItem(item, { kind: 'social' })}
                                  >
                                    Show as an icon under the name instead
                                  </Button>
                                )}
                                {itemControls(item)}
                              </EditPopover>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          <div className="mt-2 flex w-full flex-col gap-3">
            {items.length === 0 && onPickTemplate && (
              <button
                type="button"
                onClick={onPickTemplate}
                className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-current px-4 py-5 transition-opacity hover:opacity-100 opacity-80 ${theme.title}`}
              >
                <IconTemplate size={22} />
                <span className="text-sm font-semibold">Start from a template</span>
                <span className="text-xs opacity-80">Pick a layout, then fill in or remove</span>
              </button>
            )}
            <EditPopover
              opened={openKey === 'add-link'}
              onClose={close}
              width={320}
              target={
                <AddButton onClick={() => setOpenKey('add-link')} className={theme.title}>
                  {flow.length === 0 ? 'Add your first link' : 'Add link'}
                </AddButton>
              }
            >
              <PopoverTitle>Add a link</PopoverTitle>
              <LinkFields
                initial={{ label: '', url: '' }}
                withShortcuts
                submitLabel="Add link"
                isPending={isCreating}
                onSubmit={(values, reset) => addLink(values, reset)}
              />
            </EditPopover>

            <EditPopover
              opened={openKey === 'add-section'}
              onClose={close}
              target={
                <AddButton onClick={() => setOpenKey('add-section')} className={theme.title} subtle>
                  Add section title
                </AddButton>
              }
            >
              <PopoverTitle>Add a section title</PopoverTitle>
              <p className="mb-2 text-xs text-muted-foreground">
                Groups the links below it, e.g. “Sponsors”. Drag links under it to
                move them in.
              </p>
              <SectionForm
                initial=""
                submitLabel="Add section"
                isPending={isCreating}
                onSubmit={(label, reset) => addSection(label, reset)}
              />
            </EditPopover>
          </div>
        </div>

        <footer className={`py-6 text-center text-xs ${theme.footer}`}>Made with Kurz</footer>
      </div>
    </DragDropContext>
  );
}

function PopoverTitle({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-sm font-semibold">{children}</p>;
}

// Desktop: a popover next to the phone. Small screens have no room beside
// it, so the same settings open in a bottom sheet.
function EditPopover({
  opened,
  onClose,
  target,
  children,
  width = 300,
}: {
  opened: boolean;
  onClose: () => void;
  target: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const isDesktop = useMediaQuery('(min-width: 64em)', true, { getInitialValueInEffect: false });

  if (!isDesktop) {
    return (
      <>
        <div className="w-full sm:w-auto [&:has(>*.w-full)]:w-full">{target}</div>
        <Drawer
          opened={opened}
          onClose={onClose}
          position="bottom"
          radius="lg"
          withCloseButton={false}
          padding="lg"
          // Full width, as tall as its content (Mantine's size would make it full
          // height).
          styles={{ content: { flex: '0 0 auto', width: '100%', height: 'auto', maxHeight: '85vh' } }}
        >
          {children}
        </Drawer>
      </>
    );
  }

  return (
    <Popover
      opened={opened}
      onChange={open => !open && onClose()}
      width={width}
      position="left"
      withArrow
      shadow="lg"
      withinPortal
      trapFocus
      middlewares={{ flip: true, shift: true }}
    >
      <Popover.Target>
        <div className="w-full sm:w-auto [&:has(>*.w-full)]:w-full">{target}</div>
      </Popover.Target>
      <Popover.Dropdown>{children}</Popover.Dropdown>
    </Popover>
  );
}

// Clickable page element: outlined on hover/focus, dimmed when hidden,
// flagged when Safe Browsing hides it from visitors. Text styles go on an
// inner span: Mantine's global button reset (unlayered CSS) overrides
// Tailwind's typography utilities on the <button> itself.
function EditableTarget({
  item,
  onClick,
  className,
  label,
  children,
}: {
  item: PageLink;
  onClick: () => void;
  className: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative cursor-pointer outline-offset-2 transition hover:outline-2 hover:outline-dashed hover:outline-current focus-visible:outline-2 focus-visible:outline-current ${item.active ? '' : 'opacity-40'} ${item.safe ? '' : 'ring-2 ring-red-500'} ${className}`}
    >
      {children}
      {!item.active && (
        <IconEyeOff size={14} className="absolute top-1 right-1" aria-label="Hidden" />
      )}
      {!item.safe && (
        <IconAlertTriangle size={14} className="absolute top-1 left-1 text-red-500" aria-label="Flagged" />
      )}
    </button>
  );
}

function AddButton({
  onClick,
  className,
  subtle,
  children,
}: {
  onClick: () => void;
  className: string;
  subtle?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-current py-2.5 text-sm font-medium transition-opacity hover:opacity-100 ${subtle ? 'opacity-35' : 'opacity-60'} ${className}`}
    >
      <IconPlus size={16} />
      <span className="text-sm font-medium">{children}</span>
    </button>
  );
}

function ItemControls({
  item,
  onToggle,
  onDelete,
}: {
  item: PageLink;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
      <Switch
        size="sm"
        label="Visible on the page"
        checked={item.active}
        onChange={event => onToggle(event.currentTarget.checked)}
      />
      <Button
        variant="subtle"
        color="red"
        size="xs"
        leftSection={<IconTrash size={14} />}
        onClick={onDelete}
      >
        Delete
      </Button>
    </div>
  );
}

// Label + URL. With shortcuts, picking a network fills the label and the
// start of the URL so only the handle is left to type.
function LinkFields({
  initial,
  hideLabel,
  withShortcuts,
  submitLabel,
  isPending,
  onSubmit,
}: {
  initial: { label: string; url: string };
  hideLabel?: boolean;
  withShortcuts?: boolean;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (values: { label: string; url: string }, reset: () => void) => void;
}) {
  const urlRef = useRef<HTMLInputElement>(null);
  const form = useForm({
    mode: 'controlled',
    initialValues: initial,
    validate: zod4Resolver(hideLabel ? linkSchema.pick({ url: true }) : linkSchema),
  });

  function pick(network: SocialNetwork) {
    form.setValues({
      label: form.values.label || network.name,
      url: network.toUrl(''),
    });
    requestAnimationFrame(() => {
      const input = urlRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
  }

  return (
    <form onSubmit={form.onSubmit(values => onSubmit(values, () => form.reset()))}>
      {withShortcuts && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SOCIAL_NETWORKS.map(network => (
            <Tooltip key={network.id} label={network.name}>
              <ActionIcon variant="default" size="lg" onClick={() => pick(network)} aria-label={network.name}>
                <network.icon size={18} />
              </ActionIcon>
            </Tooltip>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {!hideLabel && (
          <TextInput
            label="Text on the button"
            placeholder="e.g. My shop"
            data-autofocus
            key={form.key('label')}
            {...form.getInputProps('label')}
          />
        )}
        <TextInput
          ref={urlRef}
          label="Link"
          placeholder="https://"
          data-autofocus={hideLabel || undefined}
          key={form.key('url')}
          {...form.getInputProps('url')}
        />
        <Button type="submit" fullWidth loading={isPending} color="brand">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function SectionForm({
  initial,
  submitLabel,
  isPending,
  onSubmit,
}: {
  initial: string;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (label: string, reset: () => void) => void;
}) {
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { label: initial },
    validate: zod4Resolver(sectionSchema),
  });

  return (
    <form
      onSubmit={form.onSubmit(values => onSubmit(values.label, () => form.reset()))}
      className="space-y-2"
    >
      <TextInput
        placeholder="e.g. Sponsors"
        data-autofocus
        key={form.key('label')}
        {...form.getInputProps('label')}
      />
      <Button type="submit" fullWidth loading={isPending} color="brand">
        {submitLabel}
      </Button>
    </form>
  );
}

// Pick a network, type the handle.
function SocialForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (data: { label: string; url: string; icon: string }, reset: () => void) => void;
}) {
  const [network, setNetwork] = useState<SocialNetwork>(SOCIAL_NETWORKS[0]);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidSocialValue(network, value)) {
      setError(
        network.id === 'whatsapp'
          ? 'Enter the phone number with country code'
          : `Enter your ${network.name} ${network.placeholder}`
      );
      return;
    }
    onSubmit(
      { label: network.name, url: socialLinkUrl(network, value), icon: network.id },
      () => setValue('')
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Network">
        {SOCIAL_NETWORKS.map(item => {
          const selected = item.id === network.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setNetwork(item);
                setError(undefined);
                inputRef.current?.focus();
              }}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-md border px-1 py-2 text-[10px] leading-tight transition-colors ${
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <item.icon size={18} />
              <span className="w-full truncate text-center">{item.name}</span>
            </button>
          );
        })}
      </div>
      <TextInput
        ref={inputRef}
        data-autofocus
        label={network.id === 'whatsapp' ? 'Phone number' : `${network.name} ${network.placeholder}`}
        placeholder={network.id === 'whatsapp' ? '+351 912 345 678' : `@${network.placeholder}`}
        value={value}
        error={error}
        onChange={event => {
          setValue(event.currentTarget.value);
          setError(undefined);
        }}
        description={`${network.prefix}…`}
      />
      <Button type="submit" fullWidth loading={isPending} color="brand">
        Add {network.name}
      </Button>
    </form>
  );
}
