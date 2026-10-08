import { createForm, appointmentsOf, service } from '../support/forms.ts';
import { nextWeekdays } from '../support/dates.ts';
import { dayLabel } from '../support/calendar.ts';
import { expect, test } from '../support/fixtures.ts';
import {
  firstWeekdayOfNextMonth,
  monthLabel,
  PublicForm,
  shortDate,
  uniqueEmail,
} from '../support/public-form.ts';

const twoEmails = [{ label: 'E-mail' }, { label: 'E-mail do responsável' }];

test('page layout: the confirmation checkbox follows the e-mail values and ticks are exclusive', async ({ page }) => {
  const form = await createForm({ layout: 'page', emails: twoEmails, services: [service('Sessão'), service('Outra')], publish: true });
  const view = new PublicForm(page, form);
  const [day] = nextWeekdays(1);
  const first = uniqueEmail('um');
  const second = uniqueEmail('dois');

  await view.open();
  await expect(view.emailBox()).toBeVisible();
  await expect(view.confirmBoxes()).toHaveCount(0);

  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(first);
  await expect(view.confirmBoxes()).toHaveCount(1);
  await expect(view.confirmBoxes().first()).toBeChecked();

  await view.emailBox('E-mail do responsável').fill(second);
  await expect(view.confirmBoxes()).toHaveCount(2);
  await expect(view.confirmBoxes().first()).toBeChecked();
  await expect(view.confirmBoxes().last()).not.toBeChecked();

  await view.confirmBoxes().last().check();
  await expect(view.confirmBoxes().last()).toBeChecked();
  await expect(view.confirmBoxes().first()).not.toBeChecked();

  await view.confirmBoxes().last().uncheck();
  await expect(view.confirmBoxes().first()).not.toBeChecked();
  await expect(view.confirmBoxes().last()).not.toBeChecked();

  await view.confirmBoxes().first().check();
  await expect(view.confirmBoxes().last()).not.toBeChecked();

  await view.chooseService('Sessão');
  await view.pickSlot(day, '09:00');
  await expect(page.getByText('A sua marcação')).toBeVisible();
  await view.submit();

  await expect(page.getByRole('heading', { name: 'Obrigado' })).toBeVisible();
  await expect(view.receipt().getByText(/Também lha enviamos por e-mail/)).toBeVisible();
  await view.manageToken();

  const [appointment] = await appointmentsOf(form.id);
  expect(appointment.client_email).toBe(first);
});

test('one at a time: the address ticked on the second e-mail step wins and the tick survives navigation', async ({ page }) => {
  const form = await createForm({ layout: 'one_at_a_time', emails: twoEmails, services: [service('Sessão')], publish: true });
  const view = new PublicForm(page, form);
  const first = uniqueEmail('um');
  const second = uniqueEmail('dois');
  const next = page.getByRole('button', { name: 'Seguinte', exact: true });

  await view.open();
  await page.getByRole('button', { name: 'Começar', exact: true }).click();
  await expect(page.getByText('Pergunta 1 de 4')).toBeVisible();
  await view.nameBox().fill('Ana Teste');
  await next.click();

  await expect(page.getByText('Pergunta 2 de 4')).toBeVisible();
  await expect(view.confirmBoxes()).toHaveCount(0);
  await view.emailBox().fill(first);
  await expect(view.confirmBoxes()).toHaveCount(1);
  await expect(view.confirmBoxes()).toBeChecked();
  await next.click();

  await expect(page.getByText('Pergunta 3 de 4')).toBeVisible();
  await view.emailBox('E-mail do responsável').fill(second);
  await expect(view.confirmBoxes()).not.toBeChecked();
  await view.confirmBoxes().check();
  await expect(view.confirmBoxes()).toBeChecked();

  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByText('Pergunta 2 de 4')).toBeVisible();
  await expect(view.emailBox()).toHaveValue(first);
  await expect(view.confirmBoxes()).not.toBeChecked();
  await next.click();

  await expect(page.getByText('Pergunta 3 de 4')).toBeVisible();
  await expect(view.emailBox('E-mail do responsável')).toHaveValue(second);
  await expect(view.confirmBoxes()).toBeChecked();
  await next.click();

  await expect(page.getByText('Pergunta 4 de 4')).toBeVisible();
  await view.pickSlot(nextWeekdays(1)[0], '09:00');
  await view.submit();

  await expect(page.getByRole('heading', { name: 'Obrigado' })).toBeVisible();
  const appointments = await appointmentsOf(form.id);
  expect(appointments).toHaveLength(1);
  expect(appointments[0].client_email).toBe(second);
});

