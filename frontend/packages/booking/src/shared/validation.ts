import { z } from 'zod/v4';
import { timeoutInRange } from './duration-units.ts';
import { TIME } from './values.ts';

export type ValidationKey =
  | 'category_name_error'
  | 'err_exc_from'
  | 'err_exc_pending'
  | 'err_exc_range'
  | 'err_exc_times'
  | 'error_days'
  | 'error_duration'
  | 'error_extra_duration_repeated'
  | 'error_extra_price'
  | 'error_multiple_categories'
  | 'error_multiple_currency'
  | 'error_name'
  | 'error_price_currency'
  | 'error_time'
  | 'error_times'
  | 'error_timeout'
  | 'error_waitlist_timeout';

export type Translate = (key: ValidationKey) => string;

export type ScheduleInput = {
  days: string[];
  times: { value: string }[];
  byDay: Record<string, { value: string }[]>;
};

export type ItemInput = ScheduleInput & { ownSchedule: boolean };

export type ItemIssue = { message: string; path: PropertyKey[] };

export const requiredSchedule = (t: Translate) => ({
  days: z.array(z.string()).min(1, t('error_days')),
  times: z
    .array(z.object({ value: z.string().regex(TIME, t('error_time')) }))
    .min(1, t('error_times')),
  byDay: z.record(
    z.string(),
    z.array(z.object({ value: z.string().regex(TIME, t('error_time')) }))
  ),
});

export type ScheduleShape = ReturnType<typeof requiredSchedule>;

export const looseSchedule: ScheduleShape = {
  days: z.array(z.string()),
  times: z.array(z.object({ value: z.string() })),
  byDay: z.record(z.string(), z.array(z.object({ value: z.string() }))),
};

export const scheduleIssues = (
  { days, times, byDay }: ScheduleInput,
  t: Translate
): ItemIssue[] =>
  z
    .object(requiredSchedule(t))
    .safeParse({ days, times, byDay })
    .error?.issues.map(({ message, path }) => ({ message, path })) ?? [];

export type ModeValidation = {
  fields: (t: Translate) => z.ZodRawShape;
  schedule: (t: Translate) => ScheduleShape;
  itemIssues: (item: ItemInput, t: Translate) => ItemIssue[];
};

const duration = (t: Translate) =>
  z
    .number(t('error_duration'))
    .int()
    .min(5, t('error_duration'))
    .max(600, t('error_duration'));

const serviceSchema = (validation: ModeValidation, t: Translate) =>
  z
    .object({
      name: z.string().trim().min(1, t('error_name')).max(100),
      duration: duration(t),
      price: z.union([z.number().min(0), z.literal('')]),
      currency: z.string(),
      ownSchedule: z.boolean(),
      ...validation.schedule(t),
      extraDurations: z.array(
        z.object({
          duration: duration(t),
          price: z.union([z.number().min(0), z.literal('')]),
        })
      ),
      monthly: z.boolean(),
      monthlyPrice: z.union([z.number().min(0), z.literal('')]),
      monthlyDuration: z.union([
        z
          .number()
          .int()
          .min(5, t('error_duration'))
          .max(600, t('error_duration')),
        z.literal(''),
      ]),
    })
    .check(ctx => {
      const { duration, price, currency, monthly, monthlyPrice, extraDurations } =
        ctx.value;
      validation.itemIssues(ctx.value, t).forEach(issue =>
        ctx.issues.push({
          code: 'custom',
          message: issue.message,
          path: issue.path,
          input: ctx.value,
        })
      );
      const seen = new Set([duration]);
      extraDurations.forEach((extra, at) => {
        if (seen.has(extra.duration)) {
          ctx.issues.push({
            code: 'custom',
            message: t('error_extra_duration_repeated'),
            path: ['extraDurations', at, 'duration'],
            input: extra.duration,
          });
        }
        seen.add(extra.duration);
        if (price !== '' && extra.price === '') {
          ctx.issues.push({
            code: 'custom',
            message: t('error_extra_price'),
            path: ['extraDurations', at, 'price'],
            input: extra.price,
          });
        }
      });
      if (
        monthly &&
        monthlyPrice !== '' &&
        !/^[A-Za-z]{3}$/.test(currency.trim())
      ) {
        ctx.issues.push({
          code: 'custom',
          message: t('error_price_currency'),
          path: ['monthlyPrice'],
          input: monthlyPrice,
        });
      }
      if (price !== '' && !/^[A-Za-z]{3}$/.test(currency.trim())) {
        ctx.issues.push({
          code: 'custom',
          message: t('error_price_currency'),
          path: ['price'],
          input: price,
        });
      }
    });

