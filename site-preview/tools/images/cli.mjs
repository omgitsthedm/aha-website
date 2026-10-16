#!/usr/bin/env node
// AHA image pipeline. One JSON line on stdout; images never enter an agent's
// context — open the review page instead.
//
//   node tools/images/cli.mjs knockout --in art.png --bg "#713238" --ink "#F9E5C3" --out print.png
//   node tools/images/cli.mjs compose --product <slug> --blank SS3000 --color "#5b1d29" --art print.png --width 11 --top 3
//   node tools/images/cli.mjs qa --product <slug>
//   node tools/images/cli.mjs review --product <slug>            (serves a keyboard review page on :48378)
//   node tools/images/cli.mjs generate --product <slug> [--live]  (lifestyle shots; dry-run unless --live and a key)
//   node tools/images/cli.mjs export --product <slug>             (approved files, for `npm run catalog -- images`)
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { compose, detail, frame } from "./compose.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const productDir = (slug) => path.join(OUT, slug);
const manifestFile = (slug) => path.join(productDir(slug), "manifest.json");
const readManifest = (slug) => (existsSync(manifestFile(slug)) ? JSON.parse(readFileSync(manifestFile(slug), "utf8")) : { product: slug, images: [] });
const saveManifest = (slug, manifest) => { mkdirSync(productDir(slug), { recursive: true }); writeFileSync(manifestFile(slug), `${JSON.stringify(manifest, null, 2)}\n`); };
const hex = (value) => [0, 2, 4].map((offset) => parseInt(value.replace("#", "").slice(offset, offset + 2), 16));

