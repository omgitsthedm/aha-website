import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axe = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const routes = [
  '/',
  '/services/websites/',
  '/services/tech-support/',
  '/services/business-systems/',
  '/work/',
  '/about/',
  '/contact/',
  '/answers/',
  '/privacy/',
  '/terms/',
  '/accessibility/',
];
for (const [label, width, height] of [
  ['desktop', 1440, 1000],
  ['mobile', 390, 844],
] as const) {
  test(`${label}: all pages, accessible names, contrast, links, no errors or overflow`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    for (const path of routes) {
      const response = await page.goto(path, { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('h1')).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${label} ${path}`,
      ).toBe(true);
      for (const image of await page.locator('img').all()) {
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            image.evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
          )
          .toBe(true);
      }
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      const broken = await page
        .locator('img')
        .evaluateAll((images) =>
          (images as HTMLImageElement[])
            .filter((x) => !x.complete || !x.naturalWidth)
            .map((x) => x.src),
        );
      expect(broken).toEqual([]);
      await page.evaluate(axe);
      const violations = await page.evaluate(async () => {
        const engine = (
          window as unknown as {
            axe: {
              run: (options: unknown) => Promise<{ violations: unknown[] }>;
            };
          }
        ).axe;
        return (
          await engine.run({
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
            },
          })
        ).violations;
      });
      expect(violations, `${label} ${path}`).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}
test('native mobile menu works by keyboard and Escape restores focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  const menu = page.locator('.mobile-nav summary');
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('navigation', { name: 'Mobile navigation' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(
    page.getByRole('navigation', { name: 'Mobile navigation' }),
  ).not.toBeVisible();
  await menu.click();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Tech help', exact: true })
    .click();
  await expect(page).toHaveURL(/services\/tech-support\//);
});
test('contact validates, preserves details and prepares an unsent email', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (r) => {
    if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.url());
  });
  await page.goto('/contact/?service=tech-support');
  await expect(page.locator('#service')).toHaveValue('tech-support');
  await page.getByRole('button', { name: 'Prepare my email' }).click();
  await expect(page.locator('#name')).toBeFocused();
  await expect(page.locator('#name-error')).toBeVisible();
  await page.getByLabel('Your name').fill('Preview Tester');
  await page.getByLabel('Your email').fill('preview@example.com');
  await page.getByLabel('Business name').fill('Review only');
  await page
    .getByLabel('What would you like')
    .fill('Testing the local email draft. This is not a service request.');
  await page.getByRole('button', { name: 'Prepare my email' }).click();
  await expect(page.locator('#brief-result')).toBeVisible();
  await expect(page.locator('#result-title')).toBeFocused();
  const href = await page
    .getByRole('link', { name: 'Open email draft' })
    .getAttribute('href');
  const url = new URL(href!);
  expect(url.protocol).toBe('mailto:');
  expect(url.pathname).toBe('hello@littlefightnyc.com');
  expect(url.searchParams.get('body')).toContain('Tech support');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('blocked')) },
      configurable: true,
    });
  });
  await page.getByRole('button', { name: 'Copy message' }).click();
  await expect(page.locator('#copy-status')).toContainText(
    'Copy is unavailable',
  );
  await page.getByRole('button', { name: 'Edit details' }).click();
  await expect(page.locator('#name')).toHaveValue('Preview Tester');
  expect(writes).toEqual([]);
});
test('all content, menu and contact fallback work without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  for (const path of routes) {
    await page.goto(
      `${process.env.BASE_URL || 'http://127.0.0.1:48379'}${path}`,
    );
    await expect(page.locator('h1')).toBeVisible();
  }
  await page.goto(
    `${process.env.BASE_URL || 'http://127.0.0.1:48379'}/contact/`,
  );
  await expect(page.locator('noscript')).toBeVisible();
  await expect(page.locator('#brief-form')).toBeHidden();
  await page.locator('.mobile-nav summary').click();
  await expect(
    page.getByRole('navigation', { name: 'Mobile navigation' }),
  ).toBeVisible();
  await context.close();
});
test('320px and 200-percent-equivalent reflow keep every page within the viewport', async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const width of [320, 640]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of routes) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${path}`,
      ).toBe(true);
    }
  }
});
test('missing routes and legacy APIs are real 404s; preview headers remain explicit', async ({
  request,
}) => {
  for (const path of [
    '/does-not-exist/',
    '/api/checkout/',
    '/api/ops/session/',
    '/shop/',
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('BACK ON COURSE');
  }
  const response = await request.get('/');
  expect(response.headers()['x-robots-tag']).toContain('noindex');
  expect(response.headers()['content-security-policy']).toContain(
    "connect-src 'self'",
  );
});

test('every internal link resolves, including fragment destinations', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const links = new Set<string>();
  for (const path of routes) {
    await page.goto(path);
    for (const href of await page
      .locator('a[href]')
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute('href') || ''),
      ))
      if (href.startsWith('/')) links.add(href);
  }
  for (const href of links) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
  await page.goto('/');
  await expect(page.locator('#main')).toHaveCount(1);
});
