import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const folder = new URL(
  "../../../screenshots/customer-buildout/",
  import.meta.url,
);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const records = [];
try {
  for (const [device, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    for (const [label, origin, paths] of [
      ["before", "https://afterhoursagenda.com", ["/shop/", "/contact/"]],
      [
        "after-local",
        "http://127.0.0.1:48379",
        [
          "/shop/",
          "/pieces/yikes/",
          "/contact/",
          "/updates/",
          "/size-guide/",
          "/track-order/",
        ],
      ],
    ]) {
      for (const path of paths) {
        await page.goto(origin + path, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        for (const img of await page.locator("img:visible").all())
          await img.scrollIntoViewIfNeeded();
        await page.evaluate(() => scrollTo(0, 0));
        const name =
          label +
          "-" +
          device +
          "-" +
          path.split("/").filter(Boolean).join("-") +
          ".png";
        await page.screenshot({
          path: fileURLToPath(new URL(name, folder)),
          fullPage: true,
        });
        records.push({ name, url: origin + path, width, height });
      }
    }
    await context.close();
  }
  await writeFile(
    new URL("capture-index.json", folder),
    JSON.stringify(records, null, 2),
  );
  console.log(
    "Captured " +
      records.length +
      " current before/after screens in installed Chrome.",
  );
} finally {
  await browser.close();
}
