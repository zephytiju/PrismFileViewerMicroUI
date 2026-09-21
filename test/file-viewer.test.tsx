import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import {
  readChannel,
  resetChannelsForTests,
  setPrismActionExecutor,
  subscribeToEvent,
} from "@zephytiju/prism-react";
import type { FileEntrySummary } from "@zephytiju/lattice-common-interfaces";
import { FileViewer } from "../src/index.js";
import type {
  CreateFileIntent,
  CreateFolderIntent,
  FileViewerProps,
  OpenFileIntent,
  ViewerPath,
} from "../src/index.js";
import { en, locales, zhCN } from "../src/index.js";
import type { FileViewerStrings } from "../src/index.js";

(globalThis as { __PRISM_REACT_TEST__?: boolean }).__PRISM_REACT_TEST__ = true;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Test fixture — a small synthetic vault tree with MIXED ownership (some
// entries owned by the operator, some shared with them) served by a mock
// Lattice executor, mirroring how a host runtime would answer the embedded
// clients.
// ---------------------------------------------------------------------------

interface Node {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly sizeBytes?: number;
  readonly shared?: boolean;
  readonly children?: readonly Node[];
}

const FIXTURE: readonly Node[] = [
  {
    id: "fld-alpha",
    name: "ALPHA SET",
    kind: "folder",
    children: [
      { id: "fld-alpha-sub", name: "ALPHA SUBSET", kind: "folder", children: [{ id: "doc-deep", name: "Deep Brief", kind: "dossier", sizeBytes: 2048 }] },
      { id: "doc-inside", name: "Inside Brief", kind: "dossier", sizeBytes: 4096 },
      { id: "brd-inside", name: "Inside Board", kind: "board", sizeBytes: 1024 },
      { id: "wld-inside", name: "Inside View", kind: "world", sizeBytes: 8192 },
    ],
  },
  { id: "fld-shared", name: "SHARED SET", kind: "folder", shared: true, children: [{ id: "doc-shared", name: "Shared Brief", kind: "dossier", shared: true, sizeBytes: 2048 }] },
  { id: "doc-root", name: "Root Brief", kind: "dossier", sizeBytes: 5120 },
  { id: "doc-partner", name: "Partner Brief", kind: "dossier", shared: true, sizeBytes: 1024 },
  { id: "brd-root", name: "Root Board", kind: "board", sizeBytes: 1024 },
  { id: "wld-root", name: "Root View", kind: "world", sizeBytes: 10240 },
  { id: "dat-root", name: "Root Foreign Kind", kind: "transcript", sizeBytes: 256 },
];

const nodesById = new Map<string, Node>();
const register = (nodes: readonly Node[]): void => {
  for (const node of nodes) {
    nodesById.set(node.id, node);
    if (node.children !== undefined) {
      register(node.children);
    }
  }
};
register(FIXTURE);

const flatten = (nodes: readonly Node[]): readonly Node[] =>
  nodes.flatMap((node) => [node, ...(node.children !== undefined ? flatten(node.children) : [])]);

let failNext = false;
const seenScopes: (string | undefined)[] = [];

async function fixtureExecutor(request: { readonly route: string; readonly arguments: unknown }): Promise<unknown> {
  if (failNext) {
    failNext = false;
    throw new Error("fixture Lattice failure");
  }
  if (request.route === "interfaces/IFileEntry/list") {
    const args = (request.arguments ?? {}) as { readonly scope?: string };
    seenScopes.push(args.scope);
    const scope = args.scope ?? null;
    const folder = scope === null ? null : (nodesById.get(scope) ?? null);
    if (folder === null || folder.kind !== "folder") {
      if (scope !== null) {
        throw new Error(`fixture: unknown folder scope ${scope}`);
      }
      return {
        entries: FIXTURE.map((node) => ({ id: node.id, name: node.name, kind: node.kind, sizeBytes: node.sizeBytes ?? 0 })),
      };
    }
    const children = folder.children ?? [];
    return {
      entries: children.map((node) => ({ id: node.id, name: node.name, kind: node.kind, sizeBytes: node.sizeBytes ?? 0 })),
    };
  }
  if (request.route === "interfaces/ISearchable/search") {
    const args = (request.arguments ?? {}) as { readonly query?: string };
    const query = (args.query ?? "").toUpperCase();
    const matches = flatten(FIXTURE).filter((node) => node.name.toUpperCase().includes(query));
    return {
      queryRef: "q-fixture",
      resultIds: matches.map((node) => node.id),
      items: matches.map((node) => ({ id: node.id, type: node.kind, label: node.name })),
    };
  }
  throw new Error(`fixture: no handler for ${request.route}`);
}

const entry = (id: string): FileEntrySummary => {
  const node = nodesById.get(id) as Node;
  return { id: node.id, name: node.name, kind: node.kind, sizeBytes: node.sizeBytes ?? 0 };
};

const sharedIds = new Set(["fld-shared", "doc-shared", "doc-partner"]);
const baseProps: FileViewerProps = {
  ownershipOf: (e) => (sharedIds.has(e.id) ? "shared" : "owned"),
};

beforeEach(() => {
  resetChannelsForTests();
  setPrismActionExecutor(fixtureExecutor);
  seenScopes.length = 0;
});

afterEach(() => {
  cleanup();
  setPrismActionExecutor(null);
});

async function renderViewer(props: FileViewerProps = baseProps): Promise<void> {
  render(
    <MantineProvider>
      <FileViewer {...props} />
    </MantineProvider>,
  );
  await waitFor(() => {
    expect(screen.getByTestId("file-viewer-gallery").querySelector('[data-testid^="file-viewer-tile-"]')).not.toBeNull();
  });
}

const tileIds = (): string[] =>
  Array.from(screen.getByTestId("file-viewer-gallery").querySelectorAll('[data-testid^="file-viewer-tile-"]')).map(
    (node) => (node.getAttribute("data-testid") ?? "").replace("file-viewer-tile-", ""),
  );

const rowIds = (): string[] =>
  Array.from(screen.getByTestId("file-viewer-gallery").querySelectorAll('[data-testid^="file-viewer-row-"]')).map(
    (node) => (node.getAttribute("data-testid") ?? "").replace("file-viewer-row-", ""),
  );

describe("FileViewer hub header and toolbar", () => {
  it("renders the hub header: title, inventory subtitle, layout toggle, search, SORT, + NEW control", async () => {
    await renderViewer();
    expect(screen.getByTestId("file-viewer-title").textContent).toBe("VAULT");
    expect(screen.getByTestId("file-viewer-subtitle").textContent).toBe("ALL OPERATIONAL FILES");
    expect(screen.getByTestId("file-viewer-layout-toggle")).toBeDefined();
    expect(screen.getByTestId("file-viewer-search-input")).toBeDefined();
    expect(screen.getByTestId("file-viewer-sort").textContent).toContain("SORT");
    expect(screen.getByTestId("file-viewer-sort").textContent).toContain("NAME");
    expect(screen.getByTestId("file-viewer-new").textContent).toBe("+ NEW ▾");
    // The create menu itself is closed until the control is toggled.
    expect(screen.queryByTestId("file-viewer-new-menu")).toBeNull();
  });

  it("renders the three ownership filter pills (ALL / OWNED BY ME / SHARED WITH ME) with ALL active", async () => {
    await renderViewer();
    expect(screen.getByTestId("file-viewer-filter-all").textContent).toBe("ALL");
    expect(screen.getByTestId("file-viewer-filter-owned").textContent).toBe("OWNED BY ME");
    expect(screen.getByTestId("file-viewer-filter-shared").textContent).toBe("SHARED WITH ME");
    expect(screen.getByTestId("file-viewer-filter-all").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByTestId("file-viewer-filter-folders")).toBeNull();
    expect(screen.queryByTestId("file-viewer-filter-dossiers")).toBeNull();
    expect(screen.queryByTestId("file-viewer-filter-boards")).toBeNull();
    expect(screen.queryByTestId("file-viewer-filter-world")).toBeNull();
  });

  it("renders the root breadcrumb (NEXUS / VAULT / ALL FILES) with the root title and description", async () => {
    await renderViewer();
    expect(screen.getByTestId("file-viewer-crumb-home").textContent).toBe("NEXUS");
    expect(screen.getByTestId("file-viewer-crumb-area").textContent).toBe("VAULT");
    expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALL FILES");
    expect(screen.getByTestId("file-viewer-path-title").textContent).toBe("Operational files");
    expect(screen.getByTestId("file-viewer-path-description").textContent).toContain(
      "Dossiers, workflow and audit boards",
    );
  });

  it("lets title/inventorySubtitle/rootTitle/rootDescription props override the locale strings", async () => {
    await renderViewer({
      ...baseProps,
      title: "ARCHIVE",
      inventorySubtitle: "12 WORKSPACES · 47 DOSSIERS",
      rootTitle: "Custom root",
      rootDescription: "Custom description",
    });
    expect(screen.getByTestId("file-viewer-title").textContent).toBe("ARCHIVE");
    expect(screen.getByTestId("file-viewer-subtitle").textContent).toBe("12 WORKSPACES · 47 DOSSIERS");
    expect(screen.getByTestId("file-viewer-path-title").textContent).toBe("Custom root");
    expect(screen.getByTestId("file-viewer-path-description").textContent).toBe("Custom description");
  });

  it("renders the FILES section with the visible count and folders + files suffix at the root", async () => {
    await renderViewer();
    expect(screen.getByTestId("file-viewer-section-label").textContent).toBe("FILES");
    expect(screen.getByTestId("file-viewer-count").textContent).toBe("7 VISIBLE · FOLDERS + FILES");
  });
});

describe("FileViewer ownership filters (D11)", () => {
  it("SHARED WITH ME scopes the gallery to entries shared with the operator", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-filter-shared"));
    expect(screen.getByTestId("file-viewer-filter-shared").getAttribute("aria-pressed")).toBe("true");
    // Folders first: SHARED SET folder, then the shared root file.
    expect(tileIds()).toEqual(["fld-shared", "doc-partner"]);
  });

  it("OWNED BY ME scopes the gallery to entries owned by the operator", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-filter-owned"));
    expect(tileIds()).toEqual(["fld-alpha", "brd-root", "doc-root", "dat-root", "wld-root"]);
  });

  it("ALL restores the unscoped current-path listing", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-filter-shared"));
    fireEvent.click(screen.getByTestId("file-viewer-filter-all"));
    expect(tileIds().length).toBe(7);
  });

  it("treats entries as owned when no ownershipOf callback is configured", async () => {
    await renderViewer({});
    fireEvent.click(screen.getByTestId("file-viewer-filter-owned"));
    expect(tileIds().length).toBe(7);
    fireEvent.click(screen.getByTestId("file-viewer-filter-shared"));
    expect(screen.getByTestId("file-viewer-empty").textContent).toBe(
      "NO ENTRIES MATCH THE CURRENT FILTER",
    );
  });

  it("ownership pills scope the entries inside the current folder, not just at the root", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SET");
    });
    // Everything inside ALPHA SET is owned: OWNED BY ME keeps 4, SHARED WITH ME is empty.
    fireEvent.click(screen.getByTestId("file-viewer-filter-owned"));
    expect(tileIds()).toEqual(["fld-alpha-sub", "brd-inside", "doc-inside", "wld-inside"]);
    fireEvent.click(screen.getByTestId("file-viewer-filter-shared"));
    expect(screen.getByTestId("file-viewer-empty").textContent).toBe(
      "NO ENTRIES MATCH THE CURRENT FILTER",
    );
  });

  it("accepts a custom tag set through the tags configuration key", async () => {
    await renderViewer({ ...baseProps, tags: [{ id: "everything", label: "EVERYTHING" }] });
    expect(screen.getByTestId("file-viewer-filter-everything").textContent).toBe("EVERYTHING");
    expect(screen.queryByTestId("file-viewer-filter-all")).toBeNull();
    // Custom ids carry no builtin scoping: the full current path renders.
    expect(tileIds().length).toBe(7);
  });
});

