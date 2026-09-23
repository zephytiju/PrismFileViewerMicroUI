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
   * (that folder becomes the current scope). Every ancestor segment — NEXUS,
   * VAULT, the root scope, and each entered folder before the current one —
   * is a target; the current segment renders plain.
   */
  readonly onNavigate: (targetIndex: number) => void;
}

const MONO = "var(--mantine-font-family-monospace)";
const ACCENT = "var(--mantine-color-accent-filled)";
const TEXT = "var(--mantine-color-text-filled)";
const MUTED = "var(--mantine-color-muted-filled)";

/**
 * Breadcrumb path of the viewer toolbar (v9.3 prototype .crumb): rendered at
 * the top left and ALWAYS reflecting the full current path (decision D11) —
 * `NEXUS / VAULT / <root scope> / …folder segments… / CURRENT`. The root
 * scope segment (ALL FILES) is a persistent path segment like in a standard
 * file explorer: at the root it is the plain current segment, and once a
 * folder is entered it stays in the path as a clickable ancestor while each
 * entered folder APPENDS one segment after it. Every ancestor segment —
 * NEXUS, VAULT, the root scope, and each entered folder before the current
 * one — is a back-navigation target; the current segment is plain text. This
 * is the viewer's navigation state, published by the host File Viewer as the
 * bounded-context shared slot `vault.viewerPath` so peer components can
 * interpret it (decision D8).
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

  const atRoot = segments.length === 0;
  // The root scope (ALL FILES) is a persistent path segment: plain-current at
  // the root, a clickable ancestor once any folder has been entered (D11).
  const rootSegment = atRoot ? (
    <Text
      ff={MONO}
      fz={10}
      fw={500}
      c={TEXT}
      style={{ letterSpacing: "0.04em" }}
      data-testid="file-viewer-crumb-current"
    >
      {rootLabel}
    </Text>
  ) : (
    segment("root", rootLabel, -1, "file-viewer-crumb-root")
  );

  return (
    <Group gap={10} wrap="nowrap" align="center" data-testid="file-viewer-breadcrumb">
      {segment("home", homeLabel, -1, "file-viewer-crumb-home")}
      {separator("sep-home")}
      {segment("area", areaLabel, -1, "file-viewer-crumb-area")}
      {separator("sep-area")}
      {rootSegment}
      {segments.slice(0, -1).map((folder, index) => (
        <Group key={folder.id} gap={10} wrap="nowrap" align="center">
          {separator(`sep-${folder.id}`)}
          {segment(folder.id, folder.name, index, `file-viewer-crumb-${index}`)}
        </Group>
      ))}
      {atRoot ? null : (
        <Group gap={10} wrap="nowrap" align="center">
          {separator("sep-current")}
          <Text
            ff={MONO}
            fz={10}
            fw={500}
            c={TEXT}
            style={{ letterSpacing: "0.04em" }}
            data-testid="file-viewer-crumb-current"
          >
            {segments[segments.length - 1]?.name ?? ""}
          </Text>
        </Group>
      )}
    </Group>
  );
}
