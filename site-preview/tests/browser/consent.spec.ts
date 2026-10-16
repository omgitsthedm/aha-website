import { test, expect, type Page } from '@playwright/test';

const production = process.env.AHA_PRODUCTION_BUILD === 'approved';
const trackers = /(?:https:\/\/www\.googletagmanager\.com\/|\/api\/partytown\/meta-pixel\/bootstrap(?:\?|$))/;
async function capture(page: Page) {
  const requested: string[] = [];
  await page.route(trackers, async route => {
    requested.push(route.request().url());
    await route.fulfill({contentType:'application/javascript',body:''});
  });
  return requested;
}
async function saveChoice(page: Page, choice: {analytics:boolean;marketing:boolean}) {
  await page.addInitScript((value) => { if (!localStorage.getItem('aha-cookie-choices-v1')) localStorage.setItem('aha-cookie-choices-v1', JSON.stringify({...value,at:Date.now()})); }, choice);
}

test('new visitors use the storefront default without a banner or synthetic saved choice', async ({page}) => {
  const requested = await capture(page);
  await page.goto('/shop/yikes-crewneck/');
  await expect(page.locator('.cookie-banner')).toBeHidden();
  expect(await page.evaluate(()=>localStorage.getItem('aha-cookie-choices-v1'))).toBeNull();
  if (!production) { expect(requested).toEqual([]); return; }
  await expect.poll(()=>requested.length).toBe(2);
  expect(requested).toEqual(expect.arrayContaining([expect.stringContaining('googletagmanager.com'),expect.stringContaining('/api/partytown/meta-pixel/bootstrap')]));
  const queue = await page.evaluate(()=>window.__ahaTrackingEvents);
  expect(queue?.ga.some(v=>v[0]==='event'&&v[1]==='view_item')).toBe(true);
  expect(queue?.meta?.some(v=>v[1]==='ViewContent')).toBe(true);
});

test('saved Essential only remains off and the footer exposes privacy controls', async ({page}) => {
  await saveChoice(page,{analytics:false,marketing:false});
  const requested = await capture(page);
  await page.goto('/shop/yikes-crewneck/');
  await expect(page.locator('.cookie-banner')).toBeHidden();
  expect(requested).toEqual([]);
  await page.getByRole('button',{name:'Privacy choices',exact:true}).click();
  await expect(page.locator('.cookie-banner')).toBeVisible();
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.cookie-banner')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('aha-cookie-choices-v1')!))).toMatchObject({analytics:false,marketing:false});
  expect(requested).toEqual([]);
});

test('an in-page Essential-only choice prevents deferred vendor SDK insertion when storage is blocked', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  await page.addInitScript(() => {
    const callbacks: Array<() => void> = [];
    Object.defineProperty(window, '__ahaIdleCallbacks', {configurable:true,value:callbacks});
    Object.defineProperty(window, 'requestIdleCallback', {configurable:true,value:(callback:()=>void) => { callbacks.push(callback); return callbacks.length; }});
    Object.defineProperty(Storage.prototype, 'setItem', {configurable:true,value:() => { throw new DOMException('Storage blocked'); }});
  });
  const requested = await capture(page);
  const posthog: string[] = [];
  await page.route(/\.i\.posthog\.com\//, async route => { posthog.push(route.request().url()); await route.fulfill({contentType:'application/javascript',body:''}); });
  await page.goto('/shop/yikes-crewneck/', {waitUntil:'domcontentloaded'});
  // GA4 and Meta always; PostHog too when the build carries its project key.
  const vendors = await page.evaluate(() => 2 + (document.querySelector('[data-posthog-key]')?.getAttribute('data-posthog-key') ? 1 : 0));
  await expect.poll(() => page.evaluate(() => (window as unknown as {__ahaIdleCallbacks?: unknown[]}).__ahaIdleCallbacks?.length || 0)).toBe(vendors);
  await page.getByRole('button',{name:'Privacy choices',exact:true}).click();
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  await page.evaluate(() => (window as unknown as {__ahaIdleCallbacks:Array<() => void>}).__ahaIdleCallbacks.splice(0).forEach(callback => callback()));
  await page.waitForTimeout(100);
  expect(requested).toEqual([]);
  expect(posthog).toEqual([]);
});

