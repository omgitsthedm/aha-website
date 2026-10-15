import { test, expect } from '@playwright/test';

test('old checkout URLs recover current sizes and quantities, preserve attribution and keep Square selection explicit', async ({page}) => {
  await page.goto('/checkout?products=KEQN72Y22B5RL3V5NFVACNWQ%3A2%2C3CAFSZ345DL6VRX5CNBI6YDQ%3A2&utm_source=instagram&email=private');
  await expect(page.locator('.selection-line')).toHaveCount(2);
  await expect(page.locator('#selection-subtotal')).toHaveText('Selection subtotal: $214.00');
  await expect(page.locator('#selection-note')).toContainText('Select these sizes and quantities again at Square');
  await expect(page.locator('.selection-fallback')).toBeHidden();
  await page.getByRole('link', {name:'Open Yikes! Cropped Hoodie'}).click();
  await expect(page).toHaveURL(/size=2XL&quantity=2&utm_source=instagram$/);
  await expect(page.locator('#requested-size')).toContainText('size 2XL, quantity 2');
  await expect(page.locator('[data-checkout-link]')).toHaveAttribute('href', 'https://square.link/u/QxkM0Fkk');
});

test('untrusted coupon markup is text, retired selections are explained, and no cart is sent to a provider', async ({page}) => {
  const writes: string[] = [];
  page.on('request', request => { if (!['GET','HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.goto('/checkout/?products=retired%3A1&coupon=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
  await expect(page.locator('#selection-warning')).toBeVisible();
  await expect(page.locator('#selection-coupon')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#selection-coupon img')).toHaveCount(0);
  await expect(page.locator('.selection-fallback')).toBeVisible();
  await expect(page.locator('.selection-line')).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('recovery works at 320px and without JavaScript still offers both current products', async ({page,browser}) => {
  await page.setViewportSize({width:320,height:900});
  await page.goto('/checkout/?products=KEQN72Y22B5RL3V5NFVACNWQ%3A2');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const context = await browser.newContext({javaScriptEnabled:false});
  const fallback = await context.newPage();
  await fallback.goto(`${process.env.BASE_URL || 'http://127.0.0.1:48379'}/checkout/`);
  await expect(fallback.locator('.selection-fallback .product-card')).toHaveCount(2);
  await expect(fallback.locator('h1')).toHaveText('YOUR PICKS.');
  await context.close();
});
