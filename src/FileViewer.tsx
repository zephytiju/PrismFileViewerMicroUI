import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Stack } from "@mantine/core";
import {
  createFileEntryClient,
  createSearchableClient,
} from "@zephytiju/lattice-common-interfaces";
import type { FileEntrySummary } from "@zephytiju/lattice-common-interfaces";
import { emitPrismEvent, useLatticeTransport, usePrismStateSetter } from "@zephytiju/prism-react";
import { defaultMetaFor } from "./FileTile.js";
import { FilesGallery } from "./FilesGallery.js";
import type { GalleryPhase } from "./FilesGallery.js";
import { HubHeader } from "./HubHeader.js";
import type { CreateTarget } from "./HubHeader.js";
import type { ViewerLayout } from "./LayoutToggle.js";
import type { SelectionTag } from "./SelectionTags.js";
import { ViewerToolbar } from "./ViewerToolbar.js";
import type { ViewerPathSegment } from "./ViewerBreadcrumb.js";
import { kindChipLabel } from "./kinds.js";
import { formatMessage, stringsForLocale } from "./locales/index.js";
import type { FileViewerLocale } from "./locales/index.js";
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT_KEYS, DEEP } from "./viewerTokens.js";

/**
 * Payload published on the bounded-context shared slot `vault.viewerPath` —
 * the viewer's navigation state, so peer components can interpret it (D8).
 */
export interface ViewerPath {
  /** IFileEntry id of the current folder scope; null at the root. */
  readonly scopeId: string | null;
  /** Entered folders in order (bounded identifiers, never domain graphs). */
  readonly segments: readonly ViewerPathSegment[];
}

/** Payload of the `file-viewer.open-file` intent (clicking a file tile). */
export interface OpenFileIntent {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly sizeBytes: number;
  /** Folder the file lives in (null at the root). */
  readonly scopeId: string | null;
  readonly ontologyInterface: "IFileEntry";
}

/** Payload of the `file-viewer.create-file` intent (+ NEW → NEW FILE). */
export interface CreateFileIntent {
  /** Folder to create in (current path; null at the root). */
  readonly scopeId: string | null;
  /** Ontology interfaces the creation targets: an IDossierDoc draft / an IFileEntry. */
  readonly ontologyInterfaces: readonly ["IDossierDoc", "IFileEntry"];
}

/** Payload of the `file-viewer.create-folder` intent (+ NEW → NEW FOLDER). */
export interface CreateFolderIntent {
  /** Folder to create in (current path; null at the root). */
  readonly scopeId: string | null;
  /** Ontology interface the creation targets: an IFileEntry of kind folder. */
  readonly ontologyInterfaces: readonly ["IFileEntry"];
}

/**
 * Ownership class of an entry for the ownership filter pills (D11): entries
 * owned by the current operator vs shared with them. The bounded
 * `FileEntrySummary` projection of IFileEntry carries no owner/shared
 * metadata — ownership is host/operator context, so the host supplies it
 * through the `ownershipOf` configuration callback.
 */
export type EntryOwnership = "owned" | "shared";

/** One offered sort key (builtin ids "name" and "size" get locale labels). */
export interface ViewerSortKey {
  readonly id: string;
  /** Label override for custom keys; builtin keys resolve from the locale. */
  readonly label?: string;
}

export interface FileViewerProps {
  /** UI locale for the component-fixed strings (default "en"). */
  readonly locale?: FileViewerLocale;
  /** Hub wordmark (defaults to the locale's `title`; titles render from config keys). */
  readonly title?: string;
  /** Inventory subtitle line under the wordmark (defaults to the locale's). */
  readonly inventorySubtitle?: string;
  /** Viewer-toolbar title at the root (defaults to the locale's `rootTitle`). */
  readonly rootTitle?: string;
  /** Viewer-toolbar description at the root (defaults to the locale's). */
  readonly rootDescription?: string;
  /** IFileEntry list scope for the root listing (omit for the default scope). */
  readonly rootScope?: string;
  /** Filter pill set (defaults to the three ownership tags, labels from the locale). */
  readonly tags?: readonly SelectionTag[];
  /** Initially active filter id (default "all"). */
  readonly initialFilter?: string;
  /** Initial gallery presentation (default "grid"). */
  readonly initialLayout?: ViewerLayout;
  /** Offered sort keys, cycled by the SORT control (default name, then size). */
  readonly sortKeys?: readonly ViewerSortKey[];
  /** Category chip label from entry taxonomy (defaults to the kind name). */
  readonly chip?: (entry: FileEntrySummary) => string | undefined;
  /** Mono meta line — item count / edit meta (defaults to kind + bounded size). */
  readonly meta?: (entry: FileEntrySummary) => string | undefined;
  /**
   * Ownership class of an entry (owned by / shared with the current operator)
   * — drives the builtin OWNED BY ME / SHARED WITH ME pills (D11). Omitted,
   * every entry counts as owned. `FileEntrySummary` exposes no owner/shared
   * fields (bounded projection), so ownership comes from host configuration.
   */
  readonly ownershipOf?: (entry: FileEntrySummary) => EntryOwnership;
  /** Page size for ISearchable queries (default 50). */
  readonly pageSize?: number;
  /** Max height of the scrollable gallery area (default 360). */
  readonly galleryMaxHeight?: number | string;
}

