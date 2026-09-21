// Demo screenshot driver: boots the vite dev server on a unique port, drives
// the dual-theme file-viewer demo in headless Chrome, and captures FIVE shots
// at 2x (D11 explorer semantics):
//  1. demo-file-viewer-explorer-root.png — the root FILES gallery: BOTH
//     panels land in the storage root with the three ownership pills
//     (ALL / OWNED BY ME / SHARED WITH ME) and the + NEW control (LEFT
//     GeoVision dark · en, RIGHT Lattice Light · zh-CN, set through the
//     per-instance controls);
//  2. demo-file-viewer-explorer-ownership.png — ownership filtering: LEFT
//     instance on SHARED WITH ME (only the shared folder + shared file
//     render), RIGHT instance on OWNED BY ME (zh 我拥有的);
//  3. demo-file-viewer-explorer-path.png — folder drill-down in BOTH panels:
//     LEFT two levels deep (breadcrumb NEXUS / VAULT / ALL FILES /
//     OPERATION REDWATER / EO IMAGERY — the root segment persists and the
//     path extends per entered folder), RIGHT one level deep (zh breadcrumb
//     NEXUS / 文件库 / 全部文件 / SUPPLY CORRIDOR);
//  4. demo-file-viewer-explorer-create.png — the + NEW menu open inside the
//     current folder (NEW FOLDER / NEW FILE (DOSSIER) — creation scoped to
//     the current path); after the shot both intents are fired and the
//     create-folder / create-file monitors show scopeId = the current folder;
//  5. demo-file-viewer-explorer-back.png — back-navigation through the
//     persistent ALL FILES breadcrumb segment (LEFT back at the root, the
//     viewerPath monitor shows scopeId: null) and an open-file intent from
//     the RIGHT instance's list rows (monitor shows the payload with the
//     containing scope).
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
  root: path.join(OUT_DIR, "demo-file-viewer-explorer-root.png"),
  ownership: path.join(OUT_DIR, "demo-file-viewer-explorer-ownership.png"),
  path: path.join(OUT_DIR, "demo-file-viewer-explorer-path.png"),
  create: path.join(OUT_DIR, "demo-file-viewer-explorer-create.png"),
  back: path.join(OUT_DIR, "demo-file-viewer-explorer-back.png"),
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

/** Clicks a testid inside one demo panel, throwing when it is missing. */
async function clickInPanel(page, panel, testid) {
  const selector = `[data-testid="${panel}"] [data-testid="${testid}"]`;
  await page.waitForSelector(selector);
  await page.click(selector);
}

