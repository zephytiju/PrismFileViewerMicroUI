import { Group, Text, UnstyledButton } from "@mantine/core";

/** One entered folder in the viewer's navigation path (bounded: id + name). */
export interface ViewerPathSegment {
  readonly id: string;
  readonly name: string;
}

export interface ViewerBreadcrumbProps {
  /** Entered folders in order (empty at the root). */
  readonly segments: readonly ViewerPathSegment[];
  /** Wordmark of the home scope (locale-resolved by the host component). */
  readonly homeLabel: string;
  /** Wordmark of the VAULT area (locale-resolved by the host component). */
  readonly areaLabel: string;
  /** Label of the root scope (locale-resolved by the host component). */
  readonly rootLabel: string;
  /**
   * Back-navigation: -1 returns to the root; i >= 0 navigates to segments[i]
   * (that folder becomes the current scope). Every ancestor segment is a
   * target; the current segment renders plain.
   */
  readonly onNavigate: (targetIndex: number) => void;
}

const MONO = "var(--mantine-font-family-monospace)";
const ACCENT = "var(--mantine-color-accent-filled)";
const TEXT = "var(--mantine-color-text-filled)";
const MUTED = "var(--mantine-color-muted-filled)";

/**
 * Breadcrumb path of the viewer toolbar (v9 prototype .crumb): rendered at
 * the top left as `NEXUS / VAULT / …folder segments… / CURRENT`, extending
 * one segment per entered folder. Every ancestor segment — NEXUS, VAULT, and
 * each entered folder before the current one — is a back-navigation target;
 * the current segment is plain text. This is the viewer's navigation state,
 * published by the host File Viewer as the bounded-context shared slot
 * `vault.viewerPath` so peer components can interpret it (decision D8).
 *
 * No palette is hardcoded: colors resolve to semantic theme tokens (accent /
 * text / muted) supplied by the host's MantineProvider.
 */
export function ViewerBreadcrumb({
  segments,
  homeLabel,
  areaLabel,
  rootLabel,
  onNavigate,
}: ViewerBreadcrumbProps) {
  const segment = (
    key: string,
    label: string,
    targetIndex: number,
    testid: string,
  ): React.JSX.Element => (
    <UnstyledButton
      key={key}
      type="button"
      ff={MONO}
      fz={10}
      fw={500}
      c={ACCENT}
      style={{ letterSpacing: "0.04em" }}
      data-testid={testid}
      onClick={() => {
        onNavigate(targetIndex);
      }}
    >
      {label}
    </UnstyledButton>
  );

  const separator = (key: string): React.JSX.Element => (
    <Text key={key} ff={MONO} fz={10} c={MUTED} style={{ letterSpacing: "0.04em" }}>
      /
    </Text>
  );

  const current = segments.length === 0 ? rootLabel : segments[segments.length - 1]?.name ?? "";

  return (
    <Group gap={10} wrap="nowrap" align="center" data-testid="file-viewer-breadcrumb">
      {segment("home", homeLabel, -1, "file-viewer-crumb-home")}
      {separator("sep-home")}
      {segment("area", areaLabel, -1, "file-viewer-crumb-area")}
      {separator("sep-area")}
      {segments.slice(0, -1).map((folder, index) => (
        <Group key={folder.id} gap={10} wrap="nowrap" align="center">
          {segment(folder.id, folder.name, index, `file-viewer-crumb-${index}`)}
          {separator(`sep-${folder.id}`)}
        </Group>
      ))}
      <Text
        ff={MONO}
        fz={10}
        fw={500}
        c={TEXT}
        style={{ letterSpacing: "0.04em" }}
        data-testid="file-viewer-crumb-current"
      >
        {current}
      </Text>
    </Group>
  );
}
