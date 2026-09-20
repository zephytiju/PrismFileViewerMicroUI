import { Box, UnstyledButton } from "@mantine/core";
import { GridPatternIcon, ListPatternIcon } from "./icons.js";

/** Gallery presentation offered by the toggle (grid tiles / list rows). */
export type ViewerLayout = "grid" | "list";

export interface LayoutToggleProps {
  /** Currently active pattern. */
  readonly layout: ViewerLayout;
  /** Invoked when the operator picks a pattern. */
  readonly onLayoutChange: (layout: ViewerLayout) => void;
  /** Accessible label for the grid pattern (locale-resolved by the host component). */
  readonly gridLabel: string;
  /** Accessible label for the list pattern (locale-resolved by the host component). */
  readonly listLabel: string;
}

const DEEP = "var(--mantine-color-deep-filled)";
const INPUT_BG = "var(--mantine-color-input-filled)";
const MUTED = "var(--mantine-color-muted-filled)";
const ACCENT = "var(--mantine-color-accent-filled)";

/**
 * Layout Toggle sub-component library (v9 prototype .view-toggle): the two
 * presentation patterns — grid ▦ (default) and list ☰ — rendered immediately
 * right of the hub title inside the File Viewer's hub header. Selecting a
 * pattern switches the FILES gallery between tiles and full-width rows.
 *
 * Pure view state — no backend calls. Rendered inside the host axiom
 * component; never a Prism composition member (decision D5), and
 * independently reusable by any future axiom component.
 *
 * No palette is hardcoded: the inactive/active pattern colors resolve to
 * semantic theme tokens (deep / input / muted / accent) supplied by the
 * host's MantineProvider.
 */
export function LayoutToggle({ layout, onLayoutChange, gridLabel, listLabel }: LayoutToggleProps) {
  const pattern = (
    id: ViewerLayout,
    label: string,
    Icon: typeof GridPatternIcon,
  ): React.JSX.Element => {
    const active = layout === id;
    return (
      <UnstyledButton
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        data-testid={`file-viewer-layout-${id}`}
        onClick={() => {
          onLayoutChange(id);
        }}
        style={{
          width: 44,
          height: 32,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: active ? ACCENT : MUTED,
          background: active ? INPUT_BG : "transparent",
        }}
      >
        <Icon size={15} />
      </UnstyledButton>
    );
  };

  return (
    <Box
      h={42}
      px={5}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: DEEP,
        borderRadius: 5,
        flexShrink: 0,
      }}
      data-testid="file-viewer-layout-toggle"
      role="group"
    >
      {pattern("grid", gridLabel, GridPatternIcon)}
      {pattern("list", listLabel, ListPatternIcon)}
    </Box>
  );
}
