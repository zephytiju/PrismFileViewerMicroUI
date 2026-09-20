import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Alert, Box, Button, Group, Skeleton, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import {
  createFileEntryClient,
  createSearchableClient,
} from "@zephytiju/lattice-common-interfaces";
import type { FileEntrySummary } from "@zephytiju/lattice-common-interfaces";
import { emitPrismEvent, useLatticeTransport, usePrismStateSetter } from "@zephytiju/prism-react";
import { FileTile, defaultMetaFor } from "./FileTile.js";
import { LayoutToggle } from "./LayoutToggle.js";
import type { ViewerLayout } from "./LayoutToggle.js";
import { SelectionTags } from "./SelectionTags.js";
import type { SelectionTag } from "./SelectionTags.js";
import { ViewerBreadcrumb } from "./ViewerBreadcrumb.js";
import type { ViewerPathSegment } from "./ViewerBreadcrumb.js";
import { SearchIcon } from "./icons.js";
import { kindChipLabel } from "./kinds.js";
import { formatMessage, stringsForLocale } from "./locales/index.js";
import type { FileViewerLocale } from "./locales/index.js";

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

/** Payload of the `file-viewer.create-file` intent (+ NEW FILE). */
export interface CreateFileIntent {
  /** Folder to create in (current scope; null at the root). */
  readonly scopeId: string | null;
  /** Ontology interfaces the creation targets: an IDossierDoc draft / an IFileEntry. */
  readonly ontologyInterfaces: readonly ["IDossierDoc", "IFileEntry"];
}

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
  /** Filter pill set (defaults to the six builtin tags, labels from the locale). */
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
  /** Whether an entry is shared — scopes the builtin SHARED filter pill. */
  readonly shared?: (entry: FileEntrySummary) => boolean;
  /** Page size for ISearchable queries (default 50). */
  readonly pageSize?: number;
  /** Max height of the scrollable gallery area (default 360). */
  readonly galleryMaxHeight?: number | string;
}

const MONO = "var(--mantine-font-family-monospace)";
const TEXT = "var(--mantine-color-text-filled)";
const MUTED = "var(--mantine-color-muted-filled)";
const DEEP = "var(--mantine-color-deep-filled)";
const CARD_DARK = "var(--mantine-color-card-dark-filled)";
const CARD_BG = "var(--mantine-color-card-filled)";
const BORDER = "var(--mantine-color-border-filled)";
const LINE = "var(--mantine-color-line-filled)";
const ACCENT = "var(--mantine-color-accent-filled)";

const DEFAULT_SORT_KEYS: readonly ViewerSortKey[] = [{ id: "name" }, { id: "size" }];
const DEFAULT_PAGE_SIZE = 50;

