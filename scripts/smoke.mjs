// npm run smoke: launch the built desktop app, play through setup → hiring →
// newsroom → layout → press, and fail on any page error. Screenshots go to .tmp/smoke/.
import { mkdirSync } from 'node:fs';
import { _electron as electron } from 'playwright';

const out = '.tmp/smoke';
mkdirSync(out, { recursive: true });
const app = await electron.launch({ args: ['.'] });
const page = await app.firstWindow();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const step = async (name, fn) => {
  await fn();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}.png` });
  // The how-to-play guide is on by default: read the memo, then put it away.
  const memo = page.getByRole('button', { name: 'Got it' });
  if (await memo.count()) {
    tips++;
    await memo.click();
  }
};
let tips = 0;

await page.waitForLoadState('domcontentloaded');
await step('01-title', async () => {});
await step('02-setup', () => page.getByText('Upstart launches paper on a shoestring').click());
await step('03-hiring', () => page.getByRole('button', { name: /Approved/i }).click());
await step('03b-hired', async () => {
  for (const name of ['Rosa Okafor', 'Marty Kowalczyk', 'June Tran']) await page.getByRole('button', { name: new RegExp(name) }).first().click();
});
await step('04-newsroom', () => page.getByRole('button', { name: 'Open the newsroom' }).click());
await step('05-picked', async () => {
  const pick = page.getByRole('button', { name: 'For print', exact: true });
  while ((await pick.count()) > 0) await pick.first().click();
});
await step('06-layout', () => page.getByRole('button', { name: /To the layout/ }).click());

// Drag the first picked article onto the front page.
const slip = page.locator('[class*="slip_"]').first();
const sheet = page.locator('[class*="grid_"]').first();
const from = await slip.boundingBox();
const to = await sheet.boundingBox();
if (!from || !to) throw new Error('layout not found');
await page.mouse.move(from.x + from.width / 2, from.y + 20);
await page.mouse.down();
await page.mouse.move(from.x + from.width / 2 + 30, from.y + 40, { steps: 4 });
await page.mouse.move(to.x + to.width * 0.3, to.y + to.height * 0.22, { steps: 12 });
await page.mouse.up();
await step('07-placed', async () => {});
await step('08-results', () => page.getByRole('button', { name: 'Send to press' }).click());
await step('09-next', () => page.getByRole('button', { name: /Next issue/ }).click());
await step('10-staff', () => page.getByRole('button', { name: 'Staff', exact: true }).click());
await step('11-map', () => page.getByRole('button', { name: 'City map', exact: true }).click());
await step('12-district', () => page.locator('path[class*="district"]').nth(4).click({ force: true }));
await step('13-saved', () => page.getByRole('button', { name: 'Save', exact: true }).click());
await step('14-title', () => page.getByRole('button', { name: 'Menu', exact: true }).click());
await step('15-continue', () => page.getByText(/reaches issue 2/).click());

await app.close();
if (tips < 6) errors.push(`Expected a how-to-play memo on each screen, saw ${tips}`);
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`Smoke test passed. Screenshots in ${out}/`);
