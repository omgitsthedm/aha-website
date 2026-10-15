import { test, expect, type Page } from '@playwright/test';

const production = process.env.AHA_PRODUCTION_BUILD === 'approved';
const trackers = /https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net)\//;
async function capture(page: Page) {
  const requested: string[] = [];
  await page.route(trackers, async route => {
    requested.push(route.request().url());
    await route.fulfill({contentType:'application/javascript',body:''});
  });
  return requested;
}

test('optional trackers remain unloaded before a choice and after Essential only', async ({page}) => {
  const requested = await capture(page);
  await page.goto('/shop/yikes-crewneck/');
  await expect(page.getByRole('button',{name:'Essential only',exact:true})).toBeVisible();
  expect(requested).toEqual([]);
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  await page.reload();
  await expect(page.locator('.cookie-banner')).toBeHidden();
  expect(requested).toEqual([]);
});

test('Analytics only queues product events, strips unrelated query data, and can be withdrawn', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  const requested = await capture(page);
  await page.goto('/shop/yikes-crewneck/?email=private%40example.com&utm_source=test');
  await page.getByRole('button',{name:'Analytics only',exact:true}).click();
  await expect.poll(()=>requested.length).toBe(1);
  expect(requested[0]).toContain('G-S092LRTVRM');
  const queue = await page.evaluate(()=>window.dataLayer.map(v=>Array.from(v as ArrayLike<unknown>)));
  const config = queue.find(v=>v[0]==='config')?.[2] as {page_location:string};
  expect(config.page_location).toContain('utm_source=test');
  expect(config.page_location).not.toContain('email=');
  expect(queue.some(v=>v[0]==='event'&&v[1]==='view_item')).toBe(true);
  await page.getByRole('button',{name:'Cookie choices',exact:true}).click();
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  await expect(page.locator('.cookie-banner')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('aha-cookie-choices-v1')!))).toMatchObject({analytics:false,marketing:false});
  expect(requested).toHaveLength(1);
});

test('marketing consent queues only explicit product events; checkout click is not a purchase', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  const requested = await capture(page);
  await page.route('https://square.link/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Checkout navigation intercepted</h1>'}));
  await page.goto('/shop/yikes-cropped-hoodie/');
  await page.getByRole('button',{name:'Allow all',exact:true}).click();
  await expect.poll(()=>requested.length).toBe(2);
  const queue = await page.evaluate(()=>window.fbq?.queue);
  expect(queue).toContainEqual(['set','autoConfig',false,'1815233516346046']);
  expect(queue).toContainEqual(['track','PageView']);
  expect(queue?.some(v=>v[1]==='ViewContent')).toBe(true);
  expect(queue?.some(v=>v[1]==='Purchase')).toBe(false);
  // Prevent navigation only in this test so the outgoing event queues can be inspected.
  await page.locator('[data-checkout-link]').evaluate(el=>el.addEventListener('click',e=>e.preventDefault()));
  await page.locator('[data-checkout-link]').click();
  const after = await page.evaluate(()=>({meta:window.fbq?.queue,ga:window.dataLayer.map(v=>Array.from(v as ArrayLike<unknown>))}));
  expect(after.meta?.filter(v=>v[1]==='InitiateCheckout')).toHaveLength(1);
  expect(after.ga.filter(v=>v[1]==='begin_checkout')).toHaveLength(1);
  expect(JSON.stringify(after)).not.toContain('Purchase');
});

test('Global Privacy Control prevents Meta even when Allow all is chosen', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  const requested = await capture(page);
  await page.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
  await page.goto('/shop/yikes-crewneck/');
  await page.getByRole('button',{name:'Allow all',exact:true}).click();
  await expect.poll(()=>requested.length).toBe(1);
  expect(requested[0]).toContain('googletagmanager.com');
  expect(await page.evaluate(()=>Boolean(window.fbq))).toBe(false);
});