test('steps layout without sections: one page, the ticked address is stored', async ({ page }) => {
  const form = await createForm({ layout: 'steps', emails: twoEmails, services: [service('Sessão')], publish: true });
  const view = new PublicForm(page, form);
  const first = uniqueEmail('um');
  const second = uniqueEmail('dois');

  await view.open();
  await expect(page.getByRole('button', { name: 'Seguinte', exact: true })).toBeHidden();
  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(first);
  await expect(view.confirmBoxes().first()).toBeChecked();
  await view.emailBox('E-mail do responsável').fill(second);
  await view.confirmBoxes().last().check();
  await expect(view.confirmBoxes().first()).not.toBeChecked();
  await view.pickSlot(nextWeekdays(1)[0], '09:00');
  await view.submit();

  await expect(page.getByRole('heading', { name: 'Obrigado' })).toBeVisible();
  const [appointment] = await appointmentsOf(form.id);
  expect(appointment.client_email).toBe(second);
});

test('no address ticked: the receipt does not promise an e-mail and client_email stays empty', async ({ page }) => {
  const form = await createForm({ layout: 'page', emails: twoEmails, services: [service('Sessão')], publish: true });
  const view = new PublicForm(page, form);

  await view.open();
  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(uniqueEmail('um'));
  await expect(view.confirmBoxes()).toBeChecked();
  await view.confirmBoxes().uncheck();
  await expect(view.confirmBoxes()).not.toBeChecked();
  await view.pickSlot(nextWeekdays(1)[0], '09:00');
  await view.submit();

  await expect(page.getByRole('heading', { name: 'Obrigado' })).toBeVisible();
  await view.manageToken();
  await expect(view.receipt().getByText(/Também lha enviamos por e-mail/)).toBeHidden();
  await expect(view.receipt().getByText('Não será enviado nenhum e-mail, por isso guarde esta ligação.')).toBeVisible();

  const [appointment] = await appointmentsOf(form.id);
  expect(appointment.client_email).toBeNull();
});

