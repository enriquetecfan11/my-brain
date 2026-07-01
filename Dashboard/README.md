# Dashboard

Standalone React graph explorer for codebase-memory-mcp knowledge graphs.

## Structure

```
Dashboard/
├── api/          Fastify REST API (port 3000)
├── ui/           React + Vite SPA (port 5173)
├── dev.sh        Dev launcher
└── scripts/      Clean, security, license checks for the UI
```

## Quick start

```bash
./dev.sh install    # npm install in api/ and ui/
./dev.sh            # start API + UI together
./dev.sh --open     # start and open browser (from repo root dev.sh)
```

Or from the repo root:

```powershell
..\dev.ps1          # Windows
..\dev.sh           # Git Bash / WSL
```

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CBM_CACHE_DIR` | `~/.cache/codebase-memory-mcp` | SQLite graph cache (shared with MCP) |
| `CBM_API_PORT` | `3000` | API listen port |
| `CBM_API_HOST` | `127.0.0.1` | API bind address |
| `CBM_PROJECT` | — | Default project name |
| `CBM_BINARY` | `codebase-memory-mcp` | MCP CLI for indexing jobs |
| `CBM_OLLAMA_URL` | `http://localhost:11434` | Ollama for Chat tab |
| `CBM_OLLAMA_MODEL` | — | Ollama model name |

## Build

```bash
cd ui && npm run build
cd ../api && npm run build && npm start
```

## Optional: embedded in MCP binary

The MCP build target `cbm-with-ui` (`MCP/scripts/build.sh --with-ui`) compiles this UI into the C binary. Requires the monorepo layout with `Dashboard/` as a sibling of `MCP/`.

## Docs

- [docs/ui-migration-plan.md](docs/ui-migration-plan.md) — API contract and migration notes