describe("FileViewer FILES gallery", () => {
  it("renders folders first, then files, with the root listing from the default scope", async () => {
    await renderViewer();
    expect(tileIds()).toEqual([
      "fld-alpha",
      "fld-shared",
      "doc-partner",
      "brd-root",
      "doc-root",
      "dat-root",
      "wld-root",
    ]);
    expect(seenScopes).toEqual([undefined]);
  });

  it("renders every file kind with its distinct icon on the kind's semantic token", async () => {
    await renderViewer();
    expect(screen.getByTestId("file-viewer-icon-fld-alpha").getAttribute("style")).toContain(
      "var(--mantine-color-accent-filled)",
    );
    expect(screen.getByTestId("file-viewer-icon-doc-root").getAttribute("style")).toContain(
      "var(--mantine-color-ok-filled)",
    );
    expect(screen.getByTestId("file-viewer-icon-brd-root").getAttribute("style")).toContain(
      "var(--mantine-color-warn-filled)",
    );
    expect(screen.getByTestId("file-viewer-icon-wld-root").getAttribute("style")).toContain(
      "var(--mantine-color-signal-filled)",
    );
  });

  it("renders per-kind default chips and a bounded default meta line", async () => {
    await renderViewer({ ...baseProps, rootScope: undefined });
    expect(screen.getByTestId("file-viewer-chip-doc-root").textContent).toBe("DOSSIER");
    expect(screen.getByTestId("file-viewer-chip-brd-root").textContent).toBe("BOARD");
    expect(screen.getByTestId("file-viewer-chip-wld-root").textContent).toBe("WORLD VIEW");
    expect(screen.getByTestId("file-viewer-chip-fld-alpha").textContent).toBe("FOLDER");
    expect(screen.getByTestId("file-viewer-meta-doc-root").textContent).toBe("DOSSIER · 5.0 KB");
    expect(screen.getByTestId("file-viewer-meta-fld-alpha").textContent).toBe("FOLDER");
  });

  it("lets chip/meta callbacks supply entry taxonomy (folder chips, edit meta)", async () => {
    await renderViewer({
      ...baseProps,
      chip: (e) => (e.kind === "folder" ? "ACTIVE SET" : undefined),
      meta: (e) => (e.id === "doc-root" ? "DOSSIER FILE · EDITED 4M AGO" : undefined),
    });
    expect(screen.getByTestId("file-viewer-chip-fld-alpha").textContent).toBe("ACTIVE SET");
    expect(screen.getByTestId("file-viewer-chip-doc-root").textContent).toBe("DOSSIER");
    expect(screen.getByTestId("file-viewer-meta-doc-root").textContent).toBe("DOSSIER FILE · EDITED 4M AGO");
  });

  it("switches grid tiles to list rows through the Layout Toggle", async () => {
    await renderViewer();
    expect(tileIds().length).toBe(7);
    expect(rowIds()).toEqual([]);
    fireEvent.click(screen.getByTestId("file-viewer-layout-list"));
    expect(rowIds()).toEqual([
      "fld-alpha",
      "fld-shared",
      "doc-partner",
      "brd-root",
      "doc-root",
      "dat-root",
      "wld-root",
    ]);
    expect(tileIds()).toEqual([]);
    fireEvent.click(screen.getByTestId("file-viewer-layout-grid"));
    expect(tileIds().length).toBe(7);
  });

  it("cycles the local sort key through the offered keys (name → size)", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-sort"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-sort").textContent).toContain("SIZE");
    });
    // Files ordered by descending size: wld-root (10240), doc-root (5120),
    // brd-root (1024), doc-partner (1024), dat-root (256); name breaks the tie.
    expect(tileIds()).toEqual(["fld-alpha", "fld-shared", "wld-root", "doc-root", "doc-partner", "brd-root", "dat-root"]);
    fireEvent.click(screen.getByTestId("file-viewer-sort"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-sort").textContent).toContain("NAME");
    });
  });
});

