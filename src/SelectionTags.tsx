import { Box, UnstyledButton } from "@mantine/core";

/** One filter pill (Selection Tags sub-library). */
export interface SelectionTag {
  /** Stable filter id — builtin ids carry builtin scoping semantics. */
  readonly id: string;
  /** Pill label (locale-resolved by the host component). */
  readonly label: string;
}

export interface SelectionTagsProps {
  /** The offered tag set (configuration; defaults to the six builtin tags). */
  readonly tags: readonly SelectionTag[];
  /** Currently active tag id. */
  readonly active: string;
  /** Invoked when the operator picks a tag. */
  readonly onChange: (id: string) => void;
}

const CARD_BG = "var(--mantine-color-card-filled)";
const DEEP = "var(--mantine-color-deep-filled)";
const BORDER = "var(--mantine-color-border-filled)";
const MUTED = "var(--mantine-color-muted-filled)";
const ACCENT = "var(--mantine-color-accent-filled)";
const MONO = "var(--mantine-font-family-monospace)";

/**
 * Selection Tags sub-component library (v9 prototype .filters / .fp): the
 * horizontal filter pill row under the viewer toolbar — ALL (active),
 * FOLDERS, DOSSIERS, BOARDS, WORLD VIEWS, SHARED. The active pill is
 * highlighted; selecting a tag scopes which file entries the FILES gallery
 * renders.
 *
 * Pure view state — no backend calls. Rendered inside the host axiom
 * component; never a Prism composition member (decision D5), and
 * independently reusable by any future axiom component.
 *
 * No palette is hardcoded: inactive/active pill colors resolve to semantic
 * theme tokens (card / deep / border / muted / accent) supplied by the
 * host's MantineProvider.
 */
export function SelectionTags({ tags, active, onChange }: SelectionTagsProps) {
  return (
    <Box style={{ display: "flex", gap: 8, flexWrap: "wrap" }} data-testid="file-viewer-filters">
      {tags.map((tag) => {
        const on = tag.id === active;
        return (
          <UnstyledButton
            key={tag.id}
            type="button"
            fz={9}
            fw={500}
            data-testid={`file-viewer-filter-${tag.id}`}
            aria-pressed={on}
            onClick={() => {
              onChange(tag.id);
            }}
            style={{
              fontFamily: MONO,
              height: 32,
              padding: "0 16px",
              borderRadius: 16,
              color: on ? ACCENT : MUTED,
              background: on ? DEEP : CARD_BG,
              border: `1px solid ${on ? ACCENT : BORDER}`,
              letterSpacing: "0.02em",
            }}
          >
            {tag.label}
          </UnstyledButton>
        );
      })}
    </Box>
  );
}
