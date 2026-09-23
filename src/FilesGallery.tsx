import { Alert, Box, Button, Group, Skeleton, Stack, Text, UnstyledButton } from "@mantine/core";
import type { FileEntrySummary } from "@zephytiju/lattice-common-interfaces";
import { FileTile } from "./FileTile.js";
import type { ViewerLayout } from "./LayoutToggle.js";
import type { FileViewerStrings } from "./locales/index.js";
import { MONO, MUTED, TEXT } from "./viewerTokens.js";

/** Load phase of the gallery's current query. */
export type GalleryPhase = "busy" | "ok" | "error";

/** State and handlers the FileViewer hands to its FILES gallery. */
export interface FilesGalleryProps {
  /** Locale string table (section label fallbacks, error/empty copy). */
  readonly strings: FileViewerStrings;
  /** Gallery presentation: grid tiles or list rows. */
  readonly layout: ViewerLayout;
  /** Load phase of the current query (drives body / skeleton / error). */
  readonly phase: GalleryPhase;
  /** Error detail shown in the error branch's retry Alert. */
  readonly errorMessage: string;
  /** Whether a search is active (picks the empty-state copy). */
  readonly searchActive: boolean;
  /** Section label line (FILES, or the searching-for message). */
  readonly sectionLabel: string;
  /** Mono visible-count line right of the section label. */
  readonly countLine: string;
  /** Invoked when the operator clears the active search. */
  readonly onClearSearch: () => void;
  /** Filtered + ordered entries to render (folders first). */
  readonly entries: readonly FileEntrySummary[];
  /** Mono meta line resolver for each rendered entry. */
  readonly metaFor: (entry: FileEntrySummary) => string;
  /** Category chip label resolver for each rendered entry. */
  readonly chipFor: (entry: FileEntrySummary) => string;
  /** Whole tile is the click target: folder → navigate, file → open. */
  readonly onOpen: (entry: FileEntrySummary) => void;
  /** Invoked from the error branch's Retry button. */
  readonly onRetry: () => void;
  /** Max height of the scrollable gallery area. */
  readonly maxHeight: number | string;
}

/**
 * FILES gallery of the file-viewer surface (v9 prototype explorer): the
 * gallery-style explorer area rendering both folders and individual files as
 * uniform File Tile members, folders first, in the grid or list presentation
 * chosen through the Layout Toggle. Owns the section label row (FILES ·
 * visible count, plus the clear-search control while a search is active) and
 * the scrollable body with its load phases: error-with-retry, skeletons
 * while busy, the empty state, and the rendered tiles/rows. A presentation
 * module rendered by the FileViewer composition (decision D3/D9); entry
 * resolution and interactions are delegated up.
 *
 * No palette is hardcoded: every surface resolves to a semantic theme token
 * supplied by the host's MantineProvider.
 */
export function FilesGallery({
  strings,
  layout,
  phase,
  errorMessage,
  searchActive,
  sectionLabel,
  countLine,
  onClearSearch,
  entries,
  metaFor,
  chipFor,
  onOpen,
  onRetry,
  maxHeight,
}: FilesGalleryProps) {
  const body = (): React.JSX.Element => {
    if (phase === "error") {
      return (
        <Alert variant="light" color="threat" title={strings.errorTitle} data-testid="file-viewer-error">
          <Stack gap="sm">
            <Text size="sm" data-testid="file-viewer-error-message">
              {errorMessage}
            </Text>
            <Group>
              <Button variant="default" data-testid="file-viewer-retry" onClick={onRetry}>
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
    if (entries.length === 0) {
      return (
        <Text ff={MONO} fz={9} style={{ color: MUTED, letterSpacing: "0.02em" }} data-testid="file-viewer-empty">
          {searchActive ? strings.emptySearch : strings.emptyFiltered}
        </Text>
      );
    }
    return layout === "grid" ? (
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(176px, 1fr))", gap: 12 }}
        role="list"
      >
        {entries.map((entry) => (
          <FileTile
            key={entry.id}
            model={{ entry, meta: metaFor(entry), chip: chipFor(entry) }}
            variant="tile"
            strings={strings}
            onOpen={onOpen}
          />
        ))}
      </div>
    ) : (
      <Stack gap={8} role="list">
        {entries.map((entry) => (
          <FileTile
            key={entry.id}
            model={{ entry, meta: metaFor(entry), chip: chipFor(entry) }}
            variant="row"
            strings={strings}
            onOpen={onOpen}
          />
        ))}
      </Stack>
    );
  };

  return (
    <>
      <Group justify="space-between" align="center" wrap="nowrap" mt={24}>
        <Text fz={11} fw={600} style={{ color: TEXT, letterSpacing: "0.02em" }} data-testid="file-viewer-section-label">
          {sectionLabel}
        </Text>
        <Group gap={12} wrap="nowrap" align="center">
          {searchActive ? (
            <UnstyledButton
              type="button"
              ff={MONO}
              fz={9}
              fw={500}
              c="accent"
              style={{ letterSpacing: "0.02em" }}
              data-testid="file-viewer-clear-search"
              onClick={onClearSearch}
            >
              {strings.clearSearch}
            </UnstyledButton>
          ) : null}
          <Text ff={MONO} fz={9} style={{ color: MUTED, letterSpacing: "0.02em" }} data-testid="file-viewer-count">
            {countLine}
          </Text>
        </Group>
      </Group>
      <Box mt={10} style={{ overflowY: "auto", maxHeight }} data-testid="file-viewer-gallery">
        {body()}
      </Box>
    </>
  );
}
