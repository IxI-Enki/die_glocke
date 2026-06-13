# Die Glocke — Modernisierungs-Plan

> Branch: `feat/modernize-generator` (von `feature/Glocke_Logo`). Keine anderen Branches/Dateien löschen.
> Ziel: (A) Schein-Login entfernen, (B) Generator auf aktuellen MCP-Stand (2026) heben — getestet, regelmäßig committet.

## Ausgangslage (verifiziert)

- **Repo** `die_glocke/`: `index.html` (UI+CSS inline, ~1300 Z.), `app.js` (Generator-Logik, DOM-gekoppelt), `glocke.js` (Logo/Toggle), `version.json`, `README.md`.
- **Parent** `00_Die_Glocke/` (NICHT im Repo): `GLOCKE.md` (MCP-Builder-Prompt), `TEMPLATES.md`, `GLOCKE_INTERACTIVE.md`. `app.js` fetcht `../GLOCKE.md` → nur lokal, nicht auf Pages.
- **Tool**: Browser-only. Form → `app.js` baut Dateien-Set → Modal mit Copy/Download/ZIP.
- **Generierter Server (alt)**: `from mcp.server.fastmcp import FastMCP`, `@mcp.tool()`, `mcp.run(transport='stdio')`, `requirements: mcp[cli]>=1.2.0`. Funktioniert, aber: keine Annotations, kein HTTP-Transport, kein pyproject, alter Dockerfile, kein structured output.

## Standards-Recherche (2026-06)

- Offizielles SDK: `mcp` (PyPI), lokal **1.17.0** installiert → testbar.
  - `FastMCP.run(transport=...)` unterstützt `stdio` / `sse` / `streamable-http`.
  - `FastMCP.tool(name, title, description, annotations, icons, structured_output)`.
  - `mcp.types.ToolAnnotations`: `title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint`.
- Standalone `fastmcp` (jlowin): 3.4.2 — mehr Features, aber lokal nicht installiert (nicht testbar).
- **Entscheidung:** Default-Output nutzt **offizielles `mcp` SDK** (kanonisch für Docker-MCP-Gateway, lokal verifizierbar). `requirements: mcp[cli]>=1.12.0`.

## Architektur-Entscheidung (Testbarkeit)

Generator-Logik aus `app.js` (DOM-gekoppelt) in **`generator.js`** extrahieren:
- Pure Funktion `buildServerFiles(config) -> [{name, content}]`, KEIN DOM.
- Dual-Export: Browser (`window.GlockeGenerator`) + Node (`module.exports`).
- `app.js` sammelt nur DOM → `config` → ruft `buildServerFiles`.
- → Node-Tests können `buildServerFiles` direkt prüfen + generierte `*_server.py` mit echtem `python -m py_compile` + Import gegen `mcp` testen.

## Phasen

- [ ] **A — Login raus.** `index.html`: `portal-hero`/`login-screen`/`authSink` entfernen, `app-root` direkt sichtbar. `app.js`: Login-/SHA-/Obfuscation-/Keystroke-Funktionen entfernen, Init bereinigen. Design bleibt (Header/Logo/Generator unverändert). Test: Seite lädt direkt in Generator.
- [ ] **B1 — `generator.js` extrahieren.** Pure Build-Logik, dual-export. `app.js` ruft sie. Verhalten identisch zu vorher (Regressionsschutz).
- [ ] **B2 — Modernisieren.** Transport-Option (stdio/streamable-http/sse); Tool-Annotations; moderner Dockerfile (HEALTHCHECK bei HTTP, OCI-Labels, pin); `pyproject.toml`; `.dockerignore` + `.gitignore`; deps bump; structured-output-Option; Context-Logging optional.
- [ ] **C — Tests.** `tests/` mit Node-Runner: Datei-Set + Struktur asserten; generierte `*_server.py` → `py_compile` + Import gegen `mcp`; Dockerfile/YAML-Validierung; alte vs. neue Option-Matrix.
- [ ] **D — Docs.** `GLOCKE.md`/`TEMPLATES.md`/`README.md` an neuen Output angleichen; ins Repo holen (GLOCKE.md fehlt im Repo → `fetchGlockeMd` robust machen).
- [ ] **E — Verify+Commit.** Browser-Preview: generieren, Modal, ZIP. Alle Tests grün. Push (Retry-Logik).

## Risiken / Vorsicht (User AFK)

- Nichts löschen außer Login-Markup/-Code. Keine Branches anfassen.
- Design/CSS unverändert lassen (nur Login-Sichtbarkeit).
- Jede Phase einzeln committen → reversibel.
- Generierte Server müssen lokal importierbar sein (echter Test, nicht nur py_compile).