// IPTC digital source types (Google Merchant Center reads these).
const SOURCE_TYPE = {
  composite: "http://cv.iptc.org/newscodes/digitalsourcetype/compositeSynthetic",
  generated: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
};
const xmp = (type) => `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"><Iptc4xmpExt:DigitalSourceType>${SOURCE_TYPE[type]}</Iptc4xmpExt:DigitalSourceType></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
const stamp = (buffer, type) => sharp(buffer).withXmp(xmp(type)).jpeg({ quality: 90 }).toBuffer();

function args(argv) {
  const out = { _: argv[0] };
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) { const key = argv[i].slice(2); out[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
  }
  return out;
}

const commands = {
  /** Single-ink artwork on a solid background → transparent print master. */
  async knockout(a) {
    const bg = hex(a.bg), ink = hex(a.ink);
    const { data, info } = await sharp(a.in).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.alloc(info.width * info.height * 4);
    const axis = ink.map((value, c) => value - bg[c]);
    const length = axis.reduce((sum, value) => sum + value * value, 0);
    for (let i = 0; i < info.width * info.height; i += 1) {
      const t = axis.reduce((sum, value, c) => sum + (data[i * 3 + c] - bg[c]) * value, 0) / length;
      const alpha = Math.min(Math.max((t - 0.08) / 0.84, 0), 1);
      out.set([...ink, Math.round(alpha * 255)], i * 4);
    }
    await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(a.out);
    return { out: a.out, width: info.width, height: info.height, ink: a.ink };
  },

  async compose(a) {
    const slug = a.product;
    const result = await compose({ blank: a.blank, view: a.view ?? "front", color: a.color, art: a.art, widthInches: Number(a.width), topInches: Number(a.top ?? 3) });
    mkdirSync(productDir(slug), { recursive: true });
    const files = {
      front: path.join(productDir(slug), "garment-front.jpg"),
      detail: path.join(productDir(slug), "garment-detail.jpg"),
    };
    writeFileSync(files.front, await stamp(await frame(result.png, result.crop), "composite"));
    writeFileSync(files.detail, await stamp(await detail(result.png, result.printBox), "composite"));
    writeFileSync(path.join(productDir(slug), "_full.png"), result.png);
    writeFileSync(path.join(productDir(slug), "_inkmask.json"), JSON.stringify({ printBox: result.printBox, art: path.resolve(a.art), width: result.width, height: result.height, blank: a.blank, color: a.color }));
    const manifest = readManifest(slug);
    manifest.images = manifest.images.filter((image) => !["front", "detail"].includes(image.role));
    manifest.images.push({ id: `${slug}-front`, role: "front", file: files.front, source: "composite" }, { id: `${slug}-detail`, role: "detail", file: files.detail, source: "composite" });
    saveManifest(slug, manifest);
    return { product: slug, images: 2, printBox: result.printBox, missing: ["back", "folded"].filter((role) => !manifest.images.some((image) => image.role === role)) };
  },

  /** QA: the composited print must match the art's shape exactly (IoU) and stay legible. */
  async qa(a) {
    const slug = a.product;
    const info = JSON.parse(readFileSync(path.join(productDir(slug), "_inkmask.json"), "utf8"));
    const box = info.printBox;
    const art = await sharp(info.art).ensureAlpha().resize({ width: box.width, height: box.height, fit: "fill" }).raw().toBuffer();
    const full = await sharp(path.join(productDir(slug), "_full.png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const garment = hex(info.color);
    let both = 0, either = 0;
    for (let y = 0; y < box.height; y += 2) {
      for (let x = 0; x < box.width; x += 2) {
        const px = box.left + x, py = box.top + y;
        if (px < 0 || py < 0 || px >= full.info.width || py >= full.info.height) continue;
        const expected = art[(y * box.width + x) * 4 + 3] > 128;
        const i = (py * full.info.width + px) * 3;
        const distance = Math.hypot(full.data[i] - garment[0], full.data[i + 1] - garment[1], full.data[i + 2] - garment[2]);
        const actual = distance > 60;
        if (expected && actual) both += 1;
        if (expected || actual) either += 1;
      }
    }
    const iou = either ? both / either : 0;
    const manifest = readManifest(slug);
    manifest.qa = { checkedAt: new Date().toISOString(), printShapeIoU: Number(iou.toFixed(3)), pass: iou >= 0.9 };
    saveManifest(slug, manifest);
    if (!manifest.qa.pass) { process.exitCode = 5; }
    return { product: slug, ...manifest.qa };
  },

  /** Keyboard review: A approve, R reject, ←/→ move. Decisions saved to decisions.json. */
  async review(a) {
    const slug = a.product;
    const manifest = readManifest(slug);
    const decisionsFile = path.join(productDir(slug), "decisions.json");
    const decisions = existsSync(decisionsFile) ? JSON.parse(readFileSync(decisionsFile, "utf8")) : {};
    const page = `<!doctype html><meta charset="utf-8"><title>Review ${slug}</title><style>body{font:16px/1.4 system-ui;margin:0;background:#fafafa;color:#1a1a1a}header{padding:12px 20px;border-bottom:1px solid #1a1a1a;display:flex;gap:16px;align-items:baseline}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;padding:20px}figure{margin:0;border:2px solid #b0b0b0;padding:8px;background:#fff}figure.on{border-color:#1a1a1a}figure.approved{outline:4px solid #2f7d4f}figure.rejected{outline:4px solid #ce3d56;opacity:.6}img{width:100%;height:auto;display:block}figcaption{font:12px ui-monospace,monospace;margin-top:6px}</style><header><strong>${slug}</strong><span>A approve · R reject · ←/→ move · QA print-shape IoU ${manifest.qa?.printShapeIoU ?? "not run"}</span></header><main>${manifest.images.map((image, index) => `<figure data-id="${image.id}" tabindex="0" class="${index === 0 ? "on " : ""}${decisions[image.id]?.status ?? ""}"><img src="/img/${encodeURIComponent(path.basename(image.file))}" alt="${image.role}"><figcaption>${image.role} · ${image.source} · <span>${decisions[image.id]?.status ?? "undecided"}</span></figcaption></figure>`).join("")}</main><script>let i=0;const f=[...document.querySelectorAll('figure')];const focus=()=>{f.forEach((x,j)=>x.classList.toggle('on',j===i));f[i]?.focus();};document.addEventListener('keydown',async e=>{if(e.key==='ArrowRight'){i=Math.min(i+1,f.length-1);focus();}if(e.key==='ArrowLeft'){i=Math.max(i-1,0);focus();}if(e.key==='a'||e.key==='r'){let reason='';if(e.key==='r'){reason=prompt('Reason (graphic altered, hands, posture, color, other)')||'';}const status=e.key==='a'?'approved':'rejected';await fetch('/decide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:f[i].dataset.id,status,reason})});f[i].classList.remove('approved','rejected');f[i].classList.add(status);f[i].querySelector('span').textContent=status;}});focus();</script>`;
    const server = createServer((request, response) => {
      if (request.method === "POST" && request.url === "/decide") {
        let body = "";
        request.on("data", (chunk) => { body += chunk; });
        request.on("end", () => {
          const { id, status, reason } = JSON.parse(body);
          if (!manifest.images.some((image) => image.id === id) || !["approved", "rejected"].includes(status)) { response.writeHead(400).end(); return; }
          decisions[id] = { status, reason: String(reason ?? "").slice(0, 200), at: new Date().toISOString() };
          writeFileSync(decisionsFile, `${JSON.stringify(decisions, null, 2)}\n`);
          response.writeHead(204).end();
        });
        return;
      }
      if (request.url?.startsWith("/img/")) {
        const name = decodeURIComponent(request.url.slice(5));
        const image = manifest.images.find((entry) => path.basename(entry.file) === name);
        if (!image) { response.writeHead(404).end(); return; }
        response.writeHead(200, { "content-type": "image/jpeg" }).end(readFileSync(image.file));
        return;
      }
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page);
    });
    await new Promise((resolve) => server.listen(48378, "127.0.0.1", resolve));
    process.stdout.write(`${JSON.stringify({ ok: true, command: "review", url: "http://127.0.0.1:48378/", decisions: path.relative(process.cwd(), decisionsFile) })}\n`);
    return null;
  },

  /** Lifestyle shots: builds the batch request; sends only with --live and a key. */
  async generate(a) {
    const slug = a.product;
    const manifest = readManifest(slug);
    const front = manifest.images.find((image) => image.role === "front");
    if (!front) throw new Error("Compose the front shot first; it is the reference for every lifestyle image.");
    const template = JSON.parse(readFileSync(path.join(HERE, "lifestyle-template.json"), "utf8"));
    const requests = template.shots.map((shot, index) => ({
      id: `${slug}-lifestyle-${index + 1}`,
      model: process.env.AHA_IMAGE_MODEL || "gpt-image-2",
      size: "1024x1280",
      n: 3,
      references: [front.file, ...(a.style ? [a.style] : [])],
      prompt: `${template.house} ${template.setting.replace("{setting}", a.setting ?? "a New York street at night")} ${shot}`,
    }));
    writeFileSync(path.join(productDir(slug), "lifestyle-requests.json"), `${JSON.stringify(requests, null, 2)}\n`);
    if (!a.live) return { product: slug, mode: "dry-run", requests: requests.length, file: path.relative(process.cwd(), path.join(productDir(slug), "lifestyle-requests.json")) };
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for --live.");
    let made = 0;
    for (const request of requests) {
      const form = new FormData();
      form.set("model", request.model); form.set("prompt", request.prompt); form.set("n", String(request.n)); form.set("size", request.size);
      for (const reference of request.references) form.append("image[]", new Blob([readFileSync(reference)], { type: "image/jpeg" }), path.basename(reference));
      const response = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(300_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(`Image API ${response.status}: ${data?.error?.message ?? "failed"}`);
      for (const [index, item] of (data.data ?? []).entries()) {
        const file = path.join(productDir(slug), `${request.id}-${index + 1}.jpg`);
        writeFileSync(file, await stamp(Buffer.from(item.b64_json, "base64"), "generated"));
        manifest.images.push({ id: `${request.id}-${index + 1}`, role: "lifestyle", file, source: "generated" });
        made += 1;
      }
    }
    saveManifest(slug, manifest);
    return { product: slug, mode: "live", made };
  },

  /** Approved images only, in gallery order, for `npm run catalog -- images`. */
  async export(a) {
    const slug = a.product;
    const manifest = readManifest(slug);
    const decisionsFile = path.join(productDir(slug), "decisions.json");
    const decisions = existsSync(decisionsFile) ? JSON.parse(readFileSync(decisionsFile, "utf8")) : {};
    const order = ["front", "back", "detail", "folded"];
    const approved = order.map((role) => manifest.images.find((image) => image.role === role && decisions[image.id]?.status === "approved")).filter(Boolean);
    const lifestyle = manifest.images.filter((image) => image.role === "lifestyle" && decisions[image.id]?.status === "approved");
    if (!approved.length) { process.exitCode = 5; return { product: slug, garment: [], message: "No approved garment images; run review first." }; }
    return { product: slug, garment: approved.map((image) => image.file), lifestyle: lifestyle.map((image) => image.file), next: `npm run catalog -- images ${slug} --files ${approved.map((image) => JSON.stringify(image.file)).join(" ")}` };
  },
};

const a = args(process.argv.slice(2));
const handler = commands[a._];
if (!handler) {
  process.stdout.write(`${JSON.stringify({ ok: false, message: `Commands: ${Object.keys(commands).join(", ")}` })}\n`);
  process.exitCode = 1;
} else {
  handler(a).then(
    (result) => { if (result) process.stdout.write(`${JSON.stringify({ ok: process.exitCode ? false : true, command: a._, ...result })}\n`); },
    (error) => { process.stdout.write(`${JSON.stringify({ ok: false, command: a._, message: error.message })}\n`); process.exitCode = 1; },
  );
}