const exceptionSchema = (t: Translate) =>
  z
    .object({
      kind: z.enum(['closed', 'special']),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('err_exc_from')),
      to: z.string(),
      times: z.array(z.object({ value: z.string() })),
    })
    .check(ctx => {
      const { kind, from, to, times } = ctx.value;
      if (to && from && to < from) {
        ctx.issues.push({
          code: 'custom',
          message: t('err_exc_range'),
          path: ['to'],
          input: to,
        });
      }
      if (kind === 'special' && !times.some(time => TIME.test(time.value))) {
        ctx.issues.push({
          code: 'custom',
          message: t('err_exc_times'),
          path: ['times'],
          input: times,
        });
      }
    });

export const bookingSchema = (validation: ModeValidation, t: Translate) =>
  z
    .object({
      ...validation.fields(t),
      label: z.string().trim().max(300),
      help: z.string().max(500),
      approval: z.enum(['auto', 'manual']),
      approval_timeout_minutes: z.union([z.number(), z.literal('')]),
      waitlist: z.boolean(),
      multiple_services: z.boolean(),
      waitlist_confirm_minutes: z.union([z.number(), z.literal('')]),
      approval_soon_only: z.boolean(),
      approval_within_minutes: z.union([z.number(), z.literal('')]),
      exceptionDraft: z.object({ from: z.string() }).loose(),
      exceptions: z.array(exceptionSchema(t)),
      services: z.array(serviceSchema(validation, t)),
    })
    .check(ctx => {
      const {
        approval,
        approval_soon_only: soonOnly,
        approval_within_minutes: within,
        approval_timeout_minutes: minutes,
        waitlist,
        waitlist_confirm_minutes: confirm,
        multiple_services: multiple,
        services,
        exceptionDraft,
      } = ctx.value;
      if (multiple) {
        const categories = (ctx.value as { categories?: unknown[] }).categories;
        if ((categories?.length ?? 0) >= 2) {
          ctx.issues.push({
            code: 'custom',
            message: t('error_multiple_categories'),
            path: ['multiple_services'],
            input: multiple,
          });
        }
        const priced = services.filter(service => service.price !== '');
        const first = priced[0]?.currency.trim().toUpperCase();
        services.forEach((service, at) => {
          if (
            service.price !== '' &&
            service.currency.trim().toUpperCase() !== first
          ) {
            ctx.issues.push({
              code: 'custom',
              message: t('error_multiple_currency'),
              path: ['services', at, 'price'],
              input: service.price,
            });
          }
        });
      }
      if (exceptionDraft.from) {
        ctx.issues.push({
          code: 'custom',
          message: t('err_exc_pending'),
          path: ['exceptionDraft', 'from'],
          input: exceptionDraft.from,
        });
      }
      if (approval === 'manual' && soonOnly && !timeoutInRange(within)) {
        ctx.issues.push({
          code: 'custom',
          message: t('error_timeout'),
          path: ['approval_within_minutes'],
          input: within,
        });
      }
      if (waitlist && !timeoutInRange(confirm, 15, 4320)) {
        ctx.issues.push({
          code: 'custom',
          message: t('error_waitlist_timeout'),
          path: ['waitlist_confirm_minutes'],
          input: confirm,
        });
      }
      if (approval === 'manual' && !timeoutInRange(minutes)) {
        ctx.issues.push({
          code: 'custom',
          message: t('error_timeout'),
          path: ['approval_timeout_minutes'],
          input: minutes,
        });
      }
    });