/** Text of a testid inside one demo panel (null when absent). */
async function textInPanel(page, panel, testid) {
  return page.$eval(`[data-testid="${panel}"] [data-testid="${testid}"]`, (el) => el.textContent).catch(() => null);
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
  // the folder tiles plus one tile of every file kind in the LEFT instance,
  // and the three ownership pills + the + NEW control in both.
  await page.waitForSelector('[data-testid="demo-locale-stage"]');
  await page.waitForFunction(() => {
    const panels = document.querySelectorAll('[data-testid^="demo-viewer-panel-"]');
    const tiles = document.querySelectorAll('[data-testid^="demo-viewer-panel-"] [data-testid^="file-viewer-tile-"]');
    const pills = document.querySelectorAll('[data-testid^="demo-viewer-panel-"] [data-testid^="file-viewer-filter-"]');
    const newControl = document.querySelectorAll('[data-testid^="demo-viewer-panel-"] [data-testid="file-viewer-new"]');
    return (
      panels.length === 2 &&
      tiles.length >= 12 &&
      pills.length === 6 &&
      newControl.length === 2 &&
      document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-fld-redwater"]') !== null &&
      document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-doc-root-redwater-brief"]') !== null &&
      document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-brd-root-ac0052"]') !== null &&
      document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-wld-root-terminal-watch"]') !== null
    );
  });

  // Shot 1 — root view: users land in the storage root; the gallery renders
  // the root's folders + files of every kind with distinct icons; the three
  // ownership pills and the + NEW control are visible in both themes.
  await mkdir(OUT_DIR, { recursive: true });
  await capture(page, OUT_PATHS.root);

  // Ownership filtering (D11): LEFT → SHARED WITH ME, RIGHT → OWNED BY ME.
  // The mock tree carries mixed ownership, so the pills visibly re-scope the
  // rendered entries under the current path.
  await clickInPanel(page, "demo-viewer-panel-a", "file-viewer-filter-shared");
  await page.waitForFunction(() => {
    const panel = document.querySelector('[data-testid="demo-viewer-panel-a"]');
    const gallery = panel?.querySelector('[data-testid="file-viewer-gallery"]');
    const tiles = gallery?.querySelectorAll('[data-testid^="file-viewer-tile-"]');
    return (
      tiles?.length === 2 &&
      gallery?.querySelector('[data-testid="file-viewer-tile-fld-shared-analysis"]') != null &&
      gallery?.querySelector('[data-testid="file-viewer-tile-doc-root-joint-trade"]') != null
    );
  });
  await clickInPanel(page, "demo-viewer-panel-b", "file-viewer-filter-owned");
  await page.waitForFunction(() => {
    const gallery = document.querySelector(
      '[data-testid="demo-viewer-panel-b"] [data-testid="file-viewer-gallery"]',
    );
    return (
      gallery?.querySelectorAll('[data-testid^="file-viewer-tile-"]').length === 15 &&
      gallery?.querySelector('[data-testid="file-viewer-tile-fld-shared-analysis"]') == null
    );
  });

  // Shot 2 — ownership pills demonstrably scope the current-path listing.
  await capture(page, OUT_PATHS.ownership);
  await clickInPanel(page, "demo-viewer-panel-a", "file-viewer-filter-all");
  await clickInPanel(page, "demo-viewer-panel-b", "file-viewer-filter-all");

  // Drill-down in BOTH panels — the breadcrumb must always reflect the full
  // current path (D11): the persistent root segment ALL FILES stays and the
  // path extends one segment per entered folder.
  await clickInPanel(page, "demo-viewer-panel-a", "file-viewer-tile-fld-redwater");
  await page.waitForFunction(() => {
    const crumb = document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-crumb-current"]');
    return crumb !== null && crumb.textContent === "OPERATION REDWATER";
  });
  await page.waitForSelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-tile-fld-eo-imagery"]');
  await clickInPanel(page, "demo-viewer-panel-a", "file-viewer-tile-fld-eo-imagery");
  await page.waitForFunction(() => {
    const panel = document.querySelector('[data-testid="demo-viewer-panel-a"]');
    const current = panel?.querySelector('[data-testid="file-viewer-crumb-current"]')?.textContent;
    const root = panel?.querySelector('[data-testid="file-viewer-crumb-root"]')?.textContent;
    const ancestor = panel?.querySelector('[data-testid="file-viewer-crumb-0"]')?.textContent;
    return (
      current === "EO IMAGERY" && root === "ALL FILES" && ancestor === "OPERATION REDWATER" &&
      panel?.querySelector('[data-testid="file-viewer-tile-doc-redwater-overhead-14"]') != null
    );
  });
  await clickInPanel(page, "demo-viewer-panel-b", "file-viewer-tile-fld-supply-corridor");
  await page.waitForFunction(() => {
    const panel = document.querySelector('[data-testid="demo-viewer-panel-b"]');
    const current = panel?.querySelector('[data-testid="file-viewer-crumb-current"]')?.textContent;
    const root = panel?.querySelector('[data-testid="file-viewer-crumb-root"]')?.textContent;
    return (
      current === "SUPPLY CORRIDOR" && root === "全部文件" &&
      panel?.querySelector('[data-testid="file-viewer-tile-doc-convoy07"]') != null
    );
  });

  // Shot 3 — folder interior in both panels: breadcrumb extended beyond the
  // persistent root segment, gallery re-queried to the current path only.
  await capture(page, OUT_PATHS.path);

  // Create menu (D11): open + NEW inside the LEFT instance's current folder —
  // NEW FOLDER / NEW FILE (DOSSIER), both scoped to the current path.
  await clickInPanel(page, "demo-viewer-panel-a", "file-viewer-new");
  await page.waitForSelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-new-menu"]');
  await page.waitForFunction(() => {
    const menu = document.querySelector('[data-testid="demo-viewer-panel-a"] [data-testid="file-viewer-new-menu"]');
    return (
      menu?.querySelector('[data-testid="file-viewer-new-folder"]')?.textContent === "NEW FOLDER" &&
      menu?.querySelector('[data-testid="file-viewer-new-file"]')?.textContent === "NEW FILE (DOSSIER)"
    );
  });

  // Shot 4 — the create menu open with the extended breadcrumb behind it.
  await capture(page, OUT_PATHS.create);

  // Fire both creation intents from inside EO IMAGERY: the monitors show the
  // current path (fld-eo-imagery) as the parent of both creations.
  await clickInPanel(page, "demo-viewer-panel-a", "file-viewer-new-folder");
  await page.waitForFunction(() => {
    const monitor = document.querySelector('[data-testid="demo-create-folder"]');
    return monitor !== null && (monitor.textContent ?? "").includes("fld-eo-imagery");
  });
  await clickInPanel(page, "demo-viewer-panel-a", "file-viewer-new");
  await clickInPanel(page, "demo-viewer-panel-a", "file-viewer-new-file");
  await page.waitForFunction(() => {
    const monitor = document.querySelector('[data-testid="demo-create-file"]');
    return monitor !== null && (monitor.textContent ?? "").includes("fld-eo-imagery");
  });

  // Back-navigation through the persistent ALL FILES segment (LEFT back to
  // the root — viewerPath monitor shows scopeId: null) and an open-file
  // intent from the RIGHT instance's list rows (scopeId = the folder).
  await clickInPanel(page, "demo-viewer-panel-a", "file-viewer-crumb-root");
  await page.waitForFunction(() => {
    const panel = document.querySelector('[data-testid="demo-viewer-panel-a"]');
    const monitor = document.querySelector('[data-testid="demo-viewer-path"]');
    return (
      panel?.querySelector('[data-testid="file-viewer-crumb-current"]')?.textContent === "ALL FILES" &&
      panel?.querySelector('[data-testid="file-viewer-tile-fld-redwater"]') != null &&
      monitor !== null && (monitor.textContent ?? "").includes("scopeId: null")
    );
  });
  await clickInPanel(page, "demo-viewer-panel-b", "file-viewer-layout-list");
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('[data-testid="demo-viewer-panel-b"] [data-testid^="file-viewer-row-"]');
    return rows.length >= 4;
  });
  await clickInPanel(page, "demo-viewer-panel-b", "file-viewer-row-doc-convoy07");
  await page.waitForFunction(() => {
    const monitor = document.querySelector('[data-testid="demo-open-file"]');
    return monitor !== null && (monitor.textContent ?? "").includes("doc-convoy07");
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 400);
  });

  // Shot 5 — back at the root via the breadcrumb + open-file intent payload.
  await capture(page, OUT_PATHS.back);
} finally {
  if (browser !== undefined) {
    await browser.close().catch(() => undefined);
  }
  server.kill("SIGTERM");
}
