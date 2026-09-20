// Demo screenshot driver: boots the vite dev server on a unique port, drives
// the dual-theme file-viewer demo in headless Chrome, and captures THREE
// shots at 2x:
//  1. demo-file-viewer-root.png — the root FILES gallery (grid) with folders
//     AND individual files of every kind (distinct per-kind icons) in BOTH
//     themes and BOTH locales (LEFT GeoVision dark · en, RIGHT Lattice
//     Light · zh-CN, set through the per-instance controls);
//  2. demo-file-viewer-folder.png — folder drill-down in the LEFT instance
//     (breadcrumb extended two segments deep, gallery re-queried) with the
//     RIGHT instance switched to the LIST presentation through the Layout
//     Toggle (full-width rows);
//  3. demo-file-viewer-back-open.png — after back-navigation through the
//     breadcrumb's ancestor segments (LEFT instance back at the root; the
//     viewerPath monitor shows the reset segments) and a file row click in
//     the RIGHT instance (the open-file intent monitor shows the payload).
// The demo installs the mock Lattice executor on mount and seeds nothing on
// channels — the components fetch through the embedded clients (see
// src/demo.tsx). Demo-only tooling; not part of the published package.
import { spawn } from "node:child_process";
import { stat, mkdir } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const PORT = 4176;
// vite binds to localhost (IPv6 loopback first on macOS) — poll and navigate
// via localhost, not 127.0.0.1.
const BASE_URL = `http://localhost:${PORT}/`;
const OUT_DIR = "/tmp/guanlan-review";
const OUT_PATHS = {
  root: path.join(OUT_DIR, "demo-file-viewer-root.png"),
  folder: path.join(OUT_DIR, "demo-file-viewer-folder.png"),
  back: path.join(OUT_DIR, "demo-file-viewer-back-open.png"),
};
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIN_BYTES = 40_000;

function startDevServer() {
  const child = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  child.on("exit", (code) => {
    // 143 = SIGTERM from this script's cleanup; anything else is real.
    if (code !== null && code !== 0 && code !== 143) {
      process.stderr.write(`vite exited ${code}:\n${stderr}\n`);
    }
  });
  return child;
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) {
        return;
      }
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      throw new Error(`dev server at ${url} did not become ready in ${timeoutMs}ms`);
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }
}

/** Clicks the option ("EN" / "中文") of a Mantine SegmentedControl by testid. */
async function clickSegmentedOption(page, rootSelector, optionText) {
  const clicked = await page.evaluate(
    ({ rootSelector, optionText }) => {
      const root = document.querySelector(rootSelector);
      if (root === null) {
        return false;
      }
      const label = Array.from(root.querySelectorAll("label")).find(
        (candidate) => candidate.textContent?.trim() === optionText,
      );
      if (label === undefined) {
        return false;
      }
      label.click();
      return true;
    },
    { rootSelector, optionText },
  );
  if (!clicked) {
    throw new Error(`segmented option "${optionText}" not found in ${rootSelector}`);
  }
}

async function capture(page, outPath) {
  const pageRoot = await page.waitForSelector('[data-testid="demo-page"]');
  await pageRoot.screenshot({ path: outPath });
  const { size } = await stat(outPath);
  if (size < MIN_BYTES) {
    throw new Error(`screenshot ${outPath} is suspiciously small (${size} bytes)`);
  }
  console.log(`saved ${outPath} (${size} bytes)`);
}