/**
 * Platform Prism file-viewer micro-UI (component id "file-viewer") — the
 * merged VAULT main-viewport surface (decision D9) with explorer semantics
 * (decision D11): users land in the ROOT of their storage and the gallery
 * renders ONLY the folders and files under the CURRENT path. Hub header
 * (wordmark + inventory subtitle, Layout Toggle patterns immediately right
 * of the title, workspace search, SORT, + NEW control with the create menu —
 * NEW FOLDER / NEW FILE (DOSSIER), both created under the current path at
 * any level), viewer toolbar (breadcrumb path at the top left — ALWAYS the
 * full current path `NEXUS / VAULT / ALL FILES / …folders`, every ancestor
 * segment a back-navigation target — plus the current title/description and
 * the ownership filter pills ALL / OWNED BY ME / SHARED WITH ME), and the
 * FILES gallery: one gallery-style explorer area rendering both folders and
 * individual files as uniform tiles, folders first, every file kind carrying
 * its distinct icon (kinds are distinguished by their icons, not filters).
 *
 * This module is the stateful composition: it owns the navigation path, the
 * local view state (sort / layout / ownership filter), and the Lattice
 * bindings, and renders the presentation modules HubHeader (the header bar
 * with the create menu), ViewerToolbar (breadcrumb + title/description +
 * filter pills), and FilesGallery (section row + the tile/rows explorer
 * area) — see those files for their pieces.
 *
 * Lattice bindings (embedded, per the Micro-UI standards): gallery items
 * render IFileEntry records fetched through the generated FileEntryClient
 * over useLatticeTransport — entering a folder queries the entry's children
 * (scope = folder id) and pushes a path segment; the workspace search
 * issues ISearchable queries; + NEW emits creation intents for files
 * (IDossierDoc draft / IFileEntry) and folders (IFileEntry kind folder),
 * both scoped to the current path; the ownership pills map entries through
 * the `ownershipOf` configuration callback; sort and layout are local view
 * state. The breadcrumb path is published as the bounded-context shared
 * slot "vault.viewerPath"; opening a file emits the "file-viewer.open-file"
 * intent. No URLs, clients, or credentials in component code.
 *
 * Browsing and searching are NOT audit-worthy: this component emits NO
 * audit event. No palette is hardcoded — every color resolves to semantic
 * theme tokens supplied by the host's MantineProvider.
 */
