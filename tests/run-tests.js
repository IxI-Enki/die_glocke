#!/usr/bin/env node
/*
 * Die Glocke generator test suite.
 *
 * Pure-JS assertions on buildServerFiles output, PLUS real-world proof:
 * every generated *_server.py is written to a temp dir, byte-compiled with
 * `python -m py_compile`, and imported against the installed `mcp` SDK to
 * confirm it constructs a valid FastMCP server with its tools registered.
 *
 * Run: node tests/run-tests.js   (python on PATH, `mcp` importable)
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { buildServerFiles } = require('../generator.js');

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failures.push({ name, e }); console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
}
function filemap(built) {
  const m = {};
  built.files.forEach(f => { m[f.name] = f.content; });
  return m;
}

const PY = process.env.PYTHON || 'python';
function pythonAvailable() {
  const r = spawnSync(PY, ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}
function mcpImportable() {
  const r = spawnSync(PY, ['-c', 'import mcp.server.fastmcp'], { encoding: 'utf8' });
  return r.status === 0;
}

// --- sample configs --------------------------------------------------------

const cfgStdio = {
  svc: 'Weather API', desc: 'Fetch weather data', author: 'Jan Ritt',
  category: 'integration', license: 'MIT',
  apis: [{ name: 'OpenWeather', url: 'https://api.openweather.org', docs: '', rate: '' }],
  tools: [
    { name: 'fetch_weather', desc: 'Get current weather for a city.', params: 'city, units' },
    { name: 'forecast', desc: 'Multi-day forecast.', params: 'city, days' }
  ],
  auth: { type: 'API Key', header: 'X-API-Key', secret: 'WEATHER_API_TOKEN', embed: true },
  docker: { base: 'python:3.12-slim', workdir: '/app', uid: '1000', uname: 'mcpuser', extra: 'curl' },
  output: { emojis: { ok: '✅', err: '❌', info: 'ℹ️' }, includeInstall: true, includeCatalog: true },
  adv: { log: 'INFO', hc: true, metrics: true, oneLine: true, emptyDefaults: true },
  deps: 'mcp[cli]>=1.2.0 httpx', envs: [{ name: 'API_URL', value: 'https://x' }],
  transport: 'stdio',
  annotations: { readOnly: true, idempotent: true, openWorld: true }
};

const cfgHttp = {
  svc: 'Notes Service', desc: 'Manage notes', author: 'Tester',
  tools: [{ name: 'list-notes!', desc: 'List notes', params: '' }],
  docker: { base: 'python:3.12-slim' },
  output: { includeInstall: true, includeCatalog: true, structured: false },
  adv: {}, transport: 'streamable-http', httpPort: '9001',
  annotations: { readOnly: false, idempotent: false, openWorld: true }
};

const cfgMinimal = {
  svc: 'Bare', author: 'X',
  tools: [], apis: [], envs: [],
  docker: { base: 'alpine:latest' },
  output: { includeInstall: false, includeCatalog: false },
  adv: {}, transport: 'stdio'
};

// --- structural tests ------------------------------------------------------

console.log('Structural tests');

test('produces expected core files', () => {
  const m = filemap(buildServerFiles(cfgStdio));
  ['Dockerfile', '.dockerignore', '.gitignore', 'requirements.txt', 'pyproject.toml',
   'weather-api_server.py', 'README.md', 'CLAUDE.md', 'INSTALL.md', 'catalog.yaml', 'registry.yaml']
    .forEach(n => assert(m[n] !== undefined, 'missing ' + n));
});

test('slugifies server name', () => {
  assert.strictEqual(buildServerFiles(cfgStdio).serverNameSafe, 'weather-api');
});

test('requirements upgrades legacy mcp pin', () => {
  const m = filemap(buildServerFiles(cfgStdio));
  assert(/mcp\[cli\]>=1\.12\.0/.test(m['requirements.txt']), 'pin not upgraded');
  assert(!/1\.2\.0/.test(m['requirements.txt']), 'legacy pin remains');
});

test('server uses modern imports and annotations', () => {
  const py = filemap(buildServerFiles(cfgStdio))[ 'weather-api_server.py' ];
  assert(/from mcp\.server\.fastmcp import FastMCP/.test(py));
  assert(/from mcp\.types import ToolAnnotations/.test(py));
  assert(/from __future__ import annotations/.test(py));
  assert(/@mcp\.tool\(annotations=_ANNOTATIONS\)/.test(py));
  assert(/-> str:/.test(py), 'tools not typed');
  assert(/def main\(\) -> None:/.test(py));
});

test('embedded secret + env vars rendered', () => {
  const py = filemap(buildServerFiles(cfgStdio))['weather-api_server.py'];
  assert(/API_TOKEN = os\.environ\.get\("WEATHER_API_TOKEN", ""\)/.test(py));
  assert(/API_URL = os\.environ\.get\("API_URL", "https:\/\/x"\)/.test(py));
});

test('http transport sets host/port + run transport', () => {
  const py = filemap(buildServerFiles(cfgHttp))['notes-service_server.py'];
  assert(/FastMCP\("Notes Service", host="0\.0\.0\.0", port=9001\)/.test(py));
  assert(/mcp\.run\(transport="streamable-http"\)/.test(py));
});

test('http Dockerfile exposes port + healthcheck', () => {
  const m = filemap(buildServerFiles(cfgHttp));
  assert(/EXPOSE 9001/.test(m['Dockerfile']));
  assert(/HEALTHCHECK/.test(m['Dockerfile']));
});

test('invalid tool name becomes valid python identifier', () => {
  const py = filemap(buildServerFiles(cfgHttp))['notes-service_server.py'];
  assert(/async def list_notes\(/.test(py), 'tool name not sanitized');
});

test('minimal config still ships a working example tool', () => {
  const py = filemap(buildServerFiles(cfgMinimal))['bare_server.py'];
  assert(/async def ping\(/.test(py));
});

test('alpine base uses adduser', () => {
  assert(/adduser -D/.test(filemap(buildServerFiles(cfgMinimal))['Dockerfile']));
});

test('annotation flags propagate', () => {
  const py = filemap(buildServerFiles(cfgHttp))['notes-service_server.py'];
  assert(/readOnlyHint=False/.test(py));
  assert(/openWorldHint=True/.test(py));
});

// --- real python compile + import tests ------------------------------------

console.log('\nPython integration tests');

if (!pythonAvailable()) {
  failures.push({ name: 'python available', e: new Error('python not on PATH') });
  console.log('  ✗ python not available — skipping integration');
} else {
  const haveMcp = mcpImportable();
  if (!haveMcp) console.log('  ! mcp not importable — import test will be skipped, py_compile still runs');

  [['stdio', cfgStdio], ['http', cfgHttp], ['minimal', cfgMinimal]].forEach(([label, cfg]) => {
    const built = buildServerFiles(cfg);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'glocke-' + label + '-'));
    built.files.forEach(f => fs.writeFileSync(path.join(tmp, f.name), f.content));
    const pyFile = path.join(tmp, built.serverPyName);

    test('py_compile passes (' + label + ')', () => {
      const r = spawnSync(PY, ['-m', 'py_compile', pyFile], { encoding: 'utf8' });
      assert.strictEqual(r.status, 0, 'py_compile failed:\n' + (r.stderr || r.stdout));
    });

    if (haveMcp) {
      test('imports + registers tools against mcp SDK (' + label + ')', () => {
        const probe = [
          'import importlib.util, asyncio, sys',
          'spec = importlib.util.spec_from_file_location("gen_srv", r"' + pyFile.replace(/\\/g, '\\\\') + '")',
          'mod = importlib.util.module_from_spec(spec)',
          'spec.loader.exec_module(mod)',
          'tools = asyncio.run(mod.mcp.list_tools())',
          'assert len(tools) >= 1, "no tools registered"',
          'print("TOOLS=" + ",".join(t.name for t in tools))'
        ].join('\n');
        const r = spawnSync(PY, ['-c', probe], { encoding: 'utf8' });
        assert.strictEqual(r.status, 0, 'import/list_tools failed:\n' + (r.stderr || r.stdout));
        assert(/TOOLS=/.test(r.stdout), 'no tool list output');
      });
    }
  });
}

// --- summary ---------------------------------------------------------------

console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) {
  failures.forEach(f => console.log('FAIL: ' + f.name + ' — ' + (f.e && f.e.message)));
  process.exit(1);
}
