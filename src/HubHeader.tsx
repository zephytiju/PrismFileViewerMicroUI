import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Box, Group, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { LayoutToggle } from "./LayoutToggle.js";
import type { ViewerLayout } from "./LayoutToggle.js";
import { SearchIcon } from "./icons.js";
import type { FileViewerStrings } from "./locales/index.js";
import { ACCENT, BORDER, CARD_BG, CARD_DARK, DEEP, LINE, MONO, MUTED, TEXT } from "./viewerTokens.js";

/** What the + NEW menu creates — both scoped to the current path (D11). */
export type CreateTarget = "file" | "folder";

/** State and handlers the FileViewer hands to its hub header bar. */
export interface HubHeaderProps {
  /** Locale string table (title fallback, control labels). */
  readonly strings: FileViewerStrings;
  /** Hub wordmark override (defaults to the locale's `title`). */
  readonly title?: string;
  /** Inventory subtitle override (defaults to the locale's). */
  readonly inventorySubtitle?: string;
  /** Currently active gallery pattern (rendered by the Layout Toggle). */
  readonly layout: ViewerLayout;
  /** Invoked when the operator picks a gallery pattern. */
  readonly onLayoutChange: (layout: ViewerLayout) => void;
  /** Current workspace-search query text. */
  readonly query: string;
  /** Invoked on every keystroke of the search field. */
  readonly onQueryChange: (query: string) => void;
  /** Submit handler of the search form (issues the ISearchable query). */
  readonly onSubmitSearch: (event: FormEvent<HTMLFormElement>) => void;
  /** Label of the sort key the SORT control currently holds. */
  readonly activeSortLabel: string;
  /** Invoked when the operator clicks SORT (cycles to the next sort key). */
  readonly onSortCycle: () => void;
  /**
   * Invoked when the operator picks a + NEW menu entry — "folder" or "file"
   * (dossier). Both creation intents are scoped to the current path (D11);
   * the host FileViewer emits the corresponding intent.
   */
  readonly onCreate: (target: CreateTarget) => void;
}

/**
 * Hub header bar of the file-viewer surface (v9.3 prototype header): the
 * wordmark + inventory subtitle, the Layout Toggle patterns immediately right
 * of the title, the workspace search, SORT, and the + NEW control opening the
 * create menu — NEW FOLDER / NEW FILE (DOSSIER), both created under the
 * CURRENT path at any level (decision D11). A presentation module rendered by
 * the FileViewer composition (decision D9); it holds no Lattice bindings of
 * its own — every interaction is delegated up (only the menu's open/closed
 * ephemeral presentation state lives here).
 *
 * No palette is hardcoded: every surface resolves to a semantic theme token
 * supplied by the host's MantineProvider.
 */
export function HubHeader({
  strings,
  title,
  inventorySubtitle,
  layout,
  onLayoutChange,
  query,
  onQueryChange,
  onSubmitSearch,
  activeSortLabel,
  onSortCycle,
  onCreate,
}: HubHeaderProps) {
  // Ephemeral presentation state of the + NEW dropdown (v9.3 #newMenu):
  // toggled by the control, closed by item pick, outside click, or Escape.
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const close = (): void => {
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const pick = (target: CreateTarget): void => {
    setMenuOpen(false);
    onCreate(target);
  };

  const menuItem = (target: CreateTarget, label: string, testid: string): React.JSX.Element => (
    <UnstyledButton
      type="button"
      ff={MONO}
      fz={9}
      fw={500}
      c={TEXT}
      style={{ letterSpacing: "0.02em", display: "flex", alignItems: "center", height: 34, padding: "0 14px", width: "100%" }}
      data-testid={testid}
      onClick={() => {
        pick(target);
      }}
    >
      {label}
    </UnstyledButton>
  );

  return (
    <Group
      gap={12}
      wrap="nowrap"
      align="center"
      px={20}
      h={72}
      style={{ background: CARD_DARK, borderBottom: `1px solid ${LINE}`, position: "relative" }}
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
        onLayoutChange={onLayoutChange}
        gridLabel={strings.layoutGrid}
        listLabel={strings.layoutList}
      />
      <Box style={{ flex: 1 }} />
      <form onSubmit={onSubmitSearch} data-testid="file-viewer-search-form">
        <TextInput
          w={260}
          aria-label={strings.searchPlaceholder}
          placeholder={strings.searchPlaceholder}
          value={query}
          onChange={(event) => {
            onQueryChange(event.currentTarget.value);
          }}
          leftSection={
            <span style={{ color: ACCENT, display: "inline-flex" }}>
              <SearchIcon size={13} />
            </span>
          }
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
        onClick={onSortCycle}
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
      {/* + NEW control with the create menu (v9.3 #newBtn / #newMenu): NEW
          FOLDER and NEW FILE (DOSSIER), both created under the current path. */}
      <Box ref={rootRef} style={{ position: "relative", flexShrink: 0 }} data-testid="file-viewer-new-wrap">
        <UnstyledButton
          type="button"
          title={strings.createMenuLabel}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-testid="file-viewer-new"
          onClick={(event) => {
            // Stop propagation so the toggle click does not reach the
            // document listener that closes the menu (v9.3 stopPropagation).
            event.stopPropagation();
            setMenuOpen((open) => !open);
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
          }}
        >
          {strings.newControl}
        </UnstyledButton>
        {menuOpen ? (
          <Box
            p={4}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: 190,
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 5,
              zIndex: 200,
            }}
            data-testid="file-viewer-new-menu"
            role="menu"
          >
            {menuItem("folder", strings.newFolder, "file-viewer-new-folder")}
            {menuItem("file", strings.newFileItem, "file-viewer-new-file")}
          </Box>
        ) : null}
      </Box>
    </Group>
  );
}
