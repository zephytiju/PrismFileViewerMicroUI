import type { ViewerSortKey } from "./FileViewer.js";

/**
 * Shared building blocks of the file-viewer surface modules (HubHeader,
 * ViewerToolbar, FilesGallery, and the FileViewer composition itself):
 *
 *  - the semantic theme-token constants every module styles with, and
 *  - the component's configuration defaults (sort keys, query page size).
 *
 * No palette is hardcoded: every token is a semantic Mantine CSS variable
 * resolved by the host's MantineProvider.
 */

/** Monospace font token (mono meta lines, controls, breadcrumb). */
export const MONO = "var(--mantine-font-family-monospace)";
/** Primary text token. */
export const TEXT = "var(--mantine-color-text-filled)";
/** Muted text token. */
export const MUTED = "var(--mantine-color-muted-filled)";
/** Deep background token (page-level surface). */
export const DEEP = "var(--mantine-color-deep-filled)";
/** Card-dark surface token (the hub header bar). */
export const CARD_DARK = "var(--mantine-color-card-dark-filled)";
/** Card surface token (tiles, controls). */
export const CARD_BG = "var(--mantine-color-card-filled)";
/** Border token (controls). */
export const BORDER = "var(--mantine-color-border-filled)";
/** Hairline separator token. */
export const LINE = "var(--mantine-color-line-filled)";
/** Accent token (brand highlights, active states). */
export const ACCENT = "var(--mantine-color-accent-filled)";

/** Offered sort keys by default: name first, then size. */
export const DEFAULT_SORT_KEYS: readonly ViewerSortKey[] = [{ id: "name" }, { id: "size" }];

/** Page size for ISearchable queries. */
export const DEFAULT_PAGE_SIZE = 50;