test('calendar: month navigation keeps the chosen time in the summary', async ({ page }) => {
  const form = await createForm({ layout: 'page', services: [service('Sessão')], publish: true });
  const view = new PublicForm(page, form);
  const [today] = nextWeekdays(1);
  const target = firstWeekdayOfNextMonth();

  await view.open();
  await view.nameBox().fill('Ana Teste');
  await expect(page.getByText(monthLabel(today), { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mês anterior' })).toBeDisabled();

  await page.getByRole('button', { name: 'Mês seguinte' }).click();
  await expect(page.getByText(monthLabel(target), { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mês anterior' })).toBeEnabled();

  await page.getByRole('button', { name: dayLabel(target), exact: true }).click();
  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: `${shortDate(target)} · 10:00` })).toBeVisible();

  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await expect(page.getByText(monthLabel(today), { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: `${shortDate(target)} · 10:00` })).toBeVisible();

  await page.getByRole('button', { name: 'Mês seguinte' }).click();
  await expect(page.getByRole('button', { name: `${dayLabel(target)}, hora escolhida`, exact: true })).toBeVisible();

  await view.submit();
  await expect(page.getByRole('heading', { name: 'Obrigado' })).toBeVisible();
  const [appointment] = await appointmentsOf(form.id);
  expect(appointment.client_email).toBeNull();
});

test('typing a whole address in the first e-mail field keeps the focus after the checkbox appears', async ({ page }) => {
  const form = await createForm({ layout: 'page', emails: twoEmails, services: [service('Sessão')], publish: true });
  const view = new PublicForm(page, form);
  const address = uniqueEmail('maria.silva');

  await view.open();
  const box = view.emailBox();
  await box.click();
  await box.pressSequentially(address, { delay: 20 });

  await expect(box).toHaveValue(address);
  await expect(box).toBeFocused();
  await expect(view.confirmBoxes()).toHaveCount(1);
  await expect(view.confirmBoxes()).toBeChecked();
});

test('manual approval: the receipt asks for patience and the appointment is pending', async ({ page }) => {
  const form = await createForm({
    layout: 'page',
    emails: twoEmails,
    services: [service('Sessão')],
    rules: { approval: 'manual' },
    publish: true,
  });
  const view = new PublicForm(page, form);

  await view.open();
  await view.nameBox().fill('Ana Teste');
  await view.emailBox().fill(uniqueEmail('um'));
  await view.pickSlot(nextWeekdays(1)[0], '09:00');
  await view.submit();

  await expect(page.getByRole('heading', { name: 'Obrigado' })).toBeVisible();
  await expect(view.receipt().getByText('O seu pedido de marcação aguarda aprovação. Avisamos quando houver resposta.')).toBeVisible();
  await view.manageToken();

  const [appointment] = await appointmentsOf(form.id);
  expect(appointment.status).toBe('pending');
});

test('e-mail verification: no confirmation checkbox and the appointment is unverified', async ({ page }) => {
  const form = await createForm({
    layout: 'page',
    emails: [{ label: 'O seu e-mail', required: true }],
    services: [service('Sessão')],
    rules: { verify_email: true },
    publish: true,
  });
  const view = new PublicForm(page, form);
  const address = uniqueEmail('verificar');

  await view.open();
  await view.nameBox().fill('Ana Teste');
  await view.emailBox('O seu e-mail').fill(address);
  await expect(view.confirmBoxes()).toHaveCount(0);
  await view.pickSlot(nextWeekdays(1)[0], '09:00');
  await expect(view.confirmBoxes()).toHaveCount(0);
  await view.submit();

  await expect(page.getByRole('heading', { name: 'Obrigado' })).toBeVisible();
  await view.manageToken();
  await expect(view.receipt().getByText(/ainda não está confirmada/)).toBeVisible();
  await expect(view.receipt().getByText(/ligação para confirmar o endereço/)).toBeVisible();
  await expect(view.receipt().getByText(/Também lha enviamos por e-mail/)).toBeHidden();
  await expect(view.receipt().getByRole('link', { name: /Tem conta Kurz com este e-mail/ })).toBeVisible();
  await expect(view.receipt().getByText(/aguarda aprovação/)).toBeHidden();

  const [appointment] = await appointmentsOf(form.id);
  expect(appointment.status).toBe('unverified');
});

test('the two ways to book are equally wide and line up, also on a narrow screen', async ({ page }) => {
  const form = await createForm({
    services: [service('Sessão', { price: 120, currency: 'EUR', monthly: { price: 200 } })],
    publish: true,
  });
  const view = new PublicForm(page, form);
  await view.open();

  const days = page.getByRole('radio', { name: 'Escolher dias' });
  const monthly = page.getByRole('radio', { name: /Reserva fixa mensal/ });
  await expect(monthly).toContainText('200,00');

  const measure = async () => {
    const [first, second] = [await days.boundingBox(), await monthly.boundingBox()];
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    return { first: first!, second: second! };
  };

  let { first, second } = await measure();
  expect(Math.abs(first.width - second.width)).toBeLessThan(1);
  expect(Math.abs(first.y - second.y)).toBeLessThan(1);
  expect(Math.abs(first.height - second.height)).toBeLessThan(1);

  await page.setViewportSize({ width: 360, height: 800 });
  ({ first, second } = await measure());
  expect(Math.abs(first.width - second.width)).toBeLessThan(1);
  expect(Math.abs(first.x - second.x)).toBeLessThan(1);
});
