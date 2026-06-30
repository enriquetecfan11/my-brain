# UI Migration Plan — cbm-dashboard

Plan to replace the embedded graph UI (`src/ui/`) with a standalone
**cbm-dashboard** service: Node/TypeScript backend + React SPA.

---

## REST API contract (v1)

Base URL (default): `http://127.0.0.1:3000/api`

All responses: `Content-Type: application/json`. Errors: `{ "error": string, "code"?: string }`.

### `GET /projects`

```json
{
  "projects": [
    {
      "name": "my-app",
      "path": "/Users/dev/projects/my-app",
      "indexedAt": "2026-06-15T10:30:00Z",
      "nodeCount": 12450,
      "edgeCount": 38901
    }
  ]
}
```

### `GET /projects/:name/schema`

```json
{
  "project": "my-app",
  "totalNodes": 12450,
  "totalEdges": 38901,
  "nodeLabels": [{ "label": "Function", "count": 5200 }],
  "edgeTypes": [{ "type": "CALLS", "count": 21000 }]
}
```

### `GET /projects/:name/graph`

Query: `limit`, `offset`, `label`, `filePathPrefix`, `namePattern`, `edgeTypes`, `includeEdges`.

```json
{
  "project": "my-app",
  "pagination": {
    "limit": 500,
    "offset": 0,
    "nodeCount": 500,
    "totalNodes": 12450,
    "hasMore": true
  },
  "nodes": [
    {
      "id": 42,
      "label": "Function",
      "name": "handleRequest",
      "qualifiedName": "my-app.src.handler.handleRequest",
      "filePath": "src/handler.ts",
      "startLine": 10,
      "endLine": 45,
      "properties": {}
    }
  ],
  "edges": [
    {
      "id": 1001,
      "source": 42,
      "target": 87,
      "type": "CALLS",
      "properties": {}
    }
  ]
}
```

Full implementation notes: see git history / `cbm-dashboard/api/src/db.ts`.

---

## Directory layout

```text
cbm-dashboard/
  api/          # Fastify REST API (reads SQLite cache)
  ui/           # React 19 + Vite SPA (this iteration)
docs/
  ui-migration-plan.md
```

---

## Local development (API + UI)

Run the API and UI in **two terminals**. The Vite dev server proxies `/api/*` to the
Fastify backend on port 3000.

### Terminal 1 — API

```bash
cd cbm-dashboard/api
npm install
npm run dev
```

Listens on `http://127.0.0.1:3000` by default (`CBM_API_PORT`, `CBM_API_HOST`).

### Terminal 2 — UI

```bash
cd cbm-dashboard/ui
npm install
npm run dev
```

Opens Vite (typically `http://localhost:5173`). Browser requests to `/api/projects`, etc.
are proxied to `http://localhost:3000`.

### Production build (UI only)

```bash
cd cbm-dashboard/ui
npm run build
npm run preview   # optional: serve dist/ locally
```

### Manual testing checklist

1. **Projects** — Open the UI; the Projects tab should list indexed `.db` projects from
   `~/.cache/codebase-memory-mcp` (or `CBM_CACHE_DIR`).
2. **Select** — Click **Select** on a row; the header shows the project name and the app
   switches to the Schema tab.
3. **Schema** — Verify node label and edge type counts match the selected project.
4. **Graph (force-directed view)** — See section below.

---

## Graph view — usage guide

The Graph tab renders a **force-directed 2D graph** powered by `react-force-graph-2d`
(D3-force + canvas). It behaves like Obsidian's Graph View.

### Step-by-step workflow

```
Projects tab → Select project → Schema tab (optional preview) → Graph tab
```

#### Controls

| Control | Effect |
|---------|--------|
| Scroll wheel | Zoom in / out |
| Click + drag on canvas | Pan |
| Click + drag on node | Pin node (drag to position) |
| Hover on node | Highlights connected edges and direct neighbours |
| Click on node | Selects node; opens **NodeDetail** side panel |
| Click on canvas (empty) | Deselects / closes NodeDetail |