test('a storage-blocked opt-out and re-enable keeps a loaded Meta bridge instead of replacing it', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  await page.addInitScript(() => Object.defineProperty(Storage.prototype, 'setItem', {configurable:true,value:() => { throw new DOMException('Storage blocked'); }}));
  const requested = await capture(page);
  await page.goto('/shop/yikes-crewneck/');
  await expect.poll(()=>requested.length).toBe(2);
  await page.evaluate(() => {
    const calls: unknown[][] = [];
    const bridge = ((...args: unknown[]) => calls.push(args)) as NonNullable<typeof window.fbq>;
    bridge.callMethod = bridge;
    window.fbq = bridge;
    window._fbq = bridge;
    Object.assign(window, {__ahaMetaBridge:bridge,__ahaMetaCalls:calls});
  });
  await page.getByRole('button',{name:'Privacy choices',exact:true}).click();
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  await page.getByRole('button',{name:'Privacy choices',exact:true}).click();
  await page.getByRole('button',{name:'Allow all',exact:true}).click();
  const state = await page.evaluate(() => ({
    sameBridge: window.fbq === (window as unknown as {__ahaMetaBridge:unknown}).__ahaMetaBridge,
    calls: (window as unknown as {__ahaMetaCalls:unknown[][]}).__ahaMetaCalls,
  }));
  expect(state.sameBridge).toBe(true);
  expect(state.calls).toContainEqual(['consent','revoke']);
  expect(state.calls).toContainEqual(['consent','grant']);
  expect(state.calls.some(call=>call[0]==='track'&&call[1]==='PageView')).toBe(true);
  expect(requested).toHaveLength(2);
});

test('an Essential-only choice stays in effect when browser storage is blocked', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  await page.addInitScript(() => Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, value: () => { throw new DOMException('Storage blocked'); } }));
  const requested = await capture(page);
  await page.goto('/shop/yikes-crewneck/');
  await expect.poll(()=>requested.length).toBe(2);
  await page.getByRole('button',{name:'Privacy choices',exact:true}).click();
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  await expect(page.locator('.cookie-banner')).toBeHidden();
  expect(await page.evaluate(()=>localStorage.getItem('aha-cookie-choices-v1'))).toBeNull();
  const before = await page.evaluate(()=>({ga:window.__ahaTrackingEvents?.ga.filter(v=>v[1]==='begin_checkout').length||0,meta:window.__ahaTrackingEvents?.meta.filter(v=>v[1]==='InitiateCheckout').length||0}));
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('aha:checkout-quoted',{detail:{value:52,items:[{id:'R5UCZCGSJMR3Z4HJDVOD3ZIK',name:'Yikes! Crewneck',price:52,quantity:1}]}})));
  const after = await page.evaluate(()=>({ga:window.__ahaTrackingEvents?.ga.filter(v=>v[1]==='begin_checkout').length||0,meta:window.__ahaTrackingEvents?.meta.filter(v=>v[1]==='InitiateCheckout').length||0}));
  expect(after).toEqual(before);
});

test('saved Analytics only queues product events, strips unrelated query data, and can be withdrawn', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  await saveChoice(page,{analytics:true,marketing:false});
  const requested = await capture(page);
  await page.goto('/shop/yikes-crewneck/?email=private%40example.com&utm_source=test');
  await expect.poll(()=>requested.length).toBe(1);
  expect(requested[0]).toContain('G-S092LRTVRM');
  const queue = await page.evaluate(()=>window.__ahaTrackingEvents?.ga||[]);
  const config = queue.find(v=>v[0]==='config')?.[2] as {page_location:string};
  expect(config.page_location).toContain('utm_source=test');
  expect(config.page_location).not.toContain('email=');
  expect(queue.some(v=>v[0]==='event'&&v[1]==='view_item')).toBe(true);
  await page.getByRole('button',{name:'Privacy choices',exact:true}).click();
  await page.getByRole('button',{name:'Essential only',exact:true}).click();
  await page.waitForLoadState('domcontentloaded');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('aha-cookie-choices-v1')!))).toMatchObject({analytics:false,marketing:false});
  expect(requested).toHaveLength(1);
});