describe("FileViewer folder navigation (explorer semantics, D11)", () => {
  it("entering a folder re-queries its children, extends the breadcrumb beyond the persistent root segment, and switches title/description", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SET");
    });
    // The root segment ALL FILES persists as a clickable ancestor — the
    // breadcrumb always reflects the FULL current path (D11).
    expect(screen.getByTestId("file-viewer-crumb-root").textContent).toBe("ALL FILES");
    expect(screen.getByTestId("file-viewer-crumb-home").textContent).toBe("NEXUS");
    expect(screen.getByTestId("file-viewer-crumb-area").textContent).toBe("VAULT");
    expect(seenScopes).toEqual([undefined, "fld-alpha"]);
    expect(screen.getByTestId("file-viewer-path-title").textContent).toBe("ALPHA SET");
    expect(screen.getByTestId("file-viewer-path-description").textContent).toBe("FOLDER · FOLDER");
    expect(screen.getByTestId("file-viewer-count").textContent).toContain("4 VISIBLE");
    expect(tileIds()).toEqual(["fld-alpha-sub", "brd-inside", "doc-inside", "wld-inside"]);

    // Drill one level deeper: the breadcrumb extends again, one segment per folder.
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha-sub"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SUBSET");
    });
    expect(screen.getByTestId("file-viewer-crumb-0").textContent).toBe("ALPHA SET");
    expect(screen.getByTestId("file-viewer-crumb-root").textContent).toBe("ALL FILES");
    expect(seenScopes).toEqual([undefined, "fld-alpha", "fld-alpha-sub"]);
  });

  it("navigates back through every ancestor segment: folder, root scope, area, home", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SET");
    });
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha-sub"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SUBSET");
    });

    // Ancestor folder segment: that folder becomes the current scope.
    fireEvent.click(screen.getByTestId("file-viewer-crumb-0"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SET");
    });
    expect(screen.getByTestId("file-viewer-path-title").textContent).toBe("ALPHA SET");

    // Persistent root segment (ALL FILES): back to the root.
    fireEvent.click(screen.getByTestId("file-viewer-crumb-root"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALL FILES");
    });
    expect(screen.queryByTestId("file-viewer-crumb-root")).toBeNull();
    expect(screen.getByTestId("file-viewer-path-title").textContent).toBe("Operational files");
    expect(tileIds().length).toBe(7);

    // VAULT area and NEXUS home segments: also the root.
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SET");
    });
    fireEvent.click(screen.getByTestId("file-viewer-crumb-area"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALL FILES");
    });
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SET");
    });
    fireEvent.click(screen.getByTestId("file-viewer-crumb-home"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALL FILES");
    });
  });

  it("resets the ownership filter to ALL when entering a folder (prototype behavior)", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-filter-shared"));
    expect(tileIds()).toEqual(["fld-shared", "doc-partner"]);
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-shared"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("SHARED SET");
    });
    expect(screen.getByTestId("file-viewer-filter-all").getAttribute("aria-pressed")).toBe("true");
    expect(tileIds()).toEqual(["doc-shared"]);
  });

  it("lists a folder scope through rootScope when provided", async () => {
    await renderViewer({ ...baseProps, rootScope: "fld-alpha" });
    await waitFor(() => {
      expect(tileIds()).toEqual(["fld-alpha-sub", "brd-inside", "doc-inside", "wld-inside"]);
    });
    expect(seenScopes).toEqual(["fld-alpha"]);
  });
});

