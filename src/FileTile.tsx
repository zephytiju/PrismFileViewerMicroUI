import { Box, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import type { FileEntrySummary } from "@zephytiju/lattice-common-interfaces";
import { formatSize, kindChipLabel, kindColor, kindVisual } from "./kinds.js";
import type { FileViewerStrings } from "./locales/index.js";

/** Resolved per-entry display model the tile renders. */
export interface FileTileModel {
  /** The bounded IFileEntry record the tile renders. */
  readonly entry: FileEntrySummary;
  /** Mono meta line (item count / edit meta — from the entry or host config). */
  readonly meta: string;
  /** Category chip label (entry taxonomy via host config, or the kind name). */
  readonly chip: string;
}

export interface FileTileProps {
  /** Display model for the rendered entry. */
  readonly model: FileTileModel;
  /** Presentation: gallery tile (grid) or full-width row (list). */
  readonly variant: "tile" | "row";
  /** Locale string table (open-folder / open-file titles). */
  readonly strings: FileViewerStrings;
  /** Whole tile is the click target: folder → navigate, file → open. */
  readonly onOpen: (entry: FileEntrySummary) => void;
}

const MONO = "var(--mantine-font-family-monospace)";
const TEXT = "var(--mantine-color-text-filled)";
const MUTED = "var(--mantine-color-muted-filled)";
const CARD_BG = "var(--mantine-color-card-filled)";
const ACCENT = "var(--mantine-color-accent-filled)";

/**
 * File Tile member (v9 prototype .tile / .frow.lrow): one uniform member of
 * the FILES gallery rendering an IFileEntry of ANY kind — folder, dossier
 * (including evidence and reference files), workflow or audit board, or
 * GeoVision world view — with its distinct kind icon, name, meta line, and
 * category chip. The whole tile is the click target: folder kinds navigate
 * into the folder; every other kind opens the file. Rendered 0..N at app
 * runtime by the File Viewer (decision D3) and independently documented for
 * reuse (decision D5).
 *
 * No palette is hardcoded: the icon color resolves to the kind's semantic
 * theme token; surfaces resolve to card / border / accent / text / muted
 * supplied by the host's MantineProvider.
 */
export function FileTile({ model, variant, strings, onOpen }: FileTileProps) {
  const { entry } = model;
  const Icon = kindVisual(entry.kind).icon;
  const iconColor = kindColor(entry.kind);
  const isFolder = entry.kind === "folder";
  const title = isFolder ? strings.openFolder : strings.openFile;

  const chip = (
    <Box
      h={22}
      px={10}
      style={{
        borderRadius: 11,
        border: `1px solid ${ACCENT}`,
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: 500,
        color: ACCENT,
        display: "inline-flex",
        alignItems: "center",
        letterSpacing: "0.02em",
        flexShrink: 0,
      }}
      data-testid={`file-viewer-chip-${entry.id}`}
    >
      {model.chip}
    </Box>
  );

  if (variant === "row") {
    return (
      <UnstyledButton
        type="button"
        title={title}
        data-testid={`file-viewer-row-${entry.id}`}
        onClick={() => {
          onOpen(entry);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          minHeight: 62,
          padding: "10px 16px",
          background: CARD_BG,
          border: "1px solid var(--mantine-color-border-filled)",
          borderRadius: 5,
          textAlign: "left",
        }}
      >
        <span style={{ color: iconColor, display: "inline-flex" }} data-testid={`file-viewer-icon-${entry.id}`}>
          <Icon size={28} />
        </span>
        <Stack gap={3} miw={0} style={{ flex: 1 }}>
          <Text fz={12} fw={500} truncate="end" style={{ color: TEXT }}>
            {entry.name}
          </Text>
          <Text ff={MONO} fz={9} style={{ color: MUTED, letterSpacing: "0.02em" }} truncate="end">
            {model.meta}
          </Text>
        </Stack>
        {chip}
      </UnstyledButton>
    );
  }

  return (
    <UnstyledButton
      type="button"
      title={title}
      data-testid={`file-viewer-tile-${entry.id}`}
      onClick={() => {
        onOpen(entry);
      }}
      style={{
        display: "block",
        width: "100%",
        height: 156,
        padding: "16px",
        background: CARD_BG,
        border: "1px solid var(--mantine-color-border-filled)",
        borderRadius: 6,
        textAlign: "left",
      }}
    >
      <Group justify="flex-start" align="flex-start" h={56} wrap="nowrap">
        <span style={{ color: iconColor, display: "inline-flex" }} data-testid={`file-viewer-icon-${entry.id}`}>
          <Icon size={38} />
        </span>
      </Group>
      <Text
        fz={12}
        fw={600}
        mt={8}
        style={{ color: TEXT, letterSpacing: "0.01em" }}
        truncate="end"
        data-testid={`file-viewer-name-${entry.id}`}
      >
        {entry.name}
      </Text>
      <Text
        ff={MONO}
        fz={8}
        mt={6}
        style={{ color: MUTED, letterSpacing: "0.02em" }}
        truncate="end"
        data-testid={`file-viewer-meta-${entry.id}`}
      >
        {model.meta}
      </Text>
      <Group mt={8} gap={0} wrap="nowrap">
        {chip}
      </Group>
    </UnstyledButton>
  );
}

/** Default mono meta line: bounded size, or the kind chip label for folders. */
export function defaultMetaFor(entry: FileEntrySummary, strings: FileViewerStrings): string {
  if (entry.kind === "folder" || entry.sizeBytes <= 0) {
    return kindChipLabel(entry.kind, strings);
  }
  return `${kindChipLabel(entry.kind, strings)} · ${formatSize(entry.sizeBytes)}`;
}
