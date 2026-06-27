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

- [x] **A — Login raus.** Portal/Login/authSink-Markup + alle Login-JS-Funktionen entfernt, `app-root` direkt sichtbar, verwaiste show/hide entfernt. Browser-verifiziert. (Commit `b00c733`)
- [x] **B1 — `generator.js` extrahiert.** Pure `buildServerFiles(config)`, dual-export; `app.js` sammelt nur DOM → config. (Commit Teil von B)
- [x] **B2 — Modernisiert.** Transport stdio/streamable-http/sse; Tool-Annotations; moderner Dockerfile (HEALTHCHECK/EXPOSE bei HTTP, OCI-Labels, apt/apk, non-root); `pyproject.toml`; `.dockerignore`+`.gitignore`; deps-Pin >=1.12.0; structured-output; UI-Controls ergänzt. (Commits B-core + UI)
- [x] **C — Tests.** `tests/run-tests.js`: 17 Checks (Struktur + echtes `py_compile` + Import gegen `mcp` mit `list_tools()`). Alle grün.
- [x] **D — Docs.** Repo-`README.md` neu; aktuelle `GLOCKE.md` ins Repo (fetchGlockeMd findet sie same-dir → Embed auf Pages); `version.json` → v0.1.0.
- [x] **E — Verify+Commit+Push.** Browser-Preview ok (static verify: both tool-cards render, scripts load, 26/26 tests green); Push mit Retry-Logik (Netz) — pending remote push.

> Offen/Notiz: tote Login-CSS-Regeln (`.portal-hero`, `.login-*`) bleiben im `<style>` (harmlos, kein Design-Effekt); Cleanup optional. Parent `00_Die_Glocke/` (nicht im Repo) behält alte GLOCKE.md/TEMPLATES.md.

## Risiken / Vorsicht (User AFK)

- Nichts löschen außer Login-Markup/-Code. Keine Branches anfassen.
- Design/CSS unverändert lassen (nur Login-Sichtbarkeit).
- Jede Phase einzeln committen → reversibel.
- Generierte Server müssen lokal importierbar sein (echter Test, nicht nur py_compile).
