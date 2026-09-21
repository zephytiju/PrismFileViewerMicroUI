import { Box, Text } from "@mantine/core";
import { SelectionTags } from "./SelectionTags.js";
import type { SelectionTag } from "./SelectionTags.js";
import { ViewerBreadcrumb } from "./ViewerBreadcrumb.js";
import type { ViewerPathSegment } from "./ViewerBreadcrumb.js";
import type { FileViewerStrings } from "./locales/index.js";
import { MUTED, TEXT } from "./viewerTokens.js";

/** State and handlers the FileViewer hands to its viewer toolbar. */
export interface ViewerToolbarProps {
  /** Locale string table (breadcrumb labels). */
  readonly strings: FileViewerStrings;
  /** Entered folders in order (the breadcrumb path). */
  readonly segments: readonly ViewerPathSegment[];
  /** Current scope title (folder name, or the configured root title). */
  readonly title: string;
  /** Current scope description (folder meta · chip, or the root description). */
  readonly description: string;
  /** Offered filter pill set. */
  readonly tags: readonly SelectionTag[];
  /** Currently active filter id. */
  readonly filter: string;
  /** Invoked when the operator picks a filter pill. */
  readonly onFilterChange: (id: string) => void;
  /**
   * Breadcrumb back-navigation: -1 returns to the root; i >= 0 navigates to
   * segments[i] (that folder becomes the current scope).
   */
  readonly onNavigate: (targetIndex: number) => void;
}

/**
 * Viewer toolbar of the file-viewer surface (v9.3 prototype toolbar head): the
 * breadcrumb path at the top left — ALWAYS the full current path
 * `NEXUS / VAULT / ALL FILES / …folders`, every ancestor segment a
 * back-navigation target — plus the current scope's title/description and
 * the Selection Tags ownership filter pills scoping the FILES gallery below
 * (ALL / OWNED BY ME / SHARED WITH ME, D11). A presentation module rendered
 * by the FileViewer composition (decision D9); navigation and filtering are
 * delegated up through the callbacks.
 *
 * No palette is hardcoded: every surface resolves to a semantic theme token
 * supplied by the host's MantineProvider.
 */
export function ViewerToolbar({
  strings,
  segments,
  title,
  description,
  tags,
  filter,
  onFilterChange,
  onNavigate,
}: ViewerToolbarProps) {
  return (
    <>
      <ViewerBreadcrumb
        segments={segments}
        homeLabel={strings.crumbHome}
        areaLabel={strings.crumbArea}
        rootLabel={strings.crumbRoot}
        onNavigate={onNavigate}
      />
      <Text
        fz={24}
        fw={600}
        mt={12}
        style={{ color: TEXT, letterSpacing: "0.01em" }}
        data-testid="file-viewer-path-title"
      >
        {title}
      </Text>
      <Text fz={11} mt={6} style={{ color: MUTED }} data-testid="file-viewer-path-description">
        {description}
      </Text>
      <Box mt={16}>
        <SelectionTags tags={tags} active={filter} onChange={onFilterChange} />
      </Box>
    </>
  );
}
