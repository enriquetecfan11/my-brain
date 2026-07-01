# MCP — codebase-memory-mcp

C indexing engine and MCP server. Parses 158 languages into a SQLite knowledge graph and exposes 14 MCP tools.

## Structure

```
MCP/
├── src/                  MCP protocol, CLI, pipeline, store
├── internal/cbm/         Tree-sitter extraction engine
├── tests/                C test suite
├── scripts/              Build, test, lint, security
├── pkg/                  npm, PyPI, Homebrew, etc.
├── Makefile.cbm          Main build system
└── docs/                 Upstream documentation
```

## Quick start

```bash
# Build
scripts/build.sh
# or
make -f Makefile.cbm cbm

# Install into coding agents
./build/c/codebase-memory-mcp install

# Run tests
scripts/test.sh
```

## Build with embedded Dashboard UI (optional)

Requires `../Dashboard/ui` (monorepo sibling):

```bash
scripts/build.sh --with-ui
# or
make -f Makefile.cbm cbm-with-ui
```

## Install scripts

- `install.sh` / `install.ps1` — one-line binary installers
- `scripts/setup.sh` / `scripts/setup-windows.ps1` — full setup with agent config

## Registry metadata

- `server.json` — MCP Registry
- `glama.json` — Glama.ai directory

## Docs

See [docs/README.md](docs/README.md) for the full documentation index.

Based on [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp).
