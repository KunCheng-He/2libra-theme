import { build, context } from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");
const doZip = process.argv.includes("--zip");
const pexec = promisify(execFile);

/** 内容脚本：IIFE 单文件，css 走 text loader（shadow 内注入），host.css 文本引入 */
const contentOptions = {
  entryPoints: [path.join(root, "src/content/index.ts")],
  bundle: true,
  format: "iife",
  target: "chrome110",
  outfile: path.join(dist, "content.js"),
  loader: { ".css": "text" },
  legalComments: "none",
  minify: true,
  sourcemap: false,
  logLevel: "info",
};

/** background：ESM */
const backgroundOptions = {
  entryPoints: [path.join(root, "src/background/index.ts")],
  bundle: true,
  format: "esm",
  target: "chrome110",
  outfile: path.join(dist, "background.js"),
  legalComments: "none",
  minify: true,
  sourcemap: false,
  logLevel: "info",
};

/** popup：独立目录输出 */
const popupOptions = {
  entryPoints: [path.join(root, "src/popup/popup.ts")],
  bundle: true,
  format: "iife",
  target: "chrome110",
  outdir: path.join(dist, "popup"),
  loader: { ".css": "css" },
  legalComments: "none",
  minify: true,
  sourcemap: false,
  logLevel: "info",
};

async function copyStatics() {
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
  await cp(path.join(root, "src/popup/index.html"), path.join(dist, "popup/index.html"));
  await cp(path.join(root, "icons"), path.join(dist, "icons"), { recursive: true });
}

async function zip() {
  const pkg = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  const name = `2libra-theme-v${pkg.version}.zip`;
  await pexec("zip", ["-r", `-X`, `../${name}`, "."], { cwd: dist });
  console.log(`[zip] dist/${name}`);
}

if (watch) {
  const [ctxContent, ctxBg, ctxPopup] = await Promise.all([
    context(contentOptions),
    context(backgroundOptions),
    context(popupOptions),
  ]);
  await copyStatics();
  await Promise.all([ctxContent.watch(), ctxBg.watch(), ctxPopup.watch()]);
  console.log("[watch] esbuild watching…");
} else {
  await Promise.all([build(contentOptions), build(backgroundOptions), build(popupOptions)]);
  await copyStatics();
  if (doZip) await zip();
  console.log("[build] done → dist/");
}
