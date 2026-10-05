import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconX } from '@tabler/icons-react';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';
import type {
  FormField,
  FormFieldInput,
  FormFieldType,
} from '@internal/core/types/Form';
import { fieldTypeLabel, isChoiceType } from '../../../modules/forms/field-types';

type ChoiceValue = { key: string; id?: string; label: string };

type Values = {
  label: string;
  help: string;
  required: boolean;
  scale: '5' | '10';
  min: number | '';
  max: number | '';
  max_choices: number | '';
  choices: ChoiceValue[];
};

const newKey = () => Math.random().toString(36).slice(2);

function initialValues(type: FormFieldType, field?: FormField): Values {
  const choices = field?.choices?.map(choice => ({ key: choice.id, ...choice }));
  return {
    label: field?.label ?? '',
    help: field?.help ?? '',
    required: field?.required ?? false,
    scale: field?.scale === 10 ? '10' : '5',
    min: field?.min ?? '',
    max: field?.max ?? '',
    max_choices: field?.max_choices ?? '',
    choices:
      choices ??
      (isChoiceType(type)
        ? [
            { key: newKey(), label: '' },
            { key: newKey(), label: '' },
          ]
        : []),
  };
}

function schemaFor(type: FormFieldType) {
  return z.object({
    label: z.string().trim().min(1, 'Write the question').max(300),
    help: z.string().max(500),
    choices: isChoiceType(type)
      ? z
          .array(z.object({ label: z.string().trim().min(1, 'Required').max(100) }))
          .min(2, 'Add at least 2 options')
      : z.array(z.any()),
  });
}

function toInput(type: FormFieldType, values: Values, creating: boolean): FormFieldInput {
  const input: FormFieldInput = {
    label: values.label.trim(),
    help: values.help.trim() || (creating ? undefined : null),
    required: type === 'section' ? false : values.required,
  };
  if (creating) input.type = type;

  if (isChoiceType(type)) {
    input.choices = values.choices.map(choice => ({
      ...(choice.id ? { id: choice.id } : {}),
      label: choice.label.trim(),
    }));
    if (type === 'multiple_choice') {
      const max = values.max_choices === '' ? null : values.max_choices;
      if (max !== null || !creating) input.max_choices = max;
    }
  }
  if (type === 'rating') input.scale = values.scale === '10' ? 10 : 5;
  if (type === 'number') {
    const min = values.min === '' ? null : values.min;
    const max = values.max === '' ? null : values.max;
    if (min !== null || !creating) input.min = min;
    if (max !== null || !creating) input.max = max;
  }
  return input;
}

export function QuestionEditor({
  type,
  field,
  loading,
  onSubmit,
  onCancel,
}: {
  type: FormFieldType;
  field?: FormField;
  loading: boolean;
  onSubmit: (input: FormFieldInput) => void;
  onCancel: () => void;
}) {
  const creating = !field;
  const form = useForm<Values>({
    mode: 'controlled',
    initialValues: initialValues(type, field),
    validate: zod4Resolver(schemaFor(type)),
  });

  return (
    <form onSubmit={form.onSubmit(values => onSubmit(toInput(type, values, creating)))}>
      <Stack gap="md">
        <p className="text-xs font-medium text-muted-foreground">
          {fieldTypeLabel(type)}
        </p>
        <TextInput
          label={type === 'section' ? 'Section title' : 'Question'}
          required
          data-autofocus
          {...form.getInputProps('label')}
        />
        <TextInput
          label={type === 'section' ? 'Description' : 'Help text'}
          description={
            type === 'section'
              ? 'Optional, shown under the title.'
              : 'Optional, shown under the question.'
          }
          {...form.getInputProps('help')}
        />
        {type !== 'section' && (
          <Switch
            label="Required"
            {...form.getInputProps('required', { type: 'checkbox' })}
          />
        )}

        {isChoiceType(type) && (
          <Stack gap="xs">
            <p className="text-sm font-medium">Options</p>
            {form.values.choices.map((choice, index) => (
              <Group key={choice.key} gap="xs" wrap="nowrap" align="flex-start">
                <TextInput
                  className="flex-1"
                  placeholder={`Option ${index + 1}`}
                  aria-label={`Option ${index + 1}`}
                  {...form.getInputProps(`choices.${index}.label`)}
                />
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label={`Remove option ${index + 1}`}
                  disabled={form.values.choices.length <= 2}
                  onClick={() => form.removeListItem('choices', index)}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            ))}
            {typeof form.errors.choices === 'string' && (
              <p className="text-xs text-red-500">{form.errors.choices}</p>
            )}
            <div>
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => form.insertListItem('choices', { key: newKey(), label: '' })}
              >
                Add option
              </Button>
            </div>
            {type === 'multiple_choice' && (
              <NumberInput
                label="Maximum selections"
                description="Leave empty to allow all."
                min={1}
                max={form.values.choices.length}
                allowDecimal={false}
                {...form.getInputProps('max_choices')}
              />
            )}
          </Stack>
        )}

        {type === 'rating' && (
          <div>
            <p className="mb-1 text-sm font-medium">Scale</p>
            <SegmentedControl
              data={[
                { value: '5', label: '1 to 5' },
                { value: '10', label: '1 to 10' },
              ]}
              value={form.values.scale}
              onChange={value => form.setFieldValue('scale', value as '5' | '10')}
            />
          </div>
        )}

        {type === 'number' && (
          <Group grow>
            <NumberInput label="Minimum" {...form.getInputProps('min')} />
            <NumberInput label="Maximum" {...form.getInputProps('max')} />
          </Group>
        )}

        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" color="brand" loading={loading}>
            {creating ? 'Add' : 'Save'} {type === 'section' ? 'section' : 'question'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
