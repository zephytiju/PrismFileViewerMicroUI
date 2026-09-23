# PrismFileViewerMicroUI

Platform Prism file-viewer micro-UI. Component id: `file-viewer`.
Published to npm as [`@zephytiju/prism-file-viewer`](https://www.npmjs.com/package/@zephytiju/prism-file-viewer).

The merged VAULT main-viewport surface (decision D9) with standard file-explorer semantics (decision
D11): users land in the ROOT of their storage and the FILES gallery renders ONLY the folders and
files under the CURRENT path. The hub header carries the VAULT wordmark, inventory subtitle, Layout
Toggle patterns immediately right of the title, workspace search, SORT, and the `+ NEW` control
opening the create menu — `NEW FOLDER` / `NEW FILE (DOSSIER)`, both created under the current path
at any level. The viewer toolbar shows the breadcrumb path at the top left — ALWAYS the full current
path `NEXUS / VAULT / ALL FILES / …entered folders`: the root segment persists and the path extends
one segment per entered folder, every ancestor segment is a back-navigation target — plus the
current title/description and the ownership filter pills (`ALL` / `OWNED BY ME` / `SHARED WITH ME`;
file kinds are distinguished by their distinct icons — folder / dossier — including evidence and
reference files / workflow and audit board / GeoVision world view — not by filters). Clicking a
folder tile navigates into the folder and re-renders its contents; clicking a breadcrumb segment
returns; clicking a file opens it. The gallery switches grid (default) and full-width scrolling
list rows through the Layout Toggle. Composed applications (for example Guanlan) consume it as-is;
the component is platform-owned.

### D11 correction deltas (2026-09-21)

- Breadcrumb: the root scope label (`ALL FILES`) is now a PERSISTENT path segment — at the root it
  is the plain current segment; once a folder is entered it stays in the path as a clickable
  ancestor while entered folders APPEND after it (`NEXUS / VAULT / ALL FILES / …folders`). Before,
  entering a folder REPLACED the root label, so the path never read like a standard explorer path.
- `+ NEW`: the `+ NEW FILE` button became the `+ NEW ▾` control with a create menu — `NEW FOLDER`
  (new `file-viewer.create-folder` intent, `{ scopeId, ontologyInterfaces: ["IFileEntry"] }`) and
  `NEW FILE (DOSSIER)` (unchanged `file-viewer.create-file` intent) — both carrying the current
  path as the parent, at any level.
- Filters: the six kind pills (all/folders/dossiers/boards/world/shared) were replaced by the three
  ownership pills `ALL` / `OWNED BY ME` / `SHARED WITH ME` (ids `all` / `owned` / `shared`); the
  `shared(entry) => boolean` prop was replaced by `ownershipOf(entry) => "owned" | "shared"`
  (`FileEntrySummary` exposes no owner/shared fields — ownership comes from host configuration).
- Locales: `filterFolders` / `filterDossiers` / `filterBoards` / `filterWorld` / `filterShared` and
  `newFile` were removed; `newControl` / `createMenuLabel` / `newFolder` / `newFileItem` /
  `filterOwned` / `filterShared` were added (en + zh-CN parity).

## Configuration keys

| Prop | Meaning |
| --- | --- |
| `locale` | UI locale for the component-fixed strings: `"en" \| "zh-CN"` (default `"en"`) — see [i18n](#internationalization-i18n) |
| `title` | Hub wordmark (defaults to the locale's `title`; titles render from configuration keys) |
| `inventorySubtitle` | Inventory subtitle under the wordmark (defaults to the locale's; counts are host data) |
| `rootTitle` / `rootDescription` | Viewer-toolbar title/description at the root (default to the locale's) |
| `rootScope` | `IFileEntry` list scope for the root listing (omit for the default scope) |
| `tags` | Filter pill set (defaults to the three builtin ownership tags: all / owned / shared) |
| `initialFilter` / `initialLayout` | Initial Selection Tags id (default `all`) and gallery pattern (default `grid`) |
| `sortKeys` | Sort keys cycled by the SORT control (default `name`, then `size`); folders always render first regardless of key |
| `chip` | `(entry) => string \| undefined` — category chip from entry taxonomy (default: the kind's locale label) |
| `meta` | `(entry) => string \| undefined` — mono meta line, item count / edit meta (default: kind label + bounded size) |
| `ownershipOf` | `(entry) => "owned" \| "shared"` — ownership class for the builtin pills (see below); omitted, every entry counts as owned |
| `pageSize` | Page size for `ISearchable` queries (default 50) |
| `galleryMaxHeight` | Max height of the scrollable gallery area (default 360; list rows scroll within it) |

Ownership filters (D11): the pills scope the current-path listing to entries owned by the current
operator vs shared with them. The bounded `FileEntrySummary` projection of `IFileEntry` exposes only
`{ id, name, kind, sizeBytes }` — no owner/shared metadata (ownership is operator/authorization
context the interface deliberately does not carry) — so the host supplies it through the
`ownershipOf` configuration callback, exactly like `chip` / `meta` supply entry taxonomy.

## Channel contract

| Direction | Kind | Id | Payload |
| --- | --- | --- | --- |
| invokes | lattice (embedded client) | `interfaces/IFileEntry/list` | children query — `{ scope }` per entered folder (root: default scope or `rootScope`); renders the returned `FileEntrySummary` records |
| invokes | lattice (embedded client) | `interfaces/ISearchable/search` | `{ query, filterRefs: [], pageSize }` on search submit; matched items render in the gallery |
| publishes | state | `vault.viewerPath` | `ViewerPath` = `{ scopeId, segments: [{ id, name }] }` — the breadcrumb navigation state as a bounded-context shared slot (D8), published on every navigation including back to the root |
| emits | event | `file-viewer.open-file` | `OpenFileIntent` = `{ id, name, kind, sizeBytes, scopeId, ontologyInterface: "IFileEntry" }` when a file tile/row is clicked |
| emits | event | `file-viewer.create-file` | `CreateFileIntent` = `{ scopeId, ontologyInterfaces: ["IDossierDoc", "IFileEntry"] }` for `+ NEW` → `NEW FILE (DOSSIER)` |
| emits | event | `file-viewer.create-folder` | `CreateFolderIntent` = `{ scopeId, ontologyInterfaces: ["IFileEntry"] }` for `+ NEW` → `NEW FOLDER` (an IFileEntry of kind folder) |

Channel ids are string literals at every call-site so the build-time channel-graph scanner can
derive the graph. The single state publication is setter-only. Interface invocation is embedded:
the generated `FileEntryClient` / `SearchableClient` from `@zephytiju/lattice-common-interfaces`
run over `useLatticeTransport` — typed per-method routes; no URLs, clients, or credentials in
component code; the host installs its action executor once at mount. Sort, layout, and filter
choices are local view state (never channels).

Filter semantics: the builtin pill ids `owned` / `shared` scope through the `ownershipOf` callback
(owned by / shared with the current operator, applied to the current-path query); `all` renders the
unscoped listing; kind filtering is not used — kinds are told apart by their icons (D11). A custom
`tags` set renders arbitrary pill ids without builtin scoping, so user-defined ontology kinds work
without component changes. The listing renders the bounded first page of results (`nextCursor` is
accepted but not paged through — reopen with a narrower scope or search).

## Audit rule

Routine browsing, folder navigation, listing, and search are NOT audit-worthy. This component
emits NO audit event. The only events it ever emits are the three intents above
(`file-viewer.open-file`, `file-viewer.create-file`, `file-viewer.create-folder`) —
navigation/creation requests that never grant authorization; whether an open or creation is
audit-recorded is the host/runtime's decision (IAuditRefAppend when appropriate).

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
    "newControl": "+ NEW ▾",
    "newFolder": "NEW FOLDER",
    "newFileItem": "NEW FILE (DOSSIER)",
    "rootTitle": "Operational files",
    "crumbHome": "NEXUS",
    "crumbArea": "VAULT",
    "crumbRoot": "ALL FILES",
    "filterOwned": "OWNED BY ME",
    "filterShared": "SHARED WITH ME"
  }
}
```

- `locale?: "en" | "zh-CN"` prop (default `"en"`) selects the string table per instance.
- `visibleCount` uses a simple `{count}` placeholder interpolated with the rendered entry count
  (plain substitution, no regexes — `formatMessage` is exported from the package entry).
- Explicit `title` / `inventorySubtitle` / `rootTitle` / `rootDescription` / `tags` overrides are
  configuration-authored: a host with localized strings passes its own per locale, and `chip` /
  `meta` / `ownershipOf` callbacks return whatever the entry taxonomy carries.
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
  SORT, the + NEW control with its create menu — NEW FOLDER / NEW FILE (DOSSIER)),
  `ViewerToolbar.tsx` (breadcrumb path, title/description, Selection Tags ownership pills), and
  `FilesGallery.tsx` (section row + the grid/list FILES gallery with its load phases), all styled
  through the shared semantic tokens and defaults in `viewerTokens.ts`;
  `FileTile.tsx` (the gallery tile/row member), `LayoutToggle.tsx` and `SelectionTags.tsx` (the
  hosted sub-component libraries, D5), `ViewerBreadcrumb.tsx` (the breadcrumb path — full current
  path with the persistent root segment),
  `icons.tsx` (the distinct per-kind icons), `kinds.ts` (kind registry), `index.ts` (public
  entry), and `src/locales/` (`en.json`, `zh-CN.json`, `index.ts` — the i18n string bundles,
  their resolver, and the `{count}` interpolation helper).
- Demo: exactly ONE file, `src/demo.tsx` — the two host themes (GeoVision VAULT dark + Lattice
  Light), the mock host executor serving the synthetic v9.3 vault tree (with MIXED ownership:
  some entries owned by the operator, some shared with them) through the embedded clients' routes
  (`IFileEntry.list` children queries, `ISearchable.search`), all demo configuration (taxonomy
  chips, meta lines, ownership classes), and the demo page rendering TWO FileViewer instances
  side by side behind a global EN | 中文 language switcher (plus per-instance switches), with
  monitors for the `vault.viewerPath` publication, the open-file / create-file / create-folder
  intents, and the mock Lattice call log — plus a toggle that makes the executor fail so the
  error + Retry branch is inspectable in both themes.

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
Lattice executor serving the synthetic v9.3 vault tree (mixed ownership) and renders TWO
FileViewer instances side by side, each inside its own `MantineProvider` with a different theme
(GeoVision VAULT dark left, Lattice Light right). The two instances browse independently (path,
layout, filter, sort are local view state); the shared `vault.viewerPath` slot reflects the most
recent navigation. A global EN | 中文 segmented control switches the `locale` prop of BOTH
instances at once, and each instance carries its own per-instance control so the two hosts can
render DIFFERING locales simultaneously. `npm run shot-demo` boots the vite dev server, drives the
demo in headless Chrome (LEFT instance `en`, RIGHT instance `zh-CN`), and captures: the root view
with the three ownership pills and the + NEW control, ownership filtering (SHARED WITH ME /
OWNED BY ME), folder drill-down in BOTH panels with the breadcrumb extended beyond the persistent
ALL FILES root segment, the create menu open (NEW FOLDER / NEW FILE (DOSSIER)) with both creation
intents carrying the current folder, and ancestor back-navigation with the open-file intent — to
`/tmp/guanlan-review/`.

## Design record

Page design (D9 merge + D11 explorer semantics and ownership filters, v9.3 artifacts):
https://qcnwge0wy4s0.feishu.cn/wiki/TLFtwgBgpiW8iWkXT7rcOyKgnAd
Component doc: https://qcnwge0wy4s0.feishu.cn/wiki/LaYWwPhO0iQHyMk11NocCE4Inac
(children: Layout Toggle, Selection Tags, File Tile). Visual reference: the v9.3 interactive HTML
prototype attached to the page design doc (`vault-standalone.html` — `.hub-head`, `.crumb`,
`.newmenu`, `.filters`, `.tile`, `.frow.lrow`, `#gallery`).
