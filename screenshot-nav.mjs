import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // Desktop with hover on Men
  const page1 = await context.newPage({ viewport: { width: 1440, height: 900 } });
  await page1.goto('https://afterhoursagenda.com?cb=' + Date.now());
  await page1.hover('text=Men');
  await page1.waitForTimeout(500);
  await page1.screenshot({ path: 'artifacts/desktop-dropdown.png' });
  await page1.close();
  
  // Mobile with menu open
  const page2 = await context.newPage({ viewport: { width: 390, height: 844 } });
  await page2.goto('https://afterhoursagenda.com?cb=' + Date.now());
  await page2.click('text=Menu');
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: 'artifacts/mobile-menu-open.png' });
  await page2.close();
  
  await browser.close();
})();
