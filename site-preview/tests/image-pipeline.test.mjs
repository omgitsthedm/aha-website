import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { compose } from "../tools/images/compose.mjs";

test("composited print keeps the artwork's exact shape on a recolored blank", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "aha-compose-"));
  const art = path.join(directory, "art.png");
  // A ring: transparent center, opaque cream band.
  const size = 400;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const distance = Math.hypot(x - size / 2, y - size / 2);
    pixels.set([249, 229, 195, distance > 120 && distance < 180 ? 255 : 0], (y * size + x) * 4);
  }
  await sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).png().toFile(art);
  const result = await compose({ blank: "SS3000", color: "#5a1e2a", art, widthInches: 10, topInches: 3 });
  const { data, info } = await sharp(result.png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = result.printBox;
  const at = (x, y) => { const i = ((box.top + y) * info.width + box.left + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  const center = at(Math.round(box.width / 2), Math.round(box.height / 2));
  const band = at(Math.round(box.width / 2), Math.round(box.height * 0.125));
  assert.ok(center[0] < 140 && center[2] < 90, `center stays garment-colored: ${center}`);
  assert.ok(band[0] > 160 && band[1] > 140, `band shows the cream ink: ${band}`);
  assert.equal(box.width, 560);
});
