/*
 * Die Glocke — MCP server file generator (pure logic, no DOM).
 *
 * Exports `buildServerFiles(config)` which returns
 *   { serverNameSafe, serverPyName, files: [{name, content}, ...] }
 *
 * Works in the browser (window.GlockeGenerator) and in Node (module.exports),
 * so the same code path is unit-tested headlessly and runs live in the page.
 *
 * Targets the official MCP Python SDK (`mcp`, FastMCP) with 2026 standards:
 * tool annotations, stdio / streamable-http / sse transports, typed returns,
 * pyproject packaging and a hardened non-root Dockerfile.
 */
(function (root) {
  'use strict';

  var SDK_REQ = 'mcp[cli]>=1.12.0';

  // --- helpers -------------------------------------------------------------

  function slug(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'server';
  }

  // Valid Python identifier from a free-text tool name.
  function pyIdent(name, fallback) {
    var id = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!id || /^[0-9]/.test(id)) { id = (fallback || 'tool') + (id ? '_' + id : ''); }
    return id;
  }

  // Escape a string for a Python double-quoted literal.
  function pyStr(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, '\\n');
  }

  function dq(s) { return '"' + pyStr(s) + '"'; }

  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  // --- python server -------------------------------------------------------

  function buildServerPy(cfg, names) {
    var svc = cfg.svc;
    var desc = cfg.desc || (svc + ' MCP server');
    var transport = cfg.transport || 'stdio';
    var isHttp = transport === 'streamable-http' || transport === 'sse';
    var logLevel = (cfg.adv && cfg.adv.log) || 'INFO';
    var emojiOk = (cfg.output && cfg.output.emojis && cfg.output.emojis.ok) || '✅';
    var emojiErr = (cfg.output && cfg.output.emojis && cfg.output.emojis.err) || '❌';
    var oneLine = !(cfg.adv && cfg.adv.oneLine === false);
    var emptyDefaults = !(cfg.adv && cfg.adv.emptyDefaults === false);
    var ann = cfg.annotations || { readOnly: true, idempotent: true, openWorld: true };
    var structured = !!(cfg.output && cfg.output.structured);
    var apis = cfg.apis || [];
    var hasApis = apis.some(function (a) { return a && (a.url || a.name); });
    var port = parseInt((cfg.httpPort != null ? cfg.httpPort : 8000), 10) || 8000;

    var L = [];
    L.push('#!/usr/bin/env python3');
    L.push('"""' + pyStr(svc + ' MCP Server — ' + desc) + '"""');
    L.push('from __future__ import annotations');
    L.push('');
    L.push('import logging');
    L.push('import os');
    L.push('import sys');
    if (hasApis) { L.push('import httpx'); }
    L.push('');
    L.push('from mcp.server.fastmcp import FastMCP');
    L.push('from mcp.types import ToolAnnotations');
    L.push('');
    L.push('logging.basicConfig(');
    L.push('    level=logging.' + logLevel + ',');
    L.push('    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",');
    L.push('    stream=sys.stderr,');
    L.push(')');
    L.push('logger = logging.getLogger(' + dq(names.serverNameSafe) + ')');
    L.push('');

    // Environment-driven configuration.
    var envLines = [];
    if (cfg.auth && cfg.auth.embed && cfg.auth.secret) {
      envLines.push('API_TOKEN = os.environ.get(' + dq(cfg.auth.secret.toUpperCase()) + ', "")');
    }
    (cfg.envs || []).forEach(function (e) {
      if (e && e.name) {
        envLines.push(pyIdent(e.name).toUpperCase() + ' = os.environ.get(' + dq(e.name) + ', ' + dq(e.value || '') + ')');
      }
    });
    if (envLines.length) {
      L.push('# Configuration (environment variables)');
      envLines.forEach(function (x) { L.push(x); });
      L.push('');
    }

    // Server instance — http transports need host/port.
    if (isHttp) {
      L.push('mcp = FastMCP(' + dq(svc) + ', host="0.0.0.0", port=' + port + ')');
    } else {
      L.push('mcp = FastMCP(' + dq(svc) + ')');
    }
    L.push('');

    // Shared annotation preset.
    var annParts = [];
    annParts.push('readOnlyHint=' + (ann.readOnly !== false ? 'True' : 'False'));
    annParts.push('idempotentHint=' + (ann.idempotent !== false ? 'True' : 'False'));
    annParts.push('openWorldHint=' + (ann.openWorld !== false ? 'True' : 'False'));
    L.push('_ANNOTATIONS = ToolAnnotations(' + annParts.join(', ') + ')');
    L.push('');

    var toolDecorator = structured
      ? '@mcp.tool(annotations=_ANNOTATIONS, structured_output=True)'
      : '@mcp.tool(annotations=_ANNOTATIONS)';

    // User tools.
    var usedNames = {};
    var tools = (cfg.tools || []).filter(function (t) { return t && (t.name || t.desc); });
    if (!tools.length) {
      // Always ship at least one working example tool.
      tools = [{ name: 'ping', desc: 'Return a liveness response.', params: '' }];
    }
    tools.forEach(function (t, i) {
      var fn = pyIdent(t.name, 'tool');
      while (usedNames[fn]) { fn = fn + '_' + (i + 1); }
      usedNames[fn] = 1;
      var params = uniq((t.params || '').split(',').map(function (s) { return pyIdent(s, ''); }).filter(Boolean));
      var sig = params.map(function (p) { return p + ': str = ' + (emptyDefaults ? '""' : '""'); }).join(', ');
      var docRaw = (t.desc || 'Execute the ' + fn + ' tool.');
      var doc = oneLine ? docRaw.replace(/\r?\n/g, ' ') : docRaw;
      L.push(toolDecorator);
      L.push('async def ' + fn + '(' + sig + ') -> str:');
      L.push('    """' + pyStr(doc) + '"""');
      L.push('    try:');
      if (params.length) {
        L.push('        # TODO: implement using parameters: ' + params.join(', '));
      } else {
        L.push('        # TODO: implement tool logic');
      }
      L.push('        return f"' + pyStr(emojiOk) + ' ' + fn + ' executed"');
      L.push('    except Exception as exc:  # noqa: BLE001');
      L.push('        logger.exception("%s failed", "' + fn + '")');
      L.push('        return f"' + pyStr(emojiErr) + ' Error: {exc}"');
      L.push('');
    });

    // Optional health / metrics tools.
    if (cfg.adv && cfg.adv.hc) {
      L.push('@mcp.tool(annotations=_ANNOTATIONS)');
      L.push('async def health() -> str:');
      L.push('    """Report server liveness."""');
      L.push('    return f"' + pyStr(emojiOk) + ' ok"');
      L.push('');
    }
    if (cfg.adv && cfg.adv.metrics) {
      L.push('@mcp.tool(annotations=_ANNOTATIONS)');
      L.push('async def metrics() -> str:');
      L.push('    """Return basic runtime metrics."""');
      L.push('    return f"' + pyStr((cfg.output && cfg.output.emojis && cfg.output.emojis.info) || 'ℹ️') + ' metrics: none"');
      L.push('');
    }

    L.push('def main() -> None:');
    L.push('    logger.info("Starting %s MCP server (transport=%s)", ' + dq(svc) + ', ' + dq(transport) + ')');
    L.push('    try:');
    L.push('        mcp.run(transport=' + dq(transport) + ')');
    L.push('    except Exception as exc:  # noqa: BLE001');
    L.push('        logger.exception("Server crashed")');
    L.push('        sys.exit(1)');
    L.push('');
    L.push('');
    L.push('if __name__ == "__main__":');
    L.push('    main()');
    L.push('');
    return L.join('\n');
  }

  // --- ancillary files -----------------------------------------------------

  function buildRequirements(cfg) {
    var raw = (cfg.deps || '').trim();
    var lines;
    if (raw) {
      lines = raw.split(/\s+/);
      // Upgrade the legacy pin if the user left the old default in place.
      lines = lines.map(function (l) { return /^mcp(\[|>=|$)/.test(l) && /1\.2\.0/.test(l) ? SDK_REQ : l; });
    } else {
      lines = [SDK_REQ];
      if ((cfg.apis || []).some(function (a) { return a && (a.url || a.name); })) { lines.push('httpx>=0.27'); }
    }
    return uniq(lines).join('\n') + '\n';
  }

  function buildPyproject(cfg, names) {
    var deps = buildRequirements(cfg).trim().split('\n').map(function (d) { return '    "' + d + '",'; }).join('\n');
    return [
      '[project]',
      'name = "' + names.serverNameSafe + '-mcp-server"',
      'version = "0.1.0"',
      'description = "' + (cfg.desc || (cfg.svc + ' MCP server')).replace(/"/g, '\\"') + '"',
      'readme = "README.md"',
      'requires-python = ">=3.11"',
      'license = { text = "' + (cfg.license || 'MIT') + '" }',
      'authors = [{ name = "' + (cfg.author || '').replace(/"/g, '\\"') + '" }]',
      'dependencies = [',
      deps,
      ']',
      '',
      '[build-system]',
      'requires = ["hatchling"]',
      'build-backend = "hatchling.build"',
      ''
    ].join('\n');
  }

  function buildDockerfile(cfg, names) {
    var base = (cfg.docker && cfg.docker.base) || 'python:3.12-slim';
    var workdir = (cfg.docker && cfg.docker.workdir) || '/app';
    var uid = (cfg.docker && cfg.docker.uid) || '1000';
    var uname = (cfg.docker && cfg.docker.uname) || 'mcpuser';
    var extra = (cfg.docker && cfg.docker.extra || '').trim();
    var transport = cfg.transport || 'stdio';
    var isHttp = transport === 'streamable-http' || transport === 'sse';
    var port = parseInt((cfg.httpPort != null ? cfg.httpPort : 8000), 10) || 8000;
    var isAlpine = /alpine/i.test(base);

    var L = [];
    L.push('# syntax=docker/dockerfile:1');
    L.push('FROM ' + base);
    L.push('');
    L.push('LABEL org.opencontainers.image.title="' + (cfg.svc || 'mcp-server').replace(/"/g, '') + '"');
    L.push('LABEL org.opencontainers.image.description="' + (cfg.desc || '').replace(/"/g, '') + '"');
    if (cfg.author) { L.push('LABEL org.opencontainers.image.authors="' + cfg.author.replace(/"/g, '') + '"'); }
    L.push('');
    L.push('ENV PYTHONUNBUFFERED=1 \\');
    L.push('    PYTHONDONTWRITEBYTECODE=1');
    L.push('WORKDIR ' + workdir);
    L.push('');
    if (extra) {
      if (isAlpine) {
        L.push('RUN apk add --no-cache ' + extra.split(/[,\s]+/).filter(Boolean).join(' '));
      } else {
        L.push('RUN apt-get update && apt-get install -y --no-install-recommends ' + extra.split(/[,\s]+/).filter(Boolean).join(' ') + ' \\');
        L.push('    && rm -rf /var/lib/apt/lists/*');
      }
      L.push('');
    }
    L.push('COPY requirements.txt .');
    L.push('RUN pip install --no-cache-dir -r requirements.txt');
    L.push('COPY ' + names.serverPyName + ' .');
    L.push('');
    // Non-root user (alpine uses adduser).
    if (isAlpine) {
      L.push('RUN adduser -D -u ' + uid + ' ' + uname + ' && chown -R ' + uname + ':' + uname + ' ' + workdir);
    } else {
      L.push('RUN useradd -m -u ' + uid + ' ' + uname + ' && chown -R ' + uname + ':' + uname + ' ' + workdir);
    }
    L.push('USER ' + uname);
    L.push('');
    if (isHttp) {
      L.push('EXPOSE ' + port);
      L.push('HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \\');
      L.push('    CMD python -c "import socket,sys; s=socket.socket(); sys.exit(0 if s.connect_ex((\'127.0.0.1\',' + port + '))==0 else 1)"');
      L.push('');
    }
    L.push('CMD ["python", "' + names.serverPyName + '"]');
    L.push('');
    return L.join('\n');
  }

  function buildReadme(cfg, names) {
    var transport = cfg.transport || 'stdio';
    var tools = (cfg.tools || []).filter(function (t) { return t && t.name; });
    var apis = (cfg.apis || []).filter(function (a) { return a && a.name; });
    var L = [];
    L.push('# ' + cfg.svc + ' MCP Server');
    L.push('');
    if (cfg.desc) { L.push(cfg.desc); L.push(''); }
    L.push('Generated with **Die Glocke**. Targets the official MCP Python SDK (FastMCP).');
    L.push('');
    L.push('- **Author:** ' + (cfg.author || '—'));
    L.push('- **Category:** ' + (cfg.category || '—'));
    L.push('- **License:** ' + (cfg.license || 'MIT'));
    L.push('- **Transport:** `' + transport + '`');
    L.push('');
    L.push('## Tools');
    L.push('');
    if (tools.length) {
      tools.forEach(function (t) { L.push('- `' + pyIdent(t.name, 'tool') + '` — ' + (t.desc || '')); });
    } else {
      L.push('- `ping` — liveness example');
    }
    L.push('');
    if (apis.length) {
      L.push('## APIs');
      L.push('');
      apis.forEach(function (a) { L.push('- ' + a.name + (a.url ? ' (' + a.url + ')' : '')); });
      L.push('');
    }
    L.push('## Run');
    L.push('');
    L.push('```bash');
    L.push('pip install -r requirements.txt');
    if (transport === 'stdio') {
      L.push('python ' + names.serverPyName + '   # stdio (MCP Gateway / desktop clients)');
    } else {
      L.push('python ' + names.serverPyName + '   # serves ' + transport + ' on :' + (cfg.httpPort || 8000));
    }
    L.push('```');
    L.push('');
    L.push('### Docker');
    L.push('');
    L.push('```bash');
    L.push('docker build -t ' + names.serverNameSafe + '-mcp-server .');
    if (transport === 'stdio') {
      L.push('docker run --rm -i ' + names.serverNameSafe + '-mcp-server');
    } else {
      L.push('docker run --rm -p ' + (cfg.httpPort || 8000) + ':' + (cfg.httpPort || 8000) + ' ' + names.serverNameSafe + '-mcp-server');
    }
    L.push('```');
    L.push('');
    return L.join('\n');
  }

  function buildClaudeMd() {
    return [
      '# CLAUDE.md',
      '',
      'Conventions for this MCP server (official `mcp` SDK / FastMCP):',
      '',
      '- One `@mcp.tool()` per action; annotate with `ToolAnnotations`.',
      '- Async tools, typed `-> str` (or structured) returns.',
      '- Validate inputs; never raise out of a tool — catch and return an error string.',
      '- Log to **stderr** only (stdout is the stdio transport).',
      '- Configuration via environment variables; never hard-code secrets.',
      '- Docker image runs as a non-root user.',
      '- Keep docstrings concise; they become the tool description Claude reads.',
      ''
    ].join('\n');
  }

  function buildInstallMd(cfg, names) {
    var transport = cfg.transport || 'stdio';
    var L = [];
    L.push('# Installation');
    L.push('');
    L.push('1. Save all generated files into one folder.');
    L.push('2. Build the image:');
    L.push('   ```bash');
    L.push('   docker build -t ' + names.serverNameSafe + '-mcp-server .');
    L.push('   ```');
    if (cfg.auth && cfg.auth.secret) {
      L.push('3. Provide the secret `' + cfg.auth.secret.toUpperCase() + '` (Docker secret or `-e`).');
    }
    if (transport === 'stdio') {
      L.push((cfg.auth && cfg.auth.secret ? '4' : '3') + '. Register with the MCP Gateway / your client (stdio).');
    } else {
      L.push((cfg.auth && cfg.auth.secret ? '4' : '3') + '. Run and connect over `' + transport + '` at port ' + (cfg.httpPort || 8000) + '.');
    }
    L.push('');
    return L.join('\n');
  }

  function buildCatalogYaml(cfg, names) {
    var tools = (cfg.tools || []).filter(function (t) { return t && t.name; });
    var L = [];
    L.push('version: 2');
    L.push('name: custom');
    L.push('displayName: Custom MCP Servers');
    L.push('registry:');
    L.push('  ' + names.serverNameSafe + ':');
    L.push('    description: ' + dq(cfg.desc || ''));
    L.push('    title: ' + dq(cfg.svc || ''));
    L.push('    type: server');
    L.push('    dateAdded: ' + dq(new Date().toISOString()));
    L.push('    image: ' + names.serverNameSafe + '-mcp-server:latest');
    L.push('    ref: ""');
    L.push('    tools:');
    if (tools.length) {
      tools.forEach(function (t) { L.push('      - name: ' + pyIdent(t.name, 'tool')); });
    } else {
      L.push('      - name: ping');
    }
    L.push('');
    return L.join('\n');
  }

  function buildRegistryYaml(names) {
    return 'registry:\n  ' + names.serverNameSafe + ':\n    ref: ""\n';
  }

  function buildDockerignore() {
    return ['__pycache__/', '*.pyc', '.venv/', '.git/', '.gitignore', '*.md', '.dockerignore', ''].join('\n');
  }

  function buildGitignore() {
    return ['__pycache__/', '*.py[cod]', '.venv/', 'venv/', '.env', '*.log', ''].join('\n');
  }

  // --- main entry ----------------------------------------------------------

  function buildServerFiles(cfg) {
    cfg = cfg || {};
    var serverNameSafe = slug(cfg.svc);
    var serverPyName = serverNameSafe + '_server.py';
    var names = { serverNameSafe: serverNameSafe, serverPyName: serverPyName };

    var files = [
      { name: 'Dockerfile', content: buildDockerfile(cfg, names) },
      { name: '.dockerignore', content: buildDockerignore() },
      { name: '.gitignore', content: buildGitignore() },
      { name: 'requirements.txt', content: buildRequirements(cfg) },
      { name: 'pyproject.toml', content: buildPyproject(cfg, names) },
      { name: serverPyName, content: buildServerPy(cfg, names) },
      { name: 'README.md', content: buildReadme(cfg, names) },
      { name: 'CLAUDE.md', content: buildClaudeMd() }
    ];

    var out = cfg.output || {};
    if (out.includeInstall !== false) { files.push({ name: 'INSTALL.md', content: buildInstallMd(cfg, names) }); }
    if (out.includeCatalog !== false) {
      files.push({ name: 'catalog.yaml', content: buildCatalogYaml(cfg, names) });
      files.push({ name: 'registry.yaml', content: buildRegistryYaml(names) });
    }
    if (cfg.promptText) { files.push({ name: 'GLOCKE.md', content: cfg.promptText }); }

    return { serverNameSafe: serverNameSafe, serverPyName: serverPyName, files: files };
  }

  var api = {
    buildServerFiles: buildServerFiles,
    slug: slug,
    pyIdent: pyIdent,
    _internals: {
      buildServerPy: buildServerPy,
      buildDockerfile: buildDockerfile,
      buildRequirements: buildRequirements
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GlockeGenerator = api;
  }
})(typeof window !== 'undefined' ? window : this);
