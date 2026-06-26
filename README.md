# Die Glocke — MCP Server Generator & DokuWiki Plugin Wizard

A single-page, browser-only portal with two generators:

1. **MCP Server Generator** — Model Context Protocol Python servers
2. **DokuWiki Plugin Wizard** — offline DokuWiki plugin scaffolds (syntax / action / admin / helper)

No build step, no backend; open `index.html`.

## MCP generator

Fill in a form, get a complete MCP server bundle — copy, download, or ZIP.

Targets the official **MCP Python SDK** (`mcp`, FastMCP) with current (2026) standards.

## DokuWiki Plugin Wizard

Second tool-card in the portal. Produces a deterministic DokuWiki plugin ZIP:

- `plugin.info.txt` in DokuWiki format (includes complexity level)
- Type-correct PHP scaffold for syntax, action, admin, or helper plugins
- Optional assets: `style/all.css`, `script.js`, conf/lang files (toggleable)
- Complexity: **basic** / **advanced** / **pro** changes scaffold structure
- Fully offline — no network required for generation

### Optional local LLM connector

Configure an OpenAI-compatible endpoint (presets: LM Studio `http://localhost:1234/v1`, Ollama `http://localhost:11434/v1`, vLLM custom):

- Improve description
- AI code preview (shown alongside deterministic scaffold; opt-in to replace)
- Deployment guide (Docker primary, manual install secondary)

Settings persist in `localStorage` only — never committed. If the connector is offline or CORS-blocked, AI buttons stay disabled and deterministic generation still works.

**CORS:** enable cross-origin requests on your local LLM server when using the portal from GitHub Pages or another origin.

## Use

1. Open `index.html` (or the GitHub Page).
2. Click a tool card (**Die Glocke** or **DokuWiki Plugin Wizard**).
3. Fill the form and **Generate** → copy / download / ZIP.

## Develop & test

| File | Role |
| --- | --- |
| `generator.js` | MCP `buildServerFiles(config)` (pure, tested) |
| `dokuwiki-generator.js` | DokuWiki `buildPluginFiles(config)` (pure, tested) |
| `llm-connector.js` | Optional local OpenAI-compatible client |
| `app.js` | DOM wiring for both generators |
| `glocke.js` | Logo / tool-card panel switching |
| `tests/run-tests.js` | Node test suite (MCP + DokuWiki + connector mock) |

```bash
node tests/run-tests.js
```

MCP integration tests also `py_compile` generated Python and import against `mcp` when available.

— made by Jan / IxI-Enki
