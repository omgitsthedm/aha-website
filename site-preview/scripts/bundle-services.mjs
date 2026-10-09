import { build } from "esbuild";
import { readFile, mkdir, writeFile, readdir, cp } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "..");
await mkdir(resolve(app, ".server"), { recursive: true });
// Preserve every previously applied migration name and byte when the build base changes.
for (const entry of await readdir(
  resolve(root, "netlify/database/migrations"),
  { withFileTypes: true },
)) {
  await cp(
    resolve(root, "netlify/database/migrations", entry.name),
    resolve(app, "netlify/database/migrations", entry.name),
    { recursive: true },
  );
}
const external = [
  "@netlify/database",
  "@neondatabase/serverless",
  "drizzle-orm",
  "drizzle-orm/*",
  "web-push",
];
const result = await build({
  entryPoints: [resolve(app, "server/legacy-entry.mjs")],
  outfile: resolve(app, ".server/legacy.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  external,
  metafile: true,
  tsconfig: resolve(root, "tsconfig.json"),
  plugins: [
    {
      name: "portable-api",
      setup(build) {
        build.onResolve({ filter: /^next\/(server|cache)$/ }, () => ({
          path: resolve(app, "server/next-response.mjs"),
        }));
        build.onLoad({ filter: /lib\/data\/products\.ts$/ }, async (args) => {
          let source = await readFile(args.path, "utf8");
          const names = [
            "product-manifest.json",
            "square-map.json",
            "printful-v2-map.json",
            "apliiq-map.json",
            "size-guides.json",
          ];
          const imports = names
            .map(
              (name, i) =>
                `import data${i} from ${JSON.stringify(resolve(root, "data", name))};`,
            )
            .join("\n");
          source = source
            .replace('import { readFileSync } from "node:fs";', "")
            .replace('import { join } from "node:path";', "")
            .replace('const DATA_DIR = join(process.cwd(), "data");', "");
          source = source.replace(
            /function readJson<T>\(file: string\): T \{[\s\S]*?\n\}/,
            `function readJson<T>(file: string): T { return datasets[file] as T; }`,
          );
          return {
            contents:
              imports +
              "\nconst datasets: Record<string,unknown>={" +
              names
                .map((name, i) => JSON.stringify(name) + ":data" + i)
                .join(",") +
              "};\n" +
              source,
            loader: "ts",
            resolveDir: dirname(args.path),
          };
        });
        build.onLoad(
          { filter: /lib\/commerce\/apliiq-shipping-rates\.ts$/ },
          async (args) => {
            let source = await readFile(args.path, "utf8");
            source =
              "import bundledRates from " +
              JSON.stringify(resolve(root, "data/apliiq-shipping-rates.json")) +
              ";\n" +
              source;
            source = source.replace(
              'JSON.parse(readFileSync(RATES_FILE, "utf8")) as unknown',
              "bundledRates",
            );
            return {
              contents: source,
              loader: "ts",
              resolveDir: dirname(args.path),
            };
          },
        );
      },
    },
  ],
});
await writeFile(
  resolve(app, ".server/legacy.d.mts"),
  "export function legacyCheckoutOpen(): boolean; export function runLegacy(path: string, request: Request): Promise<Response>;\n",
);
await writeFile(
  resolve(app, ".server/bundle-inputs.json"),
  JSON.stringify(Object.keys(result.metafile.inputs).sort(), null, 2),
);
console.log(
  "Bundled preserved commerce services; " +
    Object.keys(result.metafile.inputs).length +
    " source inputs. No provider request.",
);
