import { test, expect } from "@playwright/test";

// Local fixtures only: no administrator account or production order is touched.
test.skip(Boolean(process.env.BASE_URL), "admin monitoring fixtures run locally only");
for (const state of ["healthy", "attention", "stale"] as const) {
  test(`admin shows ${state} commerce monitoring truthfully on mobile`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseURL!).origin) return route.abort();
      if (url.pathname === "/api/admin/me") return route.fulfill({ json: { email: "owner@example.com" } });
      if (url.pathname === "/api/admin/overview") return route.fulfill({ json: {
        ordersToday: 0, ordersThisWeek: 0, ordersNeedingAttention: 0, draftsWaiting: 0, draftsApproved: 0,
        reports: { commerce_health: { ok: state !== "attention", createdAt: new Date(Date.now() - (state === "stale" ? 60 * 60_000 : 0)).toISOString(),
          summary: { problems: state === "attention" ? [{ code: "receipt_delivery_failed", count: 1 }] : [] } } },
      } });
      return route.continue();
    });
    await page.goto("/admin/");
    await expect(page.getByRole("heading", { name: "Order pipeline" })).toBeVisible();
    const expected = state === "stale" ? "The pipeline check is overdue" : state === "attention" ? "Needs attention" : "No stalled steps found";
    await expect(page.locator("[data-admin-health]")).toContainText(expected);
    if (state === "attention") await expect(page.locator("[data-admin-health]")).toContainText("receipt delivery failed: 1");
    if (state === "stale") await expect(page.locator("[data-admin-health]")).not.toContainText("No stalled steps found");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/admin-monitor-${state}.png`, fullPage: true });
  });
}

test('owner can review a support case and request a verified receipt on a phone',async({page,baseURL})=>{
 await page.setViewportSize({width:390,height:844});const requests:Array<Record<string,unknown>>=[];
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());if(url.origin!==new URL(baseURL!).origin)return route.abort();
  if(url.pathname==='/api/admin/me')return route.fulfill({json:{email:'owner@example.com'}});
  if(url.pathname==='/api/admin/support')return route.fulfill({json:{cases:[{id:'10000000-0000-4000-8000-000000000001',topic:'Receipt help',state:'open',customer_email:'verified@example.com',message_text:'I need my receipt.'}]}});
  if(url.pathname==='/api/admin/orders')return route.fulfill({json:{orders:[{squareOrderId:'local-order-123',orderNumber:'AHA-local',state:'submitted_processed',apliiqOrderId:'local-supplier',customer:'Fixture customer',totalCents:5200,createdAt:new Date().toISOString(),items:[{title:'Fixture garment',quantity:1,size:'XL'}],tracking:[],flags:[]}]}});
  if(url.pathname==='/api/admin/orders/local-order-123/receipt'){requests.push(route.request().postDataJSON());return route.fulfill({json:{message:'Receipt saved for delivery to the verified address.'}});}
  return route.continue();
 });
 page.on('dialog',dialog=>dialog.accept(dialog.type()==='prompt'?(dialog.message().startsWith('Record')?'Customer requested receipt':'verified@example.com'):undefined));
 await page.goto('/admin/orders/');await expect(page.getByText('I need my receipt.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Resend receipt',exact:true}).click();
 await expect.poll(()=>requests.length).toBe(1);expect(requests[0]).toMatchObject({email:'verified@example.com',customerVerified:true,reason:'Customer requested receipt'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/admin-orders-phone.png',fullPage:true});
});