test('the default marketing setting queues only explicit product and quoted-checkout events; it never fabricates a purchase', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  const requested = await capture(page);
  await page.route('**/api/checkout/quote',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({checkoutId:'consent-quote',checkoutToken:'safe-token',expiresAt:'2030-01-01T00:00:00.000Z',currency:'USD',lineItems:[{variationId:'R5UCZCGSJMR3Z4HJDVOD3ZIK',quantity:1,unitAmount:5200,totalAmount:5200}],subtotalAmount:5200,shippingAmount:0,taxAmount:421,totalAmount:5621,shippingLabel:'Free domestic shipping'})}));
  await page.route('**/api/checkout/config',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({appId:'public-app',locationId:'location',countryCode:'US',currencyCode:'USD',methods:{card:false,applePay:false,googlePay:false,afterpay:false,cashAppPay:false}})}));
  await page.goto('/shop/yikes-cropped-hoodie/');
  await expect.poll(()=>requested.length).toBe(2);
  const queue = await page.evaluate(()=>window.__ahaTrackingEvents?.meta);
  expect(queue).toContainEqual(['set','autoConfig',false,'1815233516346046']);
  expect(queue).toContainEqual(['track','PageView']);
  expect(queue?.some(v=>v[1]==='ViewContent')).toBe(true);
  expect(queue?.some(v=>v[1]==='Purchase')).toBe(false);
  await page.getByRole('radio',{name:'M',exact:true}).check();
  await page.getByRole('button',{name:'Add to bag'}).click();
  const afterAdd = await page.evaluate(()=>({meta:window.__ahaTrackingEvents?.meta,ga:window.__ahaTrackingEvents?.ga}));
  expect(afterAdd.meta?.some(v=>v[1]==='InitiateCheckout')).toBe(false);
  await page.goto('/checkout/');
  await page.getByLabel('First name').fill('Avery');await page.getByLabel('Last name').fill('Tester');await page.getByLabel('Email').fill('avery@example.com');await page.getByLabel('Address').fill('1 N Central Ave');await page.getByLabel('City').fill('Phoenix');await page.getByLabel('State / province').fill('AZ');await page.getByLabel('Postal code').fill('85004');
  await page.getByRole('button',{name:'Confirm total'}).click();
  await expect.poll(async()=>page.evaluate(()=>window.__ahaTrackingEvents?.meta.filter(v=>v[1]==='InitiateCheckout').length||0)).toBe(1);
  const after = await page.evaluate(()=>({meta:window.__ahaTrackingEvents?.meta,ga:window.__ahaTrackingEvents?.ga}));
  expect(after.meta?.filter(v=>v[1]==='InitiateCheckout')).toHaveLength(1);
  expect(after.ga?.filter(v=>v[1]==='begin_checkout')).toHaveLength(1);
  expect(JSON.stringify(after)).not.toContain('Purchase');
});

test('Global Privacy Control prevents Meta under the default setting', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  const requested = await capture(page);
  await page.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
  await page.goto('/shop/yikes-crewneck/');
  await expect.poll(()=>requested.length).toBe(1);
  expect(requested[0]).toContain('googletagmanager.com');
  expect(requested.some(url=>url.includes('/api/partytown/meta-pixel/'))).toBe(false);
});