#### Filters (toolbar, top-left)

| Filter | Description |
|--------|-------------|
| **Label** dropdown | Filter nodes by label (`Function`, `Class`, `File`, …). Populated from schema. |
| **File path prefix** | Filter nodes whose `file_path` starts with the given prefix (e.g. `src/api/`). Press Enter or click Apply. |
| **Search node** | Visual search over loaded nodes by `name` or `qualifiedName` (case-insensitive). Highlights matches in amber; no extra HTTP request. |
| **Edge types** | Checkbox row below the toolbar. Uncheck types to hide those edges. **All** resets to every type; **None** hides all edges. |
| **Apply** button | Submits label + path filters; reloads data from the API. |
| **Clear** button | Resets all filters (label, path, search, edge types). |
| **Refresh** button | Reloads data without changing filters. |

Up to **2 000 nodes** are loaded per request. If the project has more, a yellow notice
appears — use filters to narrow the visible subgraph.

#### Local graph mode (toolbar, top-right — appears after selecting a node)

1. **Click a node** → NodeDetail panel opens; toolbar shows **Global / Local** buttons.
2. Click **Local** → view collapses to only the selected node and its direct neighbours.
3. **Depth selector** (1 or 2) → depth 2 also includes neighbours-of-neighbours.
4. Click **Global** → return to full graph (selection preserved).

#### NodeDetail side panel

Shows when a node is clicked:
- Label badge, full name, file path (with line number), qualified name
- Degree, incoming-edge count, outgoing-edge count
- Lists of incoming / outgoing edges (up to 25 each), with edge type and neighbour name

#### Node appearance

| Visual | Meaning |
|--------|---------|
| Node colour | Label type (`Function`=blue, `Class`=purple, `Method`=cyan, `File`=amber, …) |
| Node size | Degree (more connections → larger) |
| White node + white ring | Currently selected node |
| Dim nodes | When hovering: unrelated nodes fade to 15% opacity; when searching: non-matches fade to 20% |
| Amber ring + label | Node matches the current search query |
| Blue edges | Edges connected to the hovered node |
| Node label text | Shown above zoom 1.8×, always shown for selected/hovered/highlighted |

---

## Improvements implemented (graph view)

High-priority UX improvements added on top of the initial force-directed view:

| Feature | Where | How to use |
|---------|-------|------------|
| **Node search** | Toolbar → **Search node** | Type part of a `name` or `qualifiedName`. Matches are highlighted in amber on the canvas. Works on already-loaded nodes only (up to 2 000). A notice shows match count. |
| **Edge type filter** | Row below toolbar → **Edge types** | Toggle checkboxes for `CALLS`, `IMPORTS`, `HTTP_CALLS`, etc. (from schema). Unchecked types are hidden. Degree counts and local graph respect the filtered edges. |
| **Shared label colors** | `src/constants/colors.ts` | Single `LABEL_COLORS` palette used by `GraphView` and `NodeDetail`. |

Local graph mode, zoom/pan, hover highlighting, and `GLOBAL_LIMIT` pagination are unchanged.

### Prerequisites

- At least one indexed project: `codebase-memory-mcp cli index_repository <path>`
- API `db.ts` read path implemented (stubs return 500 until Phase 1 is complete)

---

## Phase status

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | API skeleton + this doc | Done |
| 1 | Implement `getProjects`, `getSchema`, `getGraph` | Done |
| 2 | React SPA — Projects/Schema panels | Done |
| 2b | Force-directed graph view (react-force-graph-2d), local mode, NodeDetail | Done |
| 3 | MCP proxy (`trace_path`, `get_code_snippet`), `graph.db.zst` import | Future |

---

## What we do NOT use

- `httpd.c`, `layout3d.c`, `GET /api/layout` from the C binary
- Embedded `cbm-dashboard/ui` Vite build (replaces legacy `graph-ui/`)
- `POST /rpc` for graph data (MCP proxy optional later)

The SPA talks **only** to `/api/*` on the Node backend.
