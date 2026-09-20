/**
 * Per-kind file icons, traced 1:1 from the authoritative v9 VAULT prototype
 * (vault-standalone.html ICONS): folder, dossier document, board, and world
 * view each carry a DISTINCT icon so every file kind is recognizable at a
 * glance. Icons are stroked with `currentColor` and colored by the parent
 * through a semantic theme token — no palette is hardcoded here.
 */

export interface FileIconProps {
  /** Pixel size (width; height follows each icon's aspect). */
  readonly size?: number;
}

/** Folder kind icon (prototype .ic-folder, viewBox 0 0 48 42). */
export function FolderIcon({ size = 40 }: FileIconProps) {
  return (
    <svg
      width={size}
      height={Math.round((size * 42) / 48)}
      viewBox="0 0 48 42"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path d="M3 6h14l4 5h24v25H3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 16h42" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Dossier / document kind icon (prototype .ic-doc, viewBox 0 0 28 32). */
export function DossierIcon({ size = 34 }: FileIconProps) {
  return (
    <svg
      width={size}
      height={Math.round((size * 32) / 28)}
      viewBox="0 0 28 32"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path d="M4 2h13l7 7v21H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 2v7h7M8 14h10M8 19h10M8 24h6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Workflow / audit board kind icon (prototype .ic-board, viewBox 0 0 30 30). */
export function BoardIcon({ size = 34 }: FileIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect x="2" y="2" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="19" y="2" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="10" y="19" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M11 11v3a2 2 0 0 0 2 2h3M15 7h4M7 11v8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** GeoVision world-view kind icon (prototype .ic-world, viewBox 0 0 30 30). */
export function WorldIcon({ size = 34 }: FileIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <circle cx="15" cy="15" r="12" stroke="currentColor" strokeWidth="2" />
      <path d="M3 15h24M15 3c4 4 4 20 0 24M15 3c-4 4-4 20 0 24" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Magnifier glyph for the workspace search field (prototype ⌕). */
export function SearchIcon({ size = 15 }: FileIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Grid pattern glyph for the Layout Toggle (prototype ▦). */
export function GridPatternIcon({ size = 16 }: FileIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="3" width="8" height="8" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="13" width="8" height="8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** List pattern glyph for the Layout Toggle (prototype ☷). */
export function ListPatternIcon({ size = 16 }: FileIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
