# PrismFileViewerMicroUI

Platform Prism file-viewer micro-UI. Component id: `file-viewer`.
Published to npm as [`@zephytiju/prism-file-viewer`](https://www.npmjs.com/package/@zephytiju/prism-file-viewer).

The merged VAULT main-viewport surface (decision D9): one composition unit covering the former
Title Bar, Body Title, and Workspaces Section — the hub header (VAULT wordmark, inventory
subtitle, Layout Toggle patterns immediately right of the title, workspace search, SORT,
`+ NEW FILE`), the viewer toolbar (breadcrumb path at the top left — every ancestor segment is a
back-navigation target — plus the current title/description and Selection Tags filter pills), and
the FILES gallery: one gallery-style explorer area rendering both folders and individual files as
uniform tiles, folders first, every file kind carrying its distinct icon (folder / dossier —
including evidence and reference files / workflow and audit board / GeoVision world view).
Clicking a folder tile navigates into the folder and re-renders its contents; clicking a
breadcrumb segment returns; clicking a file opens it. The gallery switches grid (default) and
full-width scrolling list rows through the Layout Toggle. Composed applications (for example
Guanlan) consume it as-is; the component is platform-owned.

## Configuration keys

| Prop | Meaning |
| --- | --- |
| `locale` | UI locale for the component-fixed strings: `"en" \| "zh-CN"` (default `"en"`) — see [i18n](#internationalization-i18n) |
| `title` | Hub wordmark (defaults to the locale's `title`; titles render from configuration keys) |
| `inventorySubtitle` | Inventory subtitle under the wordmark (defaults to the locale's; counts are host data) |
| `rootTitle` / `rootDescription` | Viewer-toolbar title/description at the root (default to the locale's) |
| `rootScope` | `IFileEntry` list scope for the root listing (omit for the default scope) |
| `tags` | Filter pill set (defaults to the six builtin tags: all / folders / dossiers / boards / world / shared) |
| `initialFilter` / `initialLayout` | Initial Selection Tags id (default `all`) and gallery pattern (default `grid`) |
| `sortKeys` | Sort keys cycled by the SORT control (default `name`, then `size`); folders always render first regardless of key |
| `chip` | `(entry) => string \| undefined` — category chip from entry taxonomy (default: the kind's locale label) |
| `meta` | `(entry) => string \| undefined` — mono meta line, item count / edit meta (default: kind label + bounded size) |
| `shared` | `(entry) => boolean` — scopes the builtin SHARED filter pill |
| `pageSize` | Page size for `ISearchable` queries (default 50) |
| `galleryMaxHeight` | Max height of the scrollable gallery area (default 360; list rows scroll within it) |

## Channel contract

| Direction | Kind | Id | Payload |
| --- | --- | --- | --- |
| invokes | lattice (embedded client) | `interfaces/IFileEntry/list` | children query — `{ scope }` per entered folder (root: default scope or `rootScope`); renders the returned `FileEntrySummary` records |
| invokes | lattice (embedded client) | `interfaces/ISearchable/search` | `{ query, filterRefs: [], pageSize }` on search submit; matched items render in the gallery |
| publishes | state | `vault.viewerPath` | `ViewerPath` = `{ scopeId, segments: [{ id, name }] }` — the breadcrumb navigation state as a bounded-context shared slot (D8), published on every navigation including back to the root |
| emits | event | `file-viewer.open-file` | `OpenFileIntent` = `{ id, name, kind, sizeBytes, scopeId, ontologyInterface: "IFileEntry" }` when a file tile/row is clicked |
| emits | event | `file-viewer.create-file` | `CreateFileIntent` = `{ scopeId, ontologyInterfaces: ["IDossierDoc", "IFileEntry"] }` for `+ NEW FILE` |

Channel ids are string literals at every call-site so the build-time channel-graph scanner can
derive the graph. The single state publication is setter-only. Interface invocation is embedded:
the generated `FileEntryClient` / `SearchableClient` from `@zephytiju/lattice-common-interfaces`
run over `useLatticeTransport` — typed per-method routes; no URLs, clients, or credentials in
component code; the host installs its action executor once at mount. Sort, layout, and filter
choices are local view state (never channels).

Filter semantics: the builtin pill ids scope by kind (`folders`/`dossiers`/`boards`/`world`) or
the `shared` callback; any custom tag id scopes by exact kind match, so user-defined ontology
kinds work without component changes. The listing renders the bounded first page of results
(`nextCursor` is accepted but not paged through — reopen with a narrower scope or search).

## Audit rule

Routine browsing, folder navigation, listing, and search are NOT audit-worthy. This component
emits NO audit event. The only events it ever emits are the two intents above
(`file-viewer.open-file`, `file-viewer.create-file`) — navigation/creation requests that never
grant authorization; whether an open or creation is audit-recorded is the host/runtime's decision
(IAuditRefAppend when appropriate).

## Internationalization (i18n)

The component ships `en` and `zh-CN` locale bundles — `src/locales/en.json` /
`src/locales/zh-CN.json` — and every component-fixed UI string is resolved from them (the hub
title and subtitle, search placeholder, SORT and `+ NEW FILE`, FILES section label and
`{count} VISIBLE` line, breadcrumb segments, filter pill labels, kind chip labels, empty/error
states, Retry). The component renders no hardcoded copy.

```json
{
  "file-viewer": {
    "title": "VAULT",
    "filesSection": "FILES",
    "visibleCount": "{count} VISIBLE",
    "foldersPlusFiles": "FOLDERS + FILES",
    "newFile": "+ NEW FILE",
    "rootTitle": "Operational files",
    "crumbHome": "NEXUS",
    "crumbArea": "VAULT",
    "crumbRoot": "ALL FILES",
    "filterWorld": "WORLD VIEWS"
  }
}
```

- `locale?: "en" | "zh-CN"` prop (default `"en"`) selects the string table per instance.
- `visibleCount` uses a simple `{count}` placeholder interpolated with the rendered entry count
  (plain substitution, no regexes — `formatMessage` is exported from the package entry).
- Explicit `title` / `inventorySubtitle` / `rootTitle` / `rootDescription` / `tags` overrides are
  configuration-authored: a host with localized strings passes its own per locale, and `chip` /
  `meta` callbacks return whatever the entry taxonomy carries.
- Locale bundles are namespaced under the component id (`"file-viewer"`) so a composer can
  deep-merge every component's bundle into ONE UI language bundle without collisions:

```ts
import { locales as fileViewerLocales } from "@zephytiju/prism-file-viewer";
// fileViewerLocales["zh-CN"] -> { "file-viewer": { … } }
const uiBundle = deepMerge(hostStrings, fileViewerLocales["zh-CN"]);
```

The parsed bundles are exported from the package entry (`locales`, `en`, `zhCN`,
`stringsForLocale`), and the raw JSONs are also served by the `./locales/*` exports subpath
(e.g. `@zephytiju/prism-file-viewer/locales/zh-CN.json`); `files` ships both `dist` and
`locales`.

## Theme

No palette is hardcoded. Every color resolves to SEMANTIC theme tokens (`ok`, `threat`, `warn`,
`signal`, `accent`, `card`, `card-dark`, `input`, `border`, `line`, `text`, `muted`, `deep`,
`panel`) consumed as CSS variables, plus `--mantine-font-family-monospace` for the mono
typography — the palette is supplied entirely by the host's `MantineProvider`. Kind colors ride
the same tokens: folder → `accent`, dossier → `ok`, board → `warn`, world view → `signal`. The
local demo ships TWO themes, both defined in `src/demo.tsx`: `geovisionTheme` (dark), mapping
each semantic token onto the exact `:root` variables of the v9 VAULT prototype, and the
contrasting `latticeLightTheme` (light), mapping the SAME semantic token keys onto a different
palette — the component is skinned purely through the surrounding `MantineProvider`.

## Source layout

`src/` is strictly two parts:

- Component source (what the package compiles): `FileViewer.tsx` (the stateful composition —
  navigation path, local view state, Lattice bindings, public types), which renders the focused
  presentation modules `HubHeader.tsx` (wordmark, Layout Toggle patterns, workspace search,
  SORT, + NEW FILE), `ViewerToolbar.tsx` (breadcrumb path, title/description, Selection Tags
  filter pills), and `FilesGallery.tsx` (section row + the grid/list FILES gallery with its load
  phases), all styled through the shared semantic tokens and defaults in `viewerTokens.ts`;
  `FileTile.tsx` (the gallery tile/row member), `LayoutToggle.tsx` and `SelectionTags.tsx` (the
  hosted sub-component libraries, D5), `ViewerBreadcrumb.tsx` (the breadcrumb path),
  `icons.tsx` (the distinct per-kind icons), `kinds.ts` (kind registry), `index.ts` (public
  entry), and `src/locales/` (`en.json`, `zh-CN.json`, `index.ts` — the i18n string bundles,
  their resolver, and the `{count}` interpolation helper).
- Demo: exactly ONE file, `src/demo.tsx` — the two host themes (GeoVision VAULT dark + Lattice
  Light), the mock host executor serving the synthetic v9 vault tree through the embedded
  clients' routes (`IFileEntry.list` children queries, `ISearchable.search`), all demo
  configuration (taxonomy chips, meta lines, shared flags), and the demo page rendering TWO
  FileViewer instances side by side behind a global EN | 中文 language switcher (plus
  per-instance switches), with monitors for the `vault.viewerPath` publication, the open-file /
  create-file intents, and the mock Lattice call log — plus a toggle that makes the executor fail
  so the error + Retry branch is inspectable in both themes.

The npm package ships `dist` (compiled component + type declarations + locale JSONs) and the
top-level `locales/` directory (the raw JSON bundles, served by the `./locales/*` exports
subpath); no demo code is published. `scripts/copy-locales.mjs` copies the JSON bundles into
both locations during `npm run build`.

## Local development

```sh
npm install
npm run typecheck
npm test
npm run dev
npm run shot-demo
```

`npm install` pulls the platform peers (`@zephytiju/prism-react`,
`@zephytiju/lattice-common-interfaces`) from the npm registry, along with the host-side peer
dependencies (`react`, `react-dom`, `@mantine/core`). When consuming the published package,
install it directly (`npm install @zephytiju/prism-file-viewer`) and provide those peer
dependencies — plus a Lattice action executor (`setPrismActionExecutor`) — in the host
application.

The demo (`npm run dev`, entry `src/demo.tsx`) plays the host: on load it installs the mock
Lattice executor serving the synthetic v9 vault tree and renders TWO FileViewer instances side
by side, each inside its own `MantineProvider` with a different theme (GeoVision VAULT dark
left, Lattice Light right). The two instances browse independently (path, layout, filter, sort
are local view state); the shared `vault.viewerPath` slot reflects the most recent navigation. A
global EN | 中文 segmented control switches the `locale` prop of BOTH instances at once, and each
instance carries its own per-instance control so the two hosts can render DIFFERING locales
simultaneously. `npm run shot-demo` boots the vite dev server, drives the demo in headless
Chrome (LEFT instance `en`, RIGHT instance `zh-CN`), and captures: the root FILES gallery with
folders and individual files of every kind, folder drill-down with the breadcrumb extended
(grid, plus the list presentation through the Layout Toggle), and ancestor back-navigation with
the open-file intent — to `/tmp/guanlan-review/`.

## Design record

Page design (D9 merge, v9 artifacts): https://qcnwge0wy4s0.feishu.cn/wiki/TLFtwgBgpiW8iWkXT7rcOyKgnAd
Component doc: https://qcnwge0wy4s0.feishu.cn/wiki/LaYWwPhO0iQHyMk11NocCE4Inac
(children: Layout Toggle, Selection Tags, File Tile). Visual reference: the v9 interactive HTML
prototype attached to the page design doc (`vault-standalone.html` — `.hub-head`, `.crumb`,
`.filters`, `.tile`, `.frow.lrow`, `#gallery`).
