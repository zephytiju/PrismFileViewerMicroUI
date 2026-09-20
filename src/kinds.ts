import type { ComponentType } from "react";
import { BoardIcon, DossierIcon, FolderIcon, WorldIcon } from "./icons.js";
import type { FileIconProps } from "./icons.js";
import type { FileViewerStrings } from "./locales/index.js";

/**
 * File-kind registry for the FILES gallery. The v9 prototype's distinct
 * per-kind presentation: each known kind (folder / dossier / board / world
 * view) carries its own icon and a semantic color token; unknown kinds fall
 * back to the document icon on the accent token so a user-defined ontology
 * implementing IFileEntry still renders. The kind chip label resolves from
 * the locale bundle (component-fixed taxonomy names); the host may override
 * per-entry chips with entry taxonomy through the `chip` configuration key.
 */

/** Known gallery kinds (folder tiles navigate; the rest are openable files). */
export type KnownFileKind = "folder" | "dossier" | "board" | "world";

export interface KindVisual {
  readonly icon: ComponentType<FileIconProps>;
  /** Semantic theme token driving the icon color. */
  readonly token: string;
  /** Locale key for the default category chip label. */
  readonly labelKey: keyof Pick<
    FileViewerStrings,
    "kindFolder" | "kindDossier" | "kindBoard" | "kindWorld"
  >;
}

const KIND_VISUALS: Readonly<Record<KnownFileKind, KindVisual>> = {
  folder: { icon: FolderIcon, token: "accent", labelKey: "kindFolder" },
  dossier: { icon: DossierIcon, token: "ok", labelKey: "kindDossier" },
  board: { icon: BoardIcon, token: "warn", labelKey: "kindBoard" },
  world: { icon: WorldIcon, token: "signal", labelKey: "kindWorld" },
};

/** The fallback visual for kinds outside the known set. */
const FALLBACK_VISUAL: KindVisual = {
  icon: DossierIcon,
  token: "accent",
  labelKey: "kindDossier",
};

export function kindVisual(kind: string): KindVisual {
  return KIND_VISUALS[kind as KnownFileKind] ?? FALLBACK_VISUAL;
}

/** Icon color as a semantic CSS variable (resolved by the host's theme). */
export function kindColor(kind: string): string {
  return `var(--mantine-color-${kindVisual(kind).token}-filled)`;
}

/** Default chip label for a kind: locale taxonomy name, or the raw kind id. */
export function kindChipLabel(kind: string, strings: FileViewerStrings): string {
  const visual = KIND_VISUALS[kind as KnownFileKind];
  return visual === undefined ? kind.toUpperCase() : strings[visual.labelKey];
}

/** Human-readable bounded size for the default meta line. */
export function formatSize(sizeBytes: number): string {
  if (sizeBytes <= 0) {
    return "0 KB";
  }
  if (sizeBytes < 1024) {
    return `${String(sizeBytes)} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