describe("FileViewer + NEW create menu (D11)", () => {
  it("opens the create menu with NEW FOLDER / NEW FILE (DOSSIER) and closes on outside click", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-new"));
    expect(screen.getByTestId("file-viewer-new").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("file-viewer-new-folder").textContent).toBe("NEW FOLDER");
    expect(screen.getByTestId("file-viewer-new-file").textContent).toBe("NEW FILE (DOSSIER)");
    // Clicking anywhere outside closes the menu without emitting anything.
    const payloads: string[] = [];
    const unsubscribe = subscribeToEvent("file-viewer.create-folder", () => {
      payloads.push("create-folder");
    });
    fireEvent.click(document.body);
    expect(screen.queryByTestId("file-viewer-new-menu")).toBeNull();
    expect(payloads).toEqual([]);
    unsubscribe();
  });

  it("closes the create menu on Escape", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-new"));
    expect(screen.getByTestId("file-viewer-new-menu")).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("file-viewer-new-menu")).toBeNull();
  });

  it("emits file-viewer.create-folder with the current path as parent, at the root and inside a folder", async () => {
    const payloads: CreateFolderIntent[] = [];
    const unsubscribe = subscribeToEvent("file-viewer.create-folder", (payload) => {
      payloads.push(payload as CreateFolderIntent);
    });
    await renderViewer();

    // At the root: the intent carries scopeId null.
    fireEvent.click(screen.getByTestId("file-viewer-new"));
    fireEvent.click(screen.getByTestId("file-viewer-new-folder"));
    expect(payloads).toEqual([{ scopeId: null, ontologyInterfaces: ["IFileEntry"] }]);
    expect(screen.queryByTestId("file-viewer-new-menu")).toBeNull();

    // Inside a folder: the intent carries the current folder as parent.
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SET");
    });
    fireEvent.click(screen.getByTestId("file-viewer-new"));
    fireEvent.click(screen.getByTestId("file-viewer-new-folder"));
    expect(payloads[1]).toEqual({ scopeId: "fld-alpha", ontologyInterfaces: ["IFileEntry"] });
    unsubscribe();
  });

  it("emits file-viewer.create-file with the current path as parent (NEW FILE, dossier)", async () => {
    const payloads: CreateFileIntent[] = [];
    const unsubscribe = subscribeToEvent("file-viewer.create-file", (payload) => {
      payloads.push(payload as CreateFileIntent);
    });
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-new"));
    fireEvent.click(screen.getByTestId("file-viewer-new-file"));
    expect(payloads).toEqual([
      { scopeId: null, ontologyInterfaces: ["IDossierDoc", "IFileEntry"] },
    ]);

    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SET");
    });
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha-sub"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SUBSET");
    });
    fireEvent.click(screen.getByTestId("file-viewer-new"));
    fireEvent.click(screen.getByTestId("file-viewer-new-file"));
    expect(payloads[1]).toEqual({ scopeId: "fld-alpha-sub", ontologyInterfaces: ["IDossierDoc", "IFileEntry"] });
    unsubscribe();
  });

  it("toggles the create menu closed when the control is clicked again", async () => {
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-new"));
    expect(screen.getByTestId("file-viewer-new-menu")).toBeDefined();
    fireEvent.click(screen.getByTestId("file-viewer-new"));
    expect(screen.queryByTestId("file-viewer-new-menu")).toBeNull();
  });
});

