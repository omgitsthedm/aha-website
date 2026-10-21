import { test, expect } from '@playwright/test';

test('garment order survives live publication, removal, filters and phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/catalog/live', route => route.fulfill({ json: {
    known: true, retired: ['after-hours-agenda-heritage-beanie-sp12-white'], retiredVariations: [], cartLines: [],
    products: [{ slug: 'new-test-tee', collection: 'New', card: '<article class="product-card" data-type="tees"><a href="/shop/new-test-tee/">New test tee</a></article>' }],
  } }));
  await page.goto('/shop/');
  await expect(page.locator('a[href="/shop/new-test-tee/"]')).toHaveCount(1);
  const types = await page.locator('[data-shop-grid] article.product-card:visible').evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.type));
  expect(types[0]).toBe('cropped-hoodies');
  expect(types.slice(1, 8)).toEqual(Array(7).fill('tees'));
  expect(types[8]).toBe('long-sleeves');
  await expect(page.locator('article.product-card').filter({ has: page.locator('a[href="/shop/after-hours-agenda-heritage-beanie-sp12-white/"]') })).toBeHidden();
  await page.getByRole('button', { name: 'Cropped hoodies', exact: true }).click();
  await expect(page.locator('article.product-card:visible')).toHaveCount(1);
  await page.getByRole('button', { name: 'T-shirts', exact: true }).click();
  await expect(page.locator('article.product-card:visible')).toHaveCount(7);
  await expect(page.locator('[data-shop-status]')).toHaveText('7 pieces');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the phone menu includes every garment style and links to the cropped hoodie', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shop/');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Shop by garment' });
  const crop = nav.getByRole('link', { name: /^Cropped hoodies/ });
  await expect(crop.locator('span')).toHaveText('1');
  const counts = await nav.locator('a span').allTextContents();
  expect(counts.slice(1).reduce((sum, count) => sum + Number(count), 0)).toBe(Number(counts[0]));
  await crop.click();
  await expect(page).toHaveURL(/\/shop\/\?type=cropped-hoodies$/);
  await expect(page.locator('article.product-card:visible')).toHaveCount(1);
});