async function mockCheckoutCard(page: Page) {
  await page.addInitScript(() => {
    window.Square = { payments: () => ({ card: async () => ({ attach: async () => {}, tokenize: async () => ({ status: 'OK', token: 'opaque-test-token' }) }), paymentRequest: () => ({}) }) };
  });
}
async function fillCheckout(page: Page) {
  for (const [label, value] of [['First name','Avery'],['Last name','Tester'],['Email','avery@example.com'],['Address','1 N Central Ave'],['City','Phoenix'],['State / province','AZ'],['Postal code','85004']] as const) await page.getByLabel(label).fill(value);
}
const completedQuote={checkoutId:'tracking-quote',checkoutToken:'tracking-token',expiresAt:'2030-01-01T00:00:00.000Z',currency:'USD',lineItems:[{variationId:'R5UCZCGSJMR3Z4HJDVOD3ZIK',quantity:1,unitAmount:5200,totalAmount:5200}],subtotalAmount:5200,shippingAmount:0,taxAmount:421,totalAmount:5621,shippingLabel:'Free domestic shipping'};

async function mockCompletedCheckout(page: Page) {
  await page.route('**/api/checkout/config',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({appId:'public-app',locationId:'location',countryCode:'US',currencyCode:'USD',methods:{card:true,applePay:false,googlePay:false,afterpay:false,cashAppPay:false}})}));
  await page.route('**/api/checkout/quote',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(completedQuote)}));
  await page.route('**/api/checkout/pay',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({state:'completed',orderId:'AHA-tracking-1001',paymentId:'payment-test'})}));
}

test('default verified completion queues one GA4 and Meta Purchase with exact variant amounts and no contact data', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  await mockCheckoutCard(page);await mockCompletedCheckout(page);
  const requested=await capture(page);
  await page.goto('/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1');
  await expect.poll(()=>requested.length).toBe(2);
  await fillCheckout(page);
  await page.getByRole('button',{name:'Confirm total'}).click();
  await page.getByRole('button',{name:'Pay securely'}).click();
  await expect(page.locator('[data-checkout-message]')).toContainText('Payment confirmed');
  const events=await page.evaluate(()=>window.__ahaTrackingEvents);
  const ga=events?.ga.find(v=>v[0]==='event'&&v[1]==='purchase')?.[2] as {transaction_id:string;value:number;shipping:number;tax:number;items:Array<{item_id:string}>};
  expect(ga).toMatchObject({transaction_id:'AHA-tracking-1001',value:52,shipping:0,tax:4.21,items:[{item_id:'R5UCZCGSJMR3Z4HJDVOD3ZIK'}]});
  const meta=events?.meta?.find(v=>v[1]==='Purchase');
  expect(meta?.[2]).toMatchObject({content_ids:['R5UCZCGSJMR3Z4HJDVOD3ZIK'],content_type:'product',value:52,currency:'USD'});
  expect(meta?.[3]).toEqual({eventID:'AHA-tracking-1001'});
  expect(JSON.stringify(events)).not.toMatch(/Avery|Tester|avery@example\.com|1 N Central Ave|Phoenix/);
  await page.reload();
  const afterReload=await page.evaluate(()=>window.__ahaTrackingEvents?.ga.filter(v=>v[0]==='event'&&v[1]==='purchase'));
  expect(afterReload).toHaveLength(0);
});

test('saved Essential-only verified completion emits no GA4 or Meta Purchase', async ({page}) => {
  test.skip(!production, 'Production-only integrations stay disabled in preview.');
  await saveChoice(page,{analytics:false,marketing:false});
  await mockCheckoutCard(page);await mockCompletedCheckout(page);
  const requested=await capture(page);
  await page.goto('/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1');
  await fillCheckout(page);
  await page.getByRole('button',{name:'Confirm total'}).click();
  await page.getByRole('button',{name:'Pay securely'}).click();
  await expect(page.locator('[data-checkout-message]')).toContainText('Payment confirmed');
  expect(requested).toEqual([]);
  expect(await page.evaluate(()=>({ga:window.__ahaTrackingEvents?.ga.filter(v=>v[1]==='purchase')||[],meta:window.__ahaTrackingEvents?.meta.filter(v=>v[1]==='Purchase')||[]}))).toEqual({ga:[],meta:[]});
});