describe("FileViewer channel contract", () => {
  it("publishes vault.viewerPath for the root, folder entry, and back-navigation", async () => {
    await renderViewer();
    await waitFor(() => {
      expect(readChannel<ViewerPath>("vault.viewerPath")).toEqual({ scopeId: null, segments: [] });
    });

    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha"));
    await waitFor(() => {
      expect(readChannel<ViewerPath>("vault.viewerPath")).toEqual({
        scopeId: "fld-alpha",
        segments: [{ id: "fld-alpha", name: "ALPHA SET" }],
      });
    });

    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha-sub"));
    await waitFor(() => {
      expect(readChannel<ViewerPath>("vault.viewerPath")).toEqual({
        scopeId: "fld-alpha-sub",
        segments: [
          { id: "fld-alpha", name: "ALPHA SET" },
          { id: "fld-alpha-sub", name: "ALPHA SUBSET" },
        ],
      });
    });

    fireEvent.click(screen.getByTestId("file-viewer-crumb-root"));
    await waitFor(() => {
      expect(readChannel<ViewerPath>("vault.viewerPath")).toEqual({ scopeId: null, segments: [] });
    });
  });

  it("emits file-viewer.open-file with the file reference and containing scope", async () => {
    const payloads: OpenFileIntent[] = [];
    const unsubscribe = subscribeToEvent("file-viewer.open-file", (payload) => {
      payloads.push(payload as OpenFileIntent);
    });
    await renderViewer();
    fireEvent.click(screen.getByTestId("file-viewer-tile-doc-root"));
    expect(payloads).toEqual([
      {
        id: "doc-root",
        name: "Root Brief",
        kind: "dossier",
        sizeBytes: 5120,
        scopeId: null,
        ontologyInterface: "IFileEntry",
      },
    ]);

    // Inside a folder, scopeId carries the containing folder id.
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SET");
    });
    fireEvent.click(screen.getByTestId("file-viewer-tile-wld-inside"));
    expect(payloads[1]).toEqual({
      id: "wld-inside",
      name: "Inside View",
      kind: "world",
      sizeBytes: 8192,
      scopeId: "fld-alpha",
      ontologyInterface: "IFileEntry",
    });
    unsubscribe();
  });
});

