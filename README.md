# Die Glocke — MCP Server Generator

A single-page, browser-only generator for **Model Context Protocol (MCP)** servers.
Fill in a form, get a complete, ready-to-build server bundle — copy, download, or grab a ZIP.
No build step, no backend; just open `index.html`.

## What it generates

Targets the official **MCP Python SDK** (`mcp`, FastMCP) with current (2026) standards:

- `*_server.py` — `from __future__ import annotations`, typed `-> str` tools, a `ToolAnnotations`
  preset (read-only / idempotent / open-world, all toggleable), env-var config, a `main()` entry,
  and your chosen transport.
- **Transports:** `stdio` (Docker MCP Gateway / desktop clients), `streamable-http`, or `sse`.
  HTTP transports set host/port and add `EXPOSE` + `HEALTHCHECK` to the Dockerfile.
- **Packaging:** `requirements.txt` (`mcp[cli]>=1.12.0`), `pyproject.toml`, `.dockerignore`, `.gitignore`.
- **Hardened Dockerfile:** pinned base, OCI labels, apt/apk-aware extra packages, non-root user.
- **Docs & catalog:** `README.md`, `CLAUDE.md`, `INSTALL.md`, `catalog.yaml` + `registry.yaml`,
  and the `GLOCKE.md` builder prompt (when present).

Free-text tool names are sanitized into valid Python identifiers, and a working example tool
is emitted when you don't define any.

## Use

1. Open `index.html` (or the GitHub Page).
2. Click the **Die Glocke** tool card.
3. Fill in service name, tools, transport, Docker and output options.
4. **Generate** → copy / download individual files or **Download all** as a ZIP.

## Develop & test

The generation logic lives in `generator.js` as a pure `buildServerFiles(config)` (no DOM),
exported for both the browser and Node. `app.js` only gathers the form into a config and calls it.

```bash
node tests/run-tests.js
```

The suite asserts the output structure **and** proves correctness: every generated server is
`py_compile`d and imported against the installed `mcp` SDK, confirming its tools register.
Requires `python` on PATH with `mcp` importable.

## Files

| File | Role |
| --- | --- |
| `index.html` | UI + inline styling |
| `generator.js` | pure file-generation logic (tested) |
| `app.js` | DOM wiring → config → generator |
| `glocke.js` | logo / tool-card behaviour |
| `tests/run-tests.js` | Node + Python test suite |
| `GLOCKE.md` | LLM builder prompt (embedded into output) |

— made by Jan / IxI-Enki