/**
 * Platform Prism file-viewer micro-UI (component id "file-viewer") — the
 * merged VAULT main-viewport surface (decision D9): hub header (wordmark +
 * inventory subtitle, Layout Toggle patterns immediately right of the title,
 * workspace search, SORT, + NEW FILE), viewer toolbar (breadcrumb path at
 * the top left — every ancestor segment a back-navigation target — plus the
 * current title/description and Selection Tags filter pills), and the FILES
 * gallery: one gallery-style explorer area rendering both folders and
 * individual files as uniform tiles, folders first, every file kind
 * carrying its distinct icon.
 *
 * Lattice bindings (embedded, per the Micro-UI standards): gallery items
 * render IFileEntry records fetched through the generated FileEntryClient
 * over useLatticeTransport — entering a folder queries the entry's children
 * (scope = folder id) and pushes a path segment; the workspace search
 * issues ISearchable queries; + NEW FILE emits a creation intent
 * (IDossierDoc draft / IFileEntry); sort, layout, and filter are local view
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
  shared,
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
  const [phase, setPhase] = useState<"busy" | "ok" | "error">("busy");
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

  // Entering a folder queries the entry's children; a search issues an
  // ISearchable query. Cancelled renders keep only the latest response.
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
        { id: "folders", label: strings.filterFolders },
        { id: "dossiers", label: strings.filterDossiers },
        { id: "boards", label: strings.filterBoards },
        { id: "world", label: strings.filterWorld },
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

  // Filter pills scope which entries the gallery renders; folders always
  // render first; the active sort key orders within each group.
  const visible = useMemo(() => {
    const matches = (entry: FileEntrySummary): boolean => {
      if (filter === "all") {
        return true;
      }
      if (filter === "shared") {
        return shared?.(entry) === true;
      }
      if (filter === "folders") {
        return entry.kind === "folder";
      }
      if (filter === "dossiers") {
        return entry.kind === "dossier";
      }
      if (filter === "boards") {
        return entry.kind === "board";
      }
      if (filter === "world") {
        return entry.kind === "world";
      }
      return entry.kind === filter;
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
  }, [entries, filter, shared, activeSortKey]);

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

  const galleryBody = (): React.JSX.Element => {
    if (phase === "error") {
      return (
        <Alert variant="light" color="threat" title={strings.errorTitle} data-testid="file-viewer-error">
          <Stack gap="sm">
            <Text size="sm" data-testid="file-viewer-error-message">
              {errorMessage}
            </Text>
            <Group>
              <Button
                variant="default"
                data-testid="file-viewer-retry"
                onClick={() => {
                  setReloadToken((token) => token + 1);
                }}
              >
                {strings.retry}
              </Button>
            </Group>
          </Stack>
        </Alert>
      );
    }
    if (phase === "busy") {
      return (
        <div
          style={
            layout === "grid"
              ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(176px, 1fr))", gap: 12 }
              : { display: "flex", flexDirection: "column", gap: 8 }
          }
          data-testid="file-viewer-loading"
          aria-busy="true"
        >
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} height={layout === "grid" ? 156 : 62} radius="md" />
          ))}
        </div>
      );
    }
    if (visible.length === 0) {
      return (
        <Text ff={MONO} fz={9} style={{ color: MUTED, letterSpacing: "0.02em" }} data-testid="file-viewer-empty">
          {search !== null ? strings.emptySearch : strings.emptyFiltered}
        </Text>
      );
    }
    return layout === "grid" ? (
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(176px, 1fr))", gap: 12 }}
        role="list"
      >
        {visible.map((entry) => (
          <FileTile
            key={entry.id}
            model={{ entry, meta: metaFor(entry), chip: chipFor(entry) }}
            variant="tile"
            strings={strings}
            onOpen={openEntry}
          />
        ))}
      </div>
    ) : (
      <Stack gap={8} role="list">
        {visible.map((entry) => (
          <FileTile
            key={entry.id}
            model={{ entry, meta: metaFor(entry), chip: chipFor(entry) }}
            variant="row"
            strings={strings}
            onOpen={openEntry}
          />
        ))}
      </Stack>
    );
  };

  return (
    <Stack gap={0} w="100%" miw={0} style={{ background: DEEP }} data-testid="file-viewer">
      {/* Hub header: wordmark + inventory subtitle, Layout Toggle patterns
          immediately right of the title, then search / SORT / + NEW FILE. */}
      <Group
        gap={12}
        wrap="nowrap"
        align="center"
        px={20}
        h={72}
        style={{ background: CARD_DARK, borderBottom: `1px solid ${LINE}` }}
        data-testid="file-viewer-hub-header"
      >
        <Stack gap={3} miw={0} style={{ flex: "0 1 auto" }}>
          <Text fz={15} fw={600} truncate="end" style={{ color: TEXT }} data-testid="file-viewer-title">
            {title ?? strings.title}
          </Text>
          <Text
            ff={MONO}
            fz={9}
            truncate="end"
            style={{ color: MUTED, letterSpacing: "0.02em" }}
            data-testid="file-viewer-subtitle"
          >
            {inventorySubtitle ?? strings.inventorySubtitle}
          </Text>
        </Stack>
        <LayoutToggle
          layout={layout}
          onLayoutChange={setLayout}
          gridLabel={strings.layoutGrid}
          listLabel={strings.layoutList}
        />
        <Box style={{ flex: 1 }} />
        <form onSubmit={submitSearch} data-testid="file-viewer-search-form">
          <TextInput
            w={260}
            aria-label={strings.searchPlaceholder}
            placeholder={strings.searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            leftSection={<span style={{ color: ACCENT, display: "inline-flex" }}><SearchIcon size={13} /></span>}
            data-testid="file-viewer-search-input"
            styles={{
              input: {
                height: 42,
                borderRadius: 5,
                background: DEEP,
                borderColor: ACCENT,
                fontFamily: MONO,
                fontSize: 10,
                color: TEXT,
              },
            }}
          />
        </form>
        <UnstyledButton
          type="button"
          title={strings.sort}
          data-testid="file-viewer-sort"
          onClick={() => {
            setSortIndex((index) => index + 1);
          }}
          style={{
            height: 42,
            padding: "0 14px",
            borderRadius: 5,
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 500,
            color: TEXT,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {`${strings.sort} · ${activeSortLabel} ↓`}
        </UnstyledButton>
        <UnstyledButton
          type="button"
          data-testid="file-viewer-new-file"
          onClick={() => {
            emitPrismEvent("file-viewer.create-file", {
              scopeId: currentFolder !== null ? currentFolder.id : null,
              ontologyInterfaces: ["IDossierDoc", "IFileEntry"],
            } satisfies CreateFileIntent);
          }}
          style={{
            height: 42,
            padding: "0 16px",
            borderRadius: 5,
            background: ACCENT,
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 500,
            color: DEEP,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {strings.newFile}
        </UnstyledButton>
      </Group>

      {/* Viewer toolbar: breadcrumb path (top left, back-navigation), current
          title + description, Selection Tags filter pills; FILES gallery. */}
      <Stack gap={0} px={24} pt={20} pb={24} miw={0}>
        <ViewerBreadcrumb
          segments={path.map((entry) => ({ id: entry.id, name: entry.name }))}
          homeLabel={strings.crumbHome}
          areaLabel={strings.crumbArea}
          rootLabel={strings.crumbRoot}
          onNavigate={navigate}
        />
        <Text
          fz={24}
          fw={600}
          mt={12}
          style={{ color: TEXT, letterSpacing: "0.01em" }}
          data-testid="file-viewer-path-title"
        >
          {toolbarTitle}
        </Text>
        <Text fz={11} mt={6} style={{ color: MUTED }} data-testid="file-viewer-path-description">
          {toolbarDescription}
        </Text>
        <Box mt={16}>
          <SelectionTags tags={resolvedTags} active={filter} onChange={setFilter} />
        </Box>
        <Group justify="space-between" align="center" wrap="nowrap" mt={24}>
          <Text fz={11} fw={600} style={{ color: TEXT, letterSpacing: "0.02em" }} data-testid="file-viewer-section-label">
            {sectionLabel}
          </Text>
          <Group gap={12} wrap="nowrap" align="center">
            {search !== null ? (
              <UnstyledButton
                type="button"
                ff={MONO}
                fz={9}
                fw={500}
                c="accent"
                style={{ letterSpacing: "0.02em" }}
                data-testid="file-viewer-clear-search"
                onClick={clearSearch}
              >
                {strings.clearSearch}
              </UnstyledButton>
            ) : null}
            <Text ff={MONO} fz={9} style={{ color: MUTED, letterSpacing: "0.02em" }} data-testid="file-viewer-count">
              {countLine}
            </Text>
          </Group>
        </Group>
        <Box
          mt={10}
          style={{ overflowY: "auto", maxHeight: galleryMaxHeight }}
          data-testid="file-viewer-gallery"
        >
          {galleryBody()}
        </Box>
      </Stack>
    </Stack>
  );
}