describe("FileViewer search (ISearchable)", () => {
  it("issues an ISearchable query on submit and renders the matched files", async () => {
    await renderViewer();
    fireEvent.change(screen.getByTestId("file-viewer-search-input"), { target: { value: "inside" } });
    fireEvent.submit(screen.getByTestId("file-viewer-search-form"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-section-label").textContent).toBe("SEARCH · inside");
    });
    expect(screen.getByTestId("file-viewer-count").textContent).toBe("3 VISIBLE");
    expect(tileIds()).toEqual(["brd-inside", "doc-inside", "wld-inside"]);
    expect(screen.getByTestId("file-viewer-clear-search").textContent).toBe("CLEAR SEARCH");
  });

  it("shows the search empty state when nothing matches", async () => {
    await renderViewer();
    fireEvent.change(screen.getByTestId("file-viewer-search-input"), { target: { value: "nomatch" } });
    fireEvent.submit(screen.getByTestId("file-viewer-search-form"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-empty").textContent).toBe("NO FILES MATCH THE CURRENT SEARCH");
    });
  });

  it("clears the search and returns to folder browsing", async () => {
    await renderViewer();
    fireEvent.change(screen.getByTestId("file-viewer-search-input"), { target: { value: "inside" } });
    fireEvent.submit(screen.getByTestId("file-viewer-search-form"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-section-label").textContent).toBe("SEARCH · inside");
    });
    fireEvent.click(screen.getByTestId("file-viewer-clear-search"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-section-label").textContent).toBe("FILES");
    });
    expect(screen.getByTestId("file-viewer-count").textContent).toContain("FOLDERS + FILES");
    expect(tileIds().length).toBe(7);
  });

  it("navigating into a folder from search results clears the search", async () => {
    await renderViewer();
    fireEvent.change(screen.getByTestId("file-viewer-search-input"), { target: { value: "alpha" } });
    fireEvent.submit(screen.getByTestId("file-viewer-search-form"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-section-label").textContent).toBe("SEARCH · alpha");
    });
    fireEvent.click(screen.getByTestId("file-viewer-tile-fld-alpha"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-section-label").textContent).toBe("FILES");
    });
    expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("ALPHA SET");
  });
});

