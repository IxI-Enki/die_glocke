# Graph Report - die_glocke  (2026-06-27)

## Corpus Check
- 11 files · ~19,228 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 109 nodes · 163 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `25f2caec`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `buildServerFiles()` - 14 edges
2. `chat()` - 8 edges
3. `buildPluginFiles()` - 7 edges
4. `buildTypePhp()` - 6 edges
5. `buildServerPy()` - 6 edges
6. `loadConfig()` - 6 edges
7. `Die Glocke — Modernisierungs-Plan` - 6 edges
8. `validateDwForm()` - 5 edges
9. `normalizeConfig()` - 5 edges
10. `trimEndpoint()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (11 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (15): assert, {
  buildPluginFiles,
  sanitizeBase,
  phpIdent,
  normalizeConfig
}, { buildServerFiles }, cfgHttp, cfgMinimal, cfgStdio, dwBaseCfg, failures (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.25
Nodes (17): buildCatalogYaml(), buildClaudeMd(), buildDockerfile(), buildDockerignore(), buildGitignore(), buildInstallMd(), buildPyproject(), buildReadme() (+9 more)

### Community 2 - "Community 2"
Cohesion: 0.26
Nodes (14): buildActionHookStub(), buildActionPhp(), buildAdminPhp(), buildHelperHookStub(), buildHelperPhp(), buildPluginFiles(), buildPluginInfoTxt(), buildSyntaxPhp() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.23
Nodes (8): clearDwValidation(), collectDwConfig(), fieldVal(), initDokuWikiWizard(), isValidEmail(), setDwFieldError(), updateDwAiButtons(), validateDwForm()

### Community 4 - "Community 4"
Cohesion: 0.44
Nodes (10): chat(), checkReachability(), generateDeployment(), getFetch(), improveDescription(), loadConfig(), parseChatResponse(), previewCode() (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (6): Architektur-Entscheidung (Testbarkeit), Ausgangslage (verifiziert), Die Glocke — Modernisierungs-Plan, Phasen, Risiken / Vorsicht (User AFK), Standards-Recherche (2026-06)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (6): Develop & test, Die Glocke — MCP Server Generator & DokuWiki Plugin Wizard, DokuWiki Plugin Wizard, MCP generator, Optional local LLM connector, Use

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (5): Clarify first (ask only if missing), Installation (include in INSTALL.md), MCP Server Builder Prompt, Output files, Required standards (2026)

## Knowledge Gaps
- **29 isolated node(s):** `version`, `configurations`, `fs`, `os`, `path` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildServerFiles()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `buildPluginFiles()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `normalizeConfig()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `version`, `configurations`, `fs` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._