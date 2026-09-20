import enBundle from "./en.json";
import zhCNBundle from "./zh-CN.json";

/**
 * Locales the file-viewer micro-UI bundles. Every component-fixed UI string
 * is resolved from these bundles (statically imported, resolveJsonModule); the
 * component never hardcodes copy. Configuration-provided strings (an explicit
 * title override, folder taxonomy chips, …) stay composition-authored and are
 * localized by the composer.
 */
export type FileViewerLocale = "en" | "zh-CN";

/**
 * The per-locale string table — the keys of the en bundle. Declared widened
 * (string values) so the zh-CN bundle is checked for exact key parity at
 * compile time while keeping literal JSON types out of the public surface.
 */
export type FileViewerStrings = {
  readonly [K in keyof typeof enBundle["file-viewer"]]: string;
};

const bundles: Record<FileViewerLocale, { readonly "file-viewer": FileViewerStrings }> = {
  en: enBundle,
  "zh-CN": zhCNBundle,
};

/** Parsed en locale bundle (namespaced under the component id "file-viewer"). */
export const en = enBundle;

/** Parsed zh-CN locale bundle (namespaced under the component id "file-viewer"). */
export const zhCN = zhCNBundle;

/** All bundled locale bundles keyed by locale id — for downstream deep-merge. */
export const locales = bundles;

/** Resolves the string table for a locale. */
export function stringsForLocale(locale: FileViewerLocale): FileViewerStrings {
  return bundles[locale]["file-viewer"];
}

/**
 * Simple `{placeholder}` interpolation (e.g. `"{count} VISIBLE"` + count).
 * Placeholder-for-value substitution only — no ICU, no regexes.
 */
export function formatMessage(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result;
}