describe("FileViewer load states", () => {
  it("renders skeleton rows while the children query is in flight", () => {
    let release: (() => void) | null = null;
    setPrismActionExecutor(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve({ entries: [] });
          };
        }) as Promise<unknown>,
    );
    render(
      <MantineProvider>
        <FileViewer />
      </MantineProvider>,
    );
    expect(screen.getByTestId("file-viewer-loading").getAttribute("aria-busy")).toBe("true");
    act(() => {
      release?.();
    });
  });

  it("renders the error alert with a Retry button that re-runs the query", async () => {
    failNext = true;
    await renderViewer().then(
      () => undefined,
      () => undefined,
    );
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-error")).toBeDefined();
    });
    expect(screen.getByTestId("file-viewer-error-message").textContent).toBe("fixture Lattice failure");
    fireEvent.click(screen.getByTestId("file-viewer-retry"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-gallery").querySelector('[data-testid^="file-viewer-tile-"]')).not.toBeNull();
    });
  });
});

describe("FileViewer i18n", () => {
  it("renders Chinese strings with locale=\"zh-CN\"", async () => {
    await renderViewer({ ...baseProps, locale: "zh-CN" });
    expect(screen.getByTestId("file-viewer-title").textContent).toBe("文件库");
    expect(screen.getByTestId("file-viewer-subtitle").textContent).toBe("全部作战文件");
    expect(screen.getByTestId("file-viewer-crumb-current").textContent).toBe("全部文件");
    expect(screen.getByTestId("file-viewer-path-title").textContent).toBe("作战文件");
    expect(screen.getByTestId("file-viewer-section-label").textContent).toBe("文件");
    expect(screen.getByTestId("file-viewer-count").textContent).toBe("7 项可见 · 文件夹 + 文件");
    expect(screen.getByTestId("file-viewer-new").textContent).toBe("+ 新建 ▾");
    expect(screen.getByTestId("file-viewer-filter-owned").textContent).toBe("我拥有的");
    expect(screen.getByTestId("file-viewer-filter-shared").textContent).toBe("与我共享的");
    expect(screen.getByTestId("file-viewer-chip-doc-root").textContent).toBe("卷宗");
    expect(screen.getByTestId("file-viewer-tile-fld-alpha").getAttribute("title")).toBe("打开文件夹");
    expect(screen.getByTestId("file-viewer-tile-doc-root").getAttribute("title")).toBe("打开文件");

    // The create menu items localize too.
    fireEvent.click(screen.getByTestId("file-viewer-new"));
    expect(screen.getByTestId("file-viewer-new-folder").textContent).toBe("新建文件夹");
    expect(screen.getByTestId("file-viewer-new-file").textContent).toBe("新建文件（卷宗）");
  });

  it("interpolates the {count} placeholder with the live visible count", async () => {
    await renderViewer({ ...baseProps, locale: "zh-CN" });
    fireEvent.click(screen.getByTestId("file-viewer-filter-shared"));
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer-count").textContent).toBe("2 项可见 · 文件夹 + 文件");
    });
  });

  it("exports namespaced locale bundles that deep-merge with other components' bundles without collision", () => {
    expect(Object.keys(en["file-viewer"]).sort()).toEqual(Object.keys(zhCN["file-viewer"]).sort());
    expect(Object.keys(locales["zh-CN"]["file-viewer"]).length).toBe(Object.keys(en["file-viewer"]).length);

    const siblingEn = { "other-component": { retry: "RETRY", next: "MORE" } };
    const merge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = { ...a };
      for (const [key, value] of Object.entries(b)) {
        const existing = out[key];
        out[key] =
          existing !== undefined &&
          typeof existing === "object" &&
          existing !== null &&
          typeof value === "object" &&
          value !== null
            ? merge(existing as Record<string, unknown>, value as Record<string, unknown>)
            : value;
      }
      return out;
    };

    const merged = merge(locales.en, siblingEn) as {
      "file-viewer": FileViewerStrings;
      "other-component": { retry: string; next: string };
    };
    expect(merged["file-viewer"].filesSection).toBe("FILES");
    expect(merged["file-viewer"].newControl).toBe("+ NEW ▾");
    expect(merged["other-component"]).toEqual({ retry: "RETRY", next: "MORE" });
    expect(Object.keys(merged).sort()).toEqual(["file-viewer", "other-component"]);
  });
});
