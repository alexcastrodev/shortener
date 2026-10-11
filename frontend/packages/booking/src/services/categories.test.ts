import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankService } from '../shared/service.ts';
import { servicesMode } from './index.ts';
import { removeCategory, splitIntoCategories } from './categories.ts';

const twoServices = () => ({
  ...servicesMode.initialValues(),
  services: [blankService('A'), blankService('B')],
});

test('separating the services makes two categories and puts every service in the first', () => {
  const values = splitIntoCategories(twoServices(), ['Body', 'Face']);
  assert.deepEqual(
    values.categories.map(item => item.name),
    ['Body', 'Face']
  );
  assert.ok(values.categories.every(item => /^[A-Za-z0-9]{8}$/.test(item.id)));
  assert.ok(
    values.services.every(item => item.categoryId === values.categories[0].id)
  );
  const input = servicesMode.toBookingInput(values, false);
  assert.equal(input.categories!.length, 2);
  assert.ok(
    input.services!.every(item => item.category_id === values.categories[0].id)
  );
});

test('removing a category moves its services and never deletes one', () => {
  const split = splitIntoCategories(twoServices(), ['Body', 'Face']);
  const [body, face] = split.categories;
  const moved = removeCategory(
    {
      ...split,
      services: split.services.map((item, i) =>
        i === 1 ? { ...item, categoryId: face.id } : item
      ),
    },
    face.id,
    body.id
  );
  assert.equal(moved.services.length, 2);
  assert.ok(moved.services.every(item => item.categoryId === body.id));
  assert.deepEqual(moved.categories, [body]);
  assert.deepEqual(servicesMode.toBookingInput(moved, false).categories, []);
});

test('removing into a category that does not exist changes nothing', () => {
  const split = splitIntoCategories(servicesMode.initialValues(), [
    'Body',
    'Face',
  ]);
  assert.equal(removeCategory(split, split.categories[1].id, 'nope'), split);
});
