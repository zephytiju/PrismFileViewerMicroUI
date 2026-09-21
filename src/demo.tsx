/**
 * Single-file demo host for the file-viewer micro-UI (vite dev entry, see
 * index.html).
 *
 * Everything demo-related lives here:
 *  - the two host themes (GeoVision VAULT dark + Lattice Light) mapping the
 *    SAME semantic token keys onto different palettes, proving the component
 *    ships no palette of its own;
 *  - the mock host executor (setPrismActionExecutor) serving the synthetic
 *    VAULT tree from the authoritative v9.3 prototype as IFileEntry listings
 *    (per-folder children queries — the gallery renders only the current
 *    path, D11) and ISearchable search results — the component itself never
 *    sees a URL or client, only the embedded generated clients over
 *    useLatticeTransport;
 *  - every piece of demo test data (the synthetic tree with MIXED ownership
 *    — some entries owned by the operator, some shared with them — plus
 *    folder taxonomy chips / meta lines as configuration callbacks);
 *  - the demo page: TWO FileViewer instances side by side, each inside its
 *    own MantineProvider with a different theme, plus an EN | 中文 language
 *    switcher — one GLOBAL control that drives every instance, and a
 *    per-instance control proving locale is a per-instance prop. Channel
 *    monitors below show the "vault.viewerPath" shared-slot publication, the
 *    "file-viewer.open-file" / "file-viewer.create-file" /
 *    "file-viewer.create-folder" intents, and the mock Lattice call log; a
 *    toggle makes the executor fail so the error-with-retry branch is
 *    demonstrable in both themes at once.
 */
import { useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import {
  Box,
  Button,
  createTheme,
  Divider,
  Group,
  MantineProvider,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { MantineThemeOverride } from "@mantine/core";
import { setPrismActionExecutor, usePrismEvent, usePrismStateValue } from "@zephytiju/prism-react";
import { FileViewer } from "./FileViewer.js";
import type {
  CreateFileIntent,
  CreateFolderIntent,
  OpenFileIntent,
  ViewerPath,
} from "./FileViewer.js";
import type { FileViewerLocale } from "./locales/index.js";
import "@mantine/core/styles.css";

// ---------------------------------------------------------------------------
// Themes — the HOST side of the theme contract.
//
// The component uses only semantic color tokens (ok / accent / threat / warn /
// signal / card / card-dark / input / border / line / text / muted / deep /
// panel); each theme maps every token onto a concrete palette. Every shade of
// every token is the same design color so any Mantine shade index resolves to
// the exact hex.
// ---------------------------------------------------------------------------

type ColorShades = [string, string, string, string, string, string, string, string, string, string];

const shades = (hex: string): ColorShades => [
  hex,
  hex,
  hex,
  hex,
  hex,
  hex,
  hex,
  hex,
  hex,
  hex,
];

/** GeoVision VAULT (dark) — the exact :root variables of the v9 prototype. */
export const geovisionTheme = createTheme({
  colors: {
    // v9 :root neutrals
    deep: shades("#07100F"), // --bg
    panel: shades("#000000"), // --panel-black
    card: shades("#111F1C"), // --card
    "card-dark": shades("#0B1514"), // --cdark
    input: shades("#162823"), // --inp
    border: shades("#29463E"), // --border
    line: shades("#44685B"), // --grid2
    text: shades("#E8F2ED"), // --text
    muted: shades("#86A098"), // --muted
    // v9 :root signal palette, exposed under semantic tokens
    ok: shades("#6FEEB3"), // --mint
    accent: shades("#62B3FF"), // --blue
    threat: shades("#FF6B5F"), // --red
    warn: shades("#E8B84B"), // --amber
    signal: shades("#A88BFF"), // --purple
  },
  primaryColor: "ok",
  fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono',ui-monospace,SFMono-Regular,monospace",
  defaultRadius: 4,
});

/**
 * Lattice Light (contrasting second host) — the SAME semantic token keys mapped
 * onto a light palette with system typography, proving a completely different
 * host can skin the component purely through MantineProvider.
 */
export const latticeLightTheme = createTheme({
  colors: {
    deep: shades("#EAF0EE"),
    panel: shades("#FFFFFF"),
    card: shades("#F2F6F4"),
    "card-dark": shades("#E7EEEB"),
    input: shades("#FBFDFC"),
    border: shades("#C3D2CC"),
    line: shades("#9DB4AB"),
    text: shades("#172925"),
    muted: shades("#5A6E67"),
    ok: shades("#0E7A52"),
    accent: shades("#1F6FE0"),
    threat: shades("#CE3F35"),
    warn: shades("#9A6E10"),
    signal: shades("#6E4FD8"),
  },
  primaryColor: "ok",
  fontFamily: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
  fontFamilyMonospace: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
  defaultRadius: 4,
});

// ---------------------------------------------------------------------------
// Demo test data — the synthetic VAULT tree from the authoritative v9.3
// prototype (vault-standalone.html), served as IFileEntry records. Ownership
// is MIXED (D11): some entries are owned by the operator, some shared with
// them, so the OWNED BY ME / SHARED WITH ME pills visibly scope the gallery.
// Folder taxonomy chips / meta lines ride along as host configuration
// callbacks keyed by entry id (mirrored by scripts/shot-demo.mjs).
// ---------------------------------------------------------------------------

interface DemoNode {
  readonly id: string;
  readonly name: string;
  readonly kind: "folder" | "dossier" | "board" | "world";
  readonly chip?: string;
  readonly meta?: string;
  /** Shared-with-the-operator flag (mock ownership; absent = owned). */
  readonly shared?: boolean;
  readonly sizeBytes?: number;
  readonly children?: readonly DemoNode[];
}

const DEMO_TREE: readonly DemoNode[] = [
  {
    id: "fld-redwater",
    name: "OPERATION REDWATER",
    kind: "folder",
    chip: "ACTIVE SET",
    meta: "12 ITEMS · 04:12Z",
    children: [
      {
        id: "fld-eo-imagery",
        name: "EO IMAGERY",
        kind: "folder",
        chip: "IMINT",
        meta: "08 ITEMS · 03:58Z",
        children: [
          { id: "doc-redwater-overhead-14", name: "Redwater Overhead Set 14", kind: "dossier", meta: "DOSSIER FILE · 6 BLOCKS", sizeBytes: 412_000 },
          { id: "wld-redwater-overhead", name: "Redwater Overhead View", kind: "world", meta: "GEOVISION FILE · SAVED STATE", sizeBytes: 1_204_000 },
        ],
      },
      {
        id: "fld-sigint-logs",
        name: "SIGINT LOGS",
        kind: "folder",
        chip: "SIGINT",
        meta: "05 ITEMS · 02:20Z",
        children: [{ id: "brd-sigint-watch", name: "SIGINT Watch Board", kind: "board", meta: "WORKFLOW BOARD · LATTICE", sizeBytes: 96_000 }],
      },
      { id: "doc-redwater-brief", name: "Redwater Corridor Brief", kind: "dossier", meta: "DOSSIER FILE · EDITED 4M AGO · 8 BLOCKS", sizeBytes: 388_000 },
      { id: "wld-redwater-watch", name: "Redwater Watch View", kind: "world", meta: "GEOVISION FILE · SAVED STATE · LIVE", sizeBytes: 1_542_000 },
      { id: "brd-wf014", name: "WF-014 Corridor Watch", kind: "board", meta: "WORKFLOW BOARD · LATTICE · 7 BLOCKS", sizeBytes: 121_000 },
      { id: "brd-ac0031", name: "AC-0031 Audit Chain", kind: "board", meta: "AUDIT BOARD · APPEND-ONLY · 12 ENTRIES", sizeBytes: 88_000 },
      { id: "doc-terminal-evidence", name: "Terminal Evidence Pack", kind: "dossier", meta: "EVIDENCE FILE · EDITED 2H AGO · 19 BLOCKS", sizeBytes: 927_000 },
    ],
  },
  {
    id: "fld-supply-corridor",
    name: "SUPPLY CORRIDOR",
    kind: "folder",
    chip: "LOGISTICS",
    meta: "09 ITEMS · 03:54Z",
    children: [
      {
        id: "fld-fuel-ledgers",
        name: "FUEL LEDGERS",
        kind: "folder",
        chip: "LOGISTICS",
        meta: "04 ITEMS · 01:44Z",
        children: [{ id: "doc-fuel-recon", name: "Fuel Reconciliation Brief", kind: "dossier", meta: "DOSSIER FILE · 5 BLOCKS", sizeBytes: 173_000 }],
      },
      { id: "doc-convoy07", name: "Convoy 07 Assessment", kind: "dossier", meta: "DOSSIER FILE · EDITED 5H AGO · 12 BLOCKS", sizeBytes: 501_000 },
      { id: "brd-route-risk", name: "Route Risk Board", kind: "board", meta: "WORKFLOW BOARD · LATTICE · 6 BLOCKS", sizeBytes: 102_000 },
      { id: "wld-corridor-transit", name: "Corridor Transit View", kind: "world", meta: "GEOVISION FILE · SAVED STATE", sizeBytes: 1_318_000 },
    ],
  },
  {
    id: "fld-northern-theater",
    name: "NORTHERN THEATER",
    kind: "folder",
    chip: "MILITARY",
    meta: "18 ITEMS · 03:31Z",
    children: [
      { id: "fld-order-of-battle", name: "ORDER OF BATTLE", kind: "folder", chip: "MILITARY", meta: "07 ITEMS · 02:58Z" },
      { id: "doc-northern-posture", name: "Northern Posture Brief", kind: "dossier", meta: "DOSSIER FILE · EDITED 3H AGO · 14 BLOCKS", sizeBytes: 640_000 },
      { id: "brd-nt-watch", name: "NT Watch Board", kind: "board", meta: "WORKFLOW BOARD · LATTICE · 9 BLOCKS", sizeBytes: 147_000 },
      { id: "wld-northern-overlay", name: "Northern Overlay View", kind: "world", meta: "GEOVISION FILE · SAVED STATE", sizeBytes: 1_096_000 },
    ],
  },
  {
    id: "fld-civil-impact",
    name: "CIVIL IMPACT",
    kind: "folder",
    chip: "SOCIETAL",
    meta: "08 ITEMS · 02:47Z",
    children: [
      { id: "doc-displacement", name: "Displacement Assessment", kind: "dossier", meta: "DOSSIER FILE · EDITED 6H AGO · 10 BLOCKS", sizeBytes: 455_000 },
      { id: "brd-civil-signals", name: "Civil Signals Board", kind: "board", meta: "WORKFLOW BOARD · LATTICE · 5 BLOCKS", sizeBytes: 84_000 },
    ],
  },
  {
    id: "fld-watch-reports",
    name: "WATCH REPORTS",
    kind: "folder",
    chip: "MONITORING",
    meta: "16 ITEMS · 01:18Z",
    children: [
      { id: "doc-daily-watch", name: "Daily Watch Summary", kind: "dossier", meta: "DOSSIER FILE · EDITED 1H AGO · 6 BLOCKS", sizeBytes: 233_000 },
      { id: "brd-watch-queue", name: "Watch Queue Board", kind: "board", meta: "WORKFLOW BOARD · LATTICE · 11 BLOCKS", sizeBytes: 168_000 },
    ],
  },
  {
    id: "fld-source-packs",
    name: "SOURCE PACKS",
    kind: "folder",
    chip: "EVIDENCE",
    meta: "31 ITEMS · 00:44Z",
    children: [
      { id: "fld-terminal-feeds", name: "TERMINAL FEEDS", kind: "folder", chip: "EVIDENCE", meta: "12 ITEMS · 00:31Z" },
      { id: "doc-terminal-evidence-2", name: "Terminal Evidence Pack", kind: "dossier", meta: "EVIDENCE FILE · EDITED 2H AGO · 19 BLOCKS", sizeBytes: 927_000 },
      { id: "doc-source-reliability", name: "Source Reliability Matrix", kind: "dossier", meta: "REFERENCE · 6 BLOCKS", sizeBytes: 129_000 },
    ],
  },
  {
    id: "fld-shared-analysis",
    name: "SHARED ANALYSIS",
    kind: "folder",
    chip: "COLLAB",
    meta: "06 ITEMS · YESTERDAY",
    shared: true,
    children: [
      { id: "doc-joint-corridor", name: "Joint Corridor Read", kind: "dossier", meta: "DOSSIER FILE · 9 BLOCKS", shared: true, sizeBytes: 344_000 },
      { id: "brd-partner-sync", name: "Partner Sync Board", kind: "board", meta: "WORKFLOW BOARD · LATTICE", shared: true, sizeBytes: 75_000 },
    ],
  },
  {
    id: "fld-archive-q3",
    name: "ARCHIVE / Q3",
    kind: "folder",
    chip: "ARCHIVE",
    meta: "24 ITEMS · 2D AGO",
    children: [
      { id: "doc-q3-closeout", name: "Q3 Closeout Brief", kind: "dossier", meta: "DOSSIER FILE · ARCHIVED · 15 BLOCKS", sizeBytes: 588_000 },
      { id: "wld-q3-baseline", name: "Q3 Baseline View", kind: "world", meta: "GEOVISION FILE · ARCHIVED", sizeBytes: 1_010_000 },
    ],
  },
  { id: "doc-root-redwater-brief", name: "Redwater Corridor Brief", kind: "dossier", meta: "DOSSIER FILE · EDITED 4M AGO · 8 BLOCKS", sizeBytes: 388_000 },
  { id: "brd-root-wf014", name: "WF-014 Corridor Watch", kind: "board", meta: "WORKFLOW BOARD · LATTICE · 7 BLOCKS", sizeBytes: 121_000 },
  { id: "wld-root-redwater-watch", name: "Redwater Watch View", kind: "world", meta: "GEOVISION FILE · SAVED STATE · LIVE", sizeBytes: 1_542_000 },
  { id: "doc-root-convoy07", name: "Convoy 07 Assessment", kind: "dossier", meta: "DOSSIER FILE · EDITED 5H AGO · 12 BLOCKS", sizeBytes: 501_000 },
  { id: "brd-root-ac0052", name: "AC-0052 Audit Chain", kind: "board", meta: "AUDIT BOARD · APPEND-ONLY · 8 ENTRIES", sizeBytes: 71_000 },
  { id: "doc-root-border-log", name: "Border Incident Log", kind: "dossier", meta: "DOSSIER FILE · EDITED 1H AGO · 9 BLOCKS", sizeBytes: 377_000 },
  { id: "wld-root-terminal-watch", name: "Terminal Surveillance View", kind: "world", meta: "GEOVISION FILE · SAVED STATE", sizeBytes: 1_402_000 },
  { id: "doc-root-source-reliability", name: "Source Reliability Matrix", kind: "dossier", meta: "REFERENCE · 6 BLOCKS", sizeBytes: 129_000 },
  { id: "doc-root-joint-trade", name: "Joint Trade Assessment", kind: "dossier", meta: "DOSSIER FILE · SHARED BY HQ · 7 BLOCKS", shared: true, sizeBytes: 298_000 },
];

const nodeById = new Map<string, DemoNode>();
const registerNodes = (nodes: readonly DemoNode[]): void => {
  for (const node of nodes) {
    nodeById.set(node.id, node);
    if (node.children !== undefined) {
      registerNodes(node.children);
    }
  }
};
registerNodes(DEMO_TREE);

const flattenTree = (nodes: readonly DemoNode[]): readonly DemoNode[] =>
  nodes.flatMap((node) => [node, ...(node.children !== undefined ? flattenTree(node.children) : [])]);

const toEntry = (node: DemoNode): { readonly id: string; readonly name: string; readonly kind: string; readonly sizeBytes: number } => ({
  id: node.id,
  name: node.name,
  kind: node.kind,
  sizeBytes: node.sizeBytes ?? 0,
});

// ---------------------------------------------------------------------------
// Mock Lattice call log — demo-only observable for the host executor.
// ---------------------------------------------------------------------------

interface LatticeCall {
  readonly route: string;
  readonly detail: string;
  readonly count: number;
}

let latticeLog: readonly LatticeCall[] = [];
const latticeLogListeners = new Set<() => void>();
let failing = false;
let searchCounter = 0;

function pushLatticeCall(call: LatticeCall): void {
  latticeLog = [call, ...latticeLog].slice(0, 6);
  for (const listener of latticeLogListeners) {
    listener();
  }
}

function subscribeLatticeLog(listener: () => void): () => void {
  latticeLogListeners.add(listener);
  return () => {
    latticeLogListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Mock host executor — serves the synthetic tree the way a host with a real
// Lattice runtime would (typed per-method routes). The component's embedded
// generated clients call these routes through useLatticeTransport.
// ---------------------------------------------------------------------------

async function demoExecutor(request: { readonly route: string; readonly arguments: unknown }): Promise<unknown> {
  if (request.route === "interfaces/IFileEntry/list") {
    const args = (request.arguments ?? {}) as { readonly scope?: string };
    if (failing) {
      throw new Error("Simulated Lattice failure (IFileEntry.list)");
    }
    const scope = args.scope ?? null;
    let children: readonly DemoNode[];
    let detail: string;
    if (scope === null) {
      children = DEMO_TREE;
      detail = "default scope";
    } else {
      const folder = nodeById.get(scope);
      if (folder === undefined || folder.kind !== "folder") {
        throw new Error(`demo executor: scope "${scope}" is not a known folder`);
      }
      children = folder.children ?? [];
      detail = folder.name;
    }
    const entries = children.map(toEntry);
    pushLatticeCall({ route: "IFileEntry.list", detail: `${detail} → ${String(entries.length)} entries`, count: entries.length });
    return { entries };
  }
  if (request.route === "interfaces/ISearchable/search") {
    const args = (request.arguments ?? {}) as { readonly query?: string };
    if (failing) {
      throw new Error("Simulated Lattice failure (ISearchable.search)");
    }
    const query = (args.query ?? "").trim().toUpperCase();
    const matches = flattenTree(DEMO_TREE).filter((node) => node.name.toUpperCase().includes(query));
    searchCounter += 1;
    pushLatticeCall({
      route: "ISearchable.search",
      detail: `"${args.query ?? ""}" → ${String(matches.length)} matches`,
      count: matches.length,
    });
    return {
      queryRef: `demo-search-${String(searchCounter)}`,
      resultIds: matches.map((node) => node.id),
      items: matches.map((node) => ({ id: node.id, type: node.kind, label: node.name })),
    };
  }
  throw new Error(`demo executor: no handler for route ${request.route}`);
}

/** Installs the mock executor for the demo's lifetime. */
export function installDemoExecutor(): () => void {
  setPrismActionExecutor(demoExecutor);
  return () => {
    setPrismActionExecutor(null);
  };
}

/** Toggles the simulated Lattice failure (demonstrates the error + retry branch). */
export function toggleDemoFailure(): boolean {
  failing = !failing;
  return failing;
}

// ---------------------------------------------------------------------------
// Host configuration callbacks — folder taxonomy chips, per-entry meta lines,
// and the ownership classes, keyed by entry id (the demo's ontology
// taxonomy). The bounded FileEntrySummary projection of IFileEntry carries
// no owner/shared fields, so ownership comes from this host callback — the
// mock marks some entries shared-with-the-operator, the rest owned (D11).
// ---------------------------------------------------------------------------

const demoChip = (entry: { readonly id: string }): string | undefined => nodeById.get(entry.id)?.chip;
const demoMeta = (entry: { readonly id: string }): string | undefined => nodeById.get(entry.id)?.meta;
const demoOwnership = (entry: { readonly id: string }): "owned" | "shared" =>
  nodeById.get(entry.id)?.shared === true ? "shared" : "owned";

const demoFileViewerProps = {
  pageSize: 50,
  galleryMaxHeight: 800,
  chip: demoChip,
  meta: demoMeta,
  ownershipOf: demoOwnership,
};

// ---------------------------------------------------------------------------
// Demo page — two themed FileViewer instances + channel monitors.
// ---------------------------------------------------------------------------

const MONO = "var(--mantine-font-family-monospace)";

/** Segmented-control options shared by the global and per-instance switchers. */
const localeOptions = [
  { value: "en", label: "EN" },
  { value: "zh-CN", label: "中文" },
];

/** Monitor for the bounded-context shared slot the component PUBLISHES. */
function ViewerPathMonitor() {
  const viewerPath = usePrismStateValue<ViewerPath | null>("vault.viewerPath");
  return (
    <Stack gap={4} miw={0}>
      <Text size="sm" fw={600} c="var(--mantine-color-text-filled)">
        vault.viewerPath (published shared slot — most recent navigation)
      </Text>
      <Text size="sm" c="var(--mantine-color-muted-filled)" data-testid="demo-viewer-path">
        {viewerPath === null
          ? "null"
          : `scopeId: ${viewerPath.scopeId ?? "null"} · segments: ${
              viewerPath.segments.length === 0
                ? "[]"
                : viewerPath.segments.map((segment) => segment.name).join(" / ")
            }`}
      </Text>
    </Stack>
  );
}

/** Monitor for the open-file intent (last payload wins). */
function OpenFileMonitor() {
  const [last, setLast] = useState<OpenFileIntent | null>(null);
  usePrismEvent("file-viewer.open-file", (payload) => {
    setLast(payload as OpenFileIntent);
  });
  return (
    <Stack gap={4} miw={0}>
      <Text size="sm" fw={600} c="var(--mantine-color-text-filled)">
        file-viewer.open-file (intent — last payload)
      </Text>
      <Text size="sm" c="var(--mantine-color-muted-filled)" data-testid="demo-open-file">
        {last === null ? "null" : JSON.stringify(last)}
      </Text>
    </Stack>
  );
}

/** Monitor for the + NEW → NEW FILE creation intent (last payload wins). */
function CreateFileMonitor() {
  const [last, setLast] = useState<CreateFileIntent | null>(null);
  usePrismEvent("file-viewer.create-file", (payload) => {
    setLast(payload as CreateFileIntent);
  });
  return (
    <Stack gap={4} miw={0}>
      <Text size="sm" fw={600} c="var(--mantine-color-text-filled)">
        file-viewer.create-file (intent — last payload)
      </Text>
      <Text size="sm" c="var(--mantine-color-muted-filled)" data-testid="demo-create-file">
        {last === null ? "null" : JSON.stringify(last)}
      </Text>
    </Stack>
  );
}

/** Monitor for the + NEW → NEW FOLDER creation intent (last payload wins). */
function CreateFolderMonitor() {
  const [last, setLast] = useState<CreateFolderIntent | null>(null);
  usePrismEvent("file-viewer.create-folder", (payload) => {
    setLast(payload as CreateFolderIntent);
  });
  return (
    <Stack gap={4} miw={0}>
      <Text size="sm" fw={600} c="var(--mantine-color-text-filled)">
        file-viewer.create-folder (intent — last payload)
      </Text>
      <Text size="sm" c="var(--mantine-color-muted-filled)" data-testid="demo-create-folder">
        {last === null ? "null" : JSON.stringify(last)}
      </Text>
    </Stack>
  );
}

/** Monitor for the mock Lattice call log (children queries + searches). */
function LatticeLogMonitor() {
  const log = useSyncExternalStore(
    subscribeLatticeLog,
    () => latticeLog,
    () => latticeLog,
  );
  return (
    <Stack gap={4} miw={0}>
      <Text size="sm" fw={600} c="var(--mantine-color-text-filled)">
        mock Lattice call log (embedded clients — newest first)
      </Text>
      <Stack gap={2} data-testid="demo-lattice-log">
        {log.length === 0 ? (
          <Text size="sm" c="var(--mantine-color-muted-filled)">
            no calls yet
          </Text>
        ) : (
          log.map((call, index) => (
            <Text key={`${call.route}-${String(index)}`} ff={MONO} fz={10} c="var(--mantine-color-muted-filled)">
              {call.route} · {call.detail}
            </Text>
          ))
        )}
      </Stack>
    </Stack>
  );
}

/**
 * One FileViewer instance inside its OWN scoped MantineProvider.
 *
 * Mantine emits theme CSS variables as `cssVariablesSelector { … }` style tags
 * (default selector ":root", i.e. global), so two nested providers would fight:
 * the last-mounted theme would win document-wide. Each instance provider is
 * therefore scoped to a wrapper class (cssVariablesSelector) and its
 * forceColorScheme attribute is written to that same wrapper (getRootElement),
 * keeping both palettes live side by side.
 */
interface ThemedInstanceProps {
  readonly theme: MantineThemeOverride;
  readonly colorScheme: "dark" | "light";
  readonly scopeClass: string;
  readonly label: string;
  readonly panelTestid: string;
  readonly locale: FileViewerLocale;
  readonly onLocaleChange: (locale: FileViewerLocale) => void;
  readonly localeTestid: string;
}

function ThemedFileViewerInstance({
  theme,
  colorScheme,
  scopeClass,
  label,
  panelTestid,
  locale,
  onLocaleChange,
  localeTestid,
}: ThemedInstanceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  return (
    <MantineProvider
      theme={theme}
      forceColorScheme={colorScheme}
      cssVariablesSelector={`.${scopeClass}`}
      getRootElement={() => hostRef.current ?? document.documentElement}
    >
      <Stack
        gap={8}
        miw={0}
        className={scopeClass}
        data-mantine-color-scheme={colorScheme}
        ref={hostRef}
      >
        <Group gap={10} wrap="nowrap" align="center">
          <Text ff={MONO} fz={9} fw={600} c="var(--mantine-color-signal-filled)">
            {label}
          </Text>
          {/* Per-instance language control — locale is a per-instance prop, so
              the two themed hosts may render DIFFERING locales at once. */}
          <SegmentedControl
            size="xs"
            data-testid={localeTestid}
            value={locale}
            onChange={(value) => {
              onLocaleChange(value as FileViewerLocale);
            }}
            data={localeOptions}
          />
        </Group>
        <Box
          p={12}
          style={{
            width: 860,
            maxWidth: "100%",
            background: "var(--mantine-color-panel-filled)",
            border: "1px solid var(--mantine-color-border-filled)",
          }}
          data-testid={panelTestid}
        >
          <FileViewer {...demoFileViewerProps} locale={locale} />
        </Box>
      </Stack>
    </MantineProvider>
  );
}

function DemoPage() {
  // The GLOBAL switch drives both instances at once; each instance also has
  // its own control, so the two themed hosts can render differing locales.
  const [globalLocale, setGlobalLocale] = useState<FileViewerLocale>("en");
  const [leftOverride, setLeftOverride] = useState<FileViewerLocale | null>(null);
  const [rightOverride, setRightOverride] = useState<FileViewerLocale | null>(null);
  const leftLocale = leftOverride ?? globalLocale;
  const rightLocale = rightOverride ?? globalLocale;
  const applyGlobalLocale = (locale: FileViewerLocale): void => {
    setGlobalLocale(locale);
    setLeftOverride(null);
    setRightOverride(null);
  };
  const [failing, setFailing] = useState<boolean>(false);

  return (
    <MantineProvider theme={geovisionTheme} forceColorScheme="dark">
      <Box mih="100vh" p={24} style={{ background: "var(--mantine-color-deep-filled)" }} data-testid="demo-page">
        <Stack gap={16} maw={1860}>
          <Title order={3} c="var(--mantine-color-text-filled)">
            Prism file-viewer demo — explorer VAULT surface (D9+D11) × theme swap × locale swap
          </Title>
          <Text size="sm" c="var(--mantine-color-muted-filled)" data-testid="demo-caption">
            Two hosts, two palettes, one component: the same semantic tokens mapped onto the GeoVision
            VAULT prototype palette (left, dark) and Lattice Light (right, light). Each instance lands in
            the ROOT of its storage and browses like a file explorer through the embedded IFileEntry
            client — the gallery renders only the folders and files under the CURRENT path, folder tiles
            navigate in (per-folder children re-query) while the breadcrumb at the top left always shows
            the full current path and navigates back at any level, and file tiles emit the open-file
            intent. The ownership pills (ALL / OWNED BY ME / SHARED WITH ME) scope the rendered entries;
            file kinds are told apart by their distinct icons. The + NEW control opens the create menu —
            NEW FOLDER / NEW FILE (DOSSIER) — with the creation scoped to the current path (watch the
            create-folder / create-file monitors). The LANGUAGE switch drives both instances; each host
            also carries its own EN/中文 control. The viewerPath monitor shows the shared-slot
            publication (the most recent navigation — two demo instances share one global slot); sort /
            layout / filter stay per-instance local state. The fail toggle makes the mock Lattice
            executor reject calls so the error + Retry branch can be inspected in both themes.
          </Text>
          <Stack gap={20} data-testid="demo-locale-stage">
            <Group gap={10} wrap="nowrap" align="center" data-testid="demo-locale-bar">
              <Text ff={MONO} fz={9} fw={600} c="var(--mantine-color-muted-filled)">
                LANGUAGE
              </Text>
              <SegmentedControl
                data-testid="demo-locale-switcher"
                value={globalLocale}
                onChange={(value) => {
                  applyGlobalLocale(value as FileViewerLocale);
                }}
                data={localeOptions}
              />
            </Group>
            <Group align="flex-start" gap={20} wrap="wrap" data-testid="demo-instances">
              <ThemedFileViewerInstance
                theme={geovisionTheme}
                colorScheme="dark"
                scopeClass="demo-scope-geovision"
                label="HOST A · GEOVISION VAULT (DARK)"
                panelTestid="demo-viewer-panel-a"
                locale={leftLocale}
                onLocaleChange={setLeftOverride}
                localeTestid="demo-instance-locale-a"
              />
              <ThemedFileViewerInstance
                theme={latticeLightTheme}
                colorScheme="light"
                scopeClass="demo-scope-light"
                label="HOST B · LATTICE LIGHT"
                panelTestid="demo-viewer-panel-b"
                locale={rightLocale}
                onLocaleChange={setRightOverride}
                localeTestid="demo-instance-locale-b"
              />
            </Group>
          </Stack>
          <Divider
            color="var(--mantine-color-border-filled)"
            label={
              <Text ff={MONO} fz={9} c="var(--mantine-color-muted-filled)">
                HOST DEMO AFFORDANCES
              </Text>
            }
          />
          <Group gap="xs">
            <Button
              variant="outline"
              c={failing ? "threat" : "ok"}
              data-testid="demo-lattice-fail"
              onClick={() => {
                setFailing(toggleDemoFailure());
              }}
            >
              {failing ? "Lattice: FAILING (Retry works)" : "Simulate Lattice failure"}
            </Button>
          </Group>
          <Stack gap={14}>
            <ViewerPathMonitor />
            <OpenFileMonitor />
            <CreateFileMonitor />
            <CreateFolderMonitor />
            <LatticeLogMonitor />
          </Stack>
          <Text fz={9} ff={MONO} c="var(--mantine-color-muted-filled)">
            synthetic vault tree · {String(nodeById.size)} entries · no production data
          </Text>
        </Stack>
      </Box>
    </MantineProvider>
  );
}

// Install the mock Lattice executor BEFORE mounting, the way a host with a
// real runtime would — child effects (the embedded clients' load queries) run
// before this module could install one from a parent useEffect.
installDemoExecutor();

createRoot(document.getElementById("root")!).render(<DemoPage />);