export function FileViewer({
  locale = "en",
  title,
  inventorySubtitle,
  rootTitle,
  rootDescription,
  rootScope,
  tags,
  initialFilter = "all",
  initialLayout = "grid",
  sortKeys = DEFAULT_SORT_KEYS,
  chip,
  meta,
  ownershipOf,
  pageSize = DEFAULT_PAGE_SIZE,
  galleryMaxHeight = 360,
}: FileViewerProps) {
  const strings = stringsForLocale(locale);

  // Local view state (sort / layout / filter are local per the design).
  const [path, setPath] = useState<readonly FileEntrySummary[]>([]);
  const [layout, setLayout] = useState<ViewerLayout>(initialLayout);
  const [filter, setFilter] = useState<string>(initialFilter);
  const [sortIndex, setSortIndex] = useState<number>(0);
  const [query, setQuery] = useState<string>("");
  const [search, setSearch] = useState<{ readonly query: string } | null>(null);
  const [entries, setEntries] = useState<readonly FileEntrySummary[] | null>(null);
  const [phase, setPhase] = useState<GalleryPhase>("busy");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [reloadToken, setReloadToken] = useState<number>(0);

  // Embedded interface clients over the host-provided Lattice transport.
  const transport = useLatticeTransport();
  const fileClient = useMemo(() => createFileEntryClient(transport), [transport]);
  const searchClient = useMemo(() => createSearchableClient(transport), [transport]);

  // The breadcrumb path is the viewer's navigation state, published to the
  // bounded-context shared slot "vault.viewerPath" (setter-only: the viewer
  // never re-renders from its own publications).
  const publishViewerPath = usePrismStateSetter<ViewerPath>("vault.viewerPath");
  useEffect(() => {
    publishViewerPath({
      scopeId: path.length > 0 ? (path[path.length - 1] as FileEntrySummary).id : null,
      segments: path.map((entry) => ({ id: entry.id, name: entry.name })),
    });
  }, [path, publishViewerPath]);

  // Entering a folder queries the entry's children (the gallery renders only
  // the current path); a search issues an ISearchable query. Cancelled
  // renders keep only the latest response.
  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      setPhase("busy");
      try {
        let loaded: readonly FileEntrySummary[];
        if (search !== null) {
          const result = await searchClient.search({ query: search.query, filterRefs: [], pageSize });
          loaded = result.items.map((item) => ({
            id: item.id,
            name: item.label,
            kind: item.type,
            sizeBytes: 0,
          }));
        } else {
          const scopeId = path.length > 0 ? (path[path.length - 1] as FileEntrySummary).id : rootScope;
          const result = await fileClient.list(scopeId === undefined ? {} : { scope: scopeId });
          loaded = [...result.entries];
        }
        if (!cancelled) {
          setEntries(loaded);
          setPhase("ok");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
          setPhase("error");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [fileClient, searchClient, path, search, rootScope, pageSize, reloadToken]);

  const metaFor = useCallback(
    (entry: FileEntrySummary): string => meta?.(entry) ?? defaultMetaFor(entry, strings),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- strings follow locale
    [meta, locale],
  );
  const chipFor = useCallback(
    (entry: FileEntrySummary): string => chip?.(entry) ?? kindChipLabel(entry.kind, strings),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- strings follow locale
    [chip, locale],
  );

  const resolvedTags = useMemo<readonly SelectionTag[]>(
    () =>
      tags ?? [
        { id: "all", label: strings.filterAll },
        { id: "owned", label: strings.filterOwned },
        { id: "shared", label: strings.filterShared },
      ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- strings follow locale
    [tags, locale],
  );

  const activeSortKey = sortKeys[sortIndex % Math.max(sortKeys.length, 1)] ?? { id: "name" };
  const activeSortLabel =
    activeSortKey.label ??
    (activeSortKey.id === "name"
      ? strings.sortName
      : activeSortKey.id === "size"
        ? strings.sortSize
        : activeSortKey.id.toUpperCase());

  // Ownership pills scope which entries under the current path the gallery
  // renders (D11): entries owned by the operator vs shared with them. Kinds
  // are distinguished by their icons, not filters. Folders always render
  // first; the active sort key orders within each group. Entries default to
  // owned when no ownershipOf callback is configured.
  const visible = useMemo(() => {
    const matches = (entry: FileEntrySummary): boolean => {
      if (filter === "all") {
        return true;
      }
      if (filter === "shared") {
        return ownershipOf?.(entry) === "shared";
      }
      if (filter === "owned") {
        return ownershipOf?.(entry) !== "shared";
      }
      return true;
    };
    const filtered = (entries ?? []).filter(matches);
    const compare = (a: FileEntrySummary, b: FileEntrySummary): number => {
      if (activeSortKey.id === "size") {
        return b.sizeBytes - a.sizeBytes;
      }
      return a.name.localeCompare(b.name);
    };
    const folders = filtered.filter((entry) => entry.kind === "folder").sort(compare);
    const files = filtered.filter((entry) => entry.kind !== "folder").sort(compare);
    return [...folders, ...files];
  }, [entries, filter, ownershipOf, activeSortKey]);

  const currentFolder = path.length > 0 ? (path[path.length - 1] as FileEntrySummary) : null;
  const toolbarTitle = currentFolder !== null ? currentFolder.name : (rootTitle ?? strings.rootTitle);
  const toolbarDescription =
    currentFolder !== null
      ? `${metaFor(currentFolder)} · ${chipFor(currentFolder)}`
      : (rootDescription ?? strings.rootDescription);
  const sectionLabel =
    search !== null ? formatMessage(strings.searchingFor, { query: search.query }) : strings.filesSection;
  const countLine = `${formatMessage(strings.visibleCount, { count: visible.length })}${
    search === null && path.length === 0 ? ` · ${strings.foldersPlusFiles}` : ""
  }`;

  // Whole tile is the click target (File Tile doc): folder kinds navigate
  // into the folder; every other kind emits the open-file intent.
  const openEntry = useCallback(
    (entry: FileEntrySummary): void => {
      if (entry.kind === "folder") {
        setPath((prev) => [...prev, entry]);
        setFilter("all");
        setSearch(null);
        return;
      }
      emitPrismEvent("file-viewer.open-file", {
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        sizeBytes: entry.sizeBytes,
        scopeId: currentFolder !== null ? currentFolder.id : null,
        ontologyInterface: "IFileEntry",
      } satisfies OpenFileIntent);
    },
    [currentFolder],
  );

  // Breadcrumb back-navigation: -1 → root; i → segments[i] becomes current.
  const navigate = useCallback((targetIndex: number): void => {
    setPath((prev) => (targetIndex < 0 ? [] : prev.slice(0, targetIndex + 1)));
    setSearch(null);
  }, []);

  // + NEW emits the creation intent for the current path (D11): NEW FOLDER
  // targets an IFileEntry of kind folder; NEW FILE an IDossierDoc draft /
  // IFileEntry.
  const create = useCallback(
    (target: CreateTarget): void => {
      const scopeId = currentFolder !== null ? currentFolder.id : null;
      if (target === "folder") {
        emitPrismEvent("file-viewer.create-folder", {
          scopeId,
          ontologyInterfaces: ["IFileEntry"],
        } satisfies CreateFolderIntent);
        return;
      }
      emitPrismEvent("file-viewer.create-file", {
        scopeId,
        ontologyInterfaces: ["IDossierDoc", "IFileEntry"],
      } satisfies CreateFileIntent);
    },
    [currentFolder],
  );

  const cycleSort = (): void => {
    setSortIndex((index) => index + 1);
  };

  const retry = (): void => {
    setReloadToken((token) => token + 1);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed !== "") {
      setSearch({ query: trimmed });
    }
  };

  const clearSearch = (): void => {
    setSearch(null);
    setQuery("");
  };

  return (
    <Stack gap={0} w="100%" miw={0} style={{ background: DEEP }} data-testid="file-viewer">
      {/* Hub header: wordmark + inventory subtitle, Layout Toggle patterns
          immediately right of the title, then search / SORT / + NEW (create
          menu: NEW FOLDER / NEW FILE under the current path). */}
      <HubHeader
        strings={strings}
        title={title}
        inventorySubtitle={inventorySubtitle}
        layout={layout}
        onLayoutChange={setLayout}
        query={query}
        onQueryChange={setQuery}
        onSubmitSearch={submitSearch}
        activeSortLabel={activeSortLabel}
        onSortCycle={cycleSort}
        onCreate={create}
      />

      {/* Viewer toolbar: breadcrumb path (top left, ALWAYS the full current
          path with back-navigation), current title + description, ownership
          filter pills; FILES gallery. */}
      <Stack gap={0} px={24} pt={20} pb={24} miw={0}>
        <ViewerToolbar
          strings={strings}
          segments={path.map((entry) => ({ id: entry.id, name: entry.name }))}
          title={toolbarTitle}
          description={toolbarDescription}
          tags={resolvedTags}
          filter={filter}
          onFilterChange={setFilter}
          onNavigate={navigate}
        />
        <FilesGallery
          strings={strings}
          layout={layout}
          phase={phase}
          errorMessage={errorMessage}
          searchActive={search !== null}
          sectionLabel={sectionLabel}
          countLine={countLine}
          onClearSearch={clearSearch}
          entries={visible}
          metaFor={metaFor}
          chipFor={chipFor}
          onOpen={openEntry}
          onRetry={retry}
          maxHeight={galleryMaxHeight}
        />
      </Stack>
    </Stack>
  );
}