const server = startDevServer();
let browser;
try {
  await waitForServer(BASE_URL, 30_000);
  browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1750, deviceScaleFactor: 2 });
  await page.goto(BASE_URL, { waitUntil: "networkidle0" });

  // Locale is a per-instance prop: LEFT (GeoVision dark) stays en, RIGHT
  // (Lattice Light) switches to zh-CN — both set through the per-instance
  // controls so the shots show two hosts rendering differing locales while
  // the GLOBAL switcher stays visible above.
  await page.waitForSelector('[data-testid="demo-locale-switcher"]');
  await clickSegmentedOption(page, '[data-testid="demo-instance-locale-a"]', "EN");
  await clickSegmentedOption(page, '[data-testid="demo-instance-locale-b"]', "中文");

  // Wait for BOTH galleries to finish their root children query and render
  // the folder tiles plus one tile of every file kind in the LEFT instance.
  await page.waitForSelector('[data-testid="demo-locale-stage"]');
  await page.waitForFunction(() => {
    const panels = document.querySelectorAll('[data-testid^="demo-viewer-panel-"]');
    const tiles = document.querySelectorAll('[data-testid^="demo-viewer-panel-"] [data-testid^="file-viewer-tile-"]');
    return (
      panels.length === 2 &&
      tiles.length >= 12 &&
      document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-fld-redwater"]') !== null &&
      document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-doc-root-redwater-brief"]') !== null &&
      document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-brd-root-ac0052"]') !== null &&
      document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-wld-root-terminal-watch"]') !== null
    );
  });

  // Shot 1 — root FILES gallery: both themes, both locales, folders + files
  // of every kind with distinct icons.
  await mkdir(OUT_DIR, { recursive: true });
  await capture(page, OUT_PATHS.root);

  // Drill into OPERATION REDWATER, then EO IMAGERY — the LEFT instance's
  // breadcrumb extends one segment per folder and the gallery re-queries the
  // folder's children through the embedded IFileEntry client.
  await page.click('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-fld-redwater"]');
  await page.waitForFunction(() => {
    const crumb = document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-crumb-current"]');
    return crumb !== null && crumb.textContent === "OPERATION REDWATER";
  });
  await page.waitForSelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-fld-eo-imagery"]');
  await page.click('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-fld-eo-imagery"]');
  await page.waitForFunction(() => {
    const crumb = document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-crumb-current"]');
    return crumb !== null && crumb.textContent === "EO IMAGERY";
  });
  await page.waitForSelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-doc-redwater-overhead-14"]');

  // Switch the RIGHT (zh-CN) instance to the LIST presentation through its
  // Layout Toggle — full-width scrolling rows.
  await page.click('[data-testid="demo-viewer-panel-b"] [data-testid="file-viewer-layout-list"]');
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('[data-testid="demo-viewer-panel-b"] [data-testid^="file-viewer-row-"]');
    return rows.length >= 8;
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 400);
  });

  // Shot 2 — folder drill-down (extended breadcrumb) + list presentation.
  await capture(page, OUT_PATHS.folder);

  // Back-navigation: the ancestor segment returns to OPERATION REDWATER
  // (that folder becomes current), then the VAULT area segment returns to
  // the root — the viewerPath monitor shows the segments collapsing.
  await page.click('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-crumb-0"]');
  await page.waitForFunction(() => {
    const crumb = document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-crumb-current"]');
    return crumb !== null && crumb.textContent === "OPERATION REDWATER";
  });
  await page.click('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-crumb-area"]');
  await page.waitForFunction(() => {
    const crumb = document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-crumb-current"]');
    return crumb !== null && crumb.textContent === "ALL FILES";
  });
  await page.waitForFunction(() => {
    const monitor = document.querySelector('[data-testid="demo-viewer-path"]');
    return monitor !== null && (monitor.textContent ?? "").includes("scopeId: null");
  });

  // Open a file from the RIGHT instance's list rows: the open-file intent
  // monitor shows the published payload.
  await page.click('[data-testid="demo-viewer-panel-b"] [data-testid="file-viewer-row-doc-root-redwater-brief"]');
  await page.waitForFunction(() => {
    const monitor = document.querySelector('[data-testid="demo-open-file"]');
    return monitor !== null && (monitor.textContent ?? "").includes("doc-root-redwater-brief");
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 400);
  });

  // Shot 3 — back at the root after breadcrumb navigation + open-file intent.
  await capture(page, OUT_PATHS.back);
} finally {
  if (browser !== undefined) {
    await browser.close().catch(() => undefined);
  }
  server.kill("SIGTERM");
}
