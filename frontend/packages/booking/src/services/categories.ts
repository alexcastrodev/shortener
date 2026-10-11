import type { Values } from '../shared/values.ts';

const ALPHANUMERIC =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const newCategoryId = () =>
  Array.from(
    { length: 8 },
    () => ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)]
  ).join('');

export const MAX_CATEGORIES = 10;

export const isGrouped = (values: Values) => values.categories.length >= 2;

export function splitIntoCategories(
  values: Values,
  names: [string, string]
): Values {
  if (isGrouped(values)) return values;
  const first = values.categories[0] ?? { id: newCategoryId(), name: names[0] };
  const second = { id: newCategoryId(), name: names[1] };
  return {
    ...values,
    categories: [first, second],
    services: values.services.map(service => ({
      ...service,
      categoryId: first.id,
    })),
  };
}

export function removeCategory(
  values: Values,
  id: string,
  moveTo: string
): Values {
  if (id === moveTo || !values.categories.some(item => item.id === moveTo)) {
    return values;
  }
  return {
    ...values,
    categories: values.categories.filter(item => item.id !== id),
    services: values.services.map(service =>
      service.categoryId === id ? { ...service, categoryId: moveTo } : service
    ),
  };
}
