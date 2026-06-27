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

// --- DokuWiki Plugin Wizard tests ------------------------------------------

const {
  buildPluginFiles,
  sanitizeBase,
  phpIdent,
  normalizeConfig
} = require('../dokuwiki-generator.js');
const LlmConnector = require('../llm-connector.js');

function dwFilemap(files) {
  const m = {};
  files.forEach(f => { m[f.name] = f.content; });
  return m;
}

const dwBaseCfg = {
  plugin_base: 'weather_box',
  plugin_name: 'Weather Box',
  author: 'Jan Ritt',
  email: 'jan@example.com',
  url: 'https://example.com',
  desc: 'Shows weather info',
  plugin_type: 'syntax',
  complexity: 'advanced',
  assets: { css: true, js: true, conf: true, lang: true }
};

console.log('\nDokuWikiGenerator scaffold tests');

test('DokuWikiGenerator module loads', () => {
  assert(typeof buildPluginFiles === 'function');
});

test('syntax scaffold has required methods and guards', () => {
  const m = dwFilemap(buildPluginFiles(dwBaseCfg));
  const php = m['syntax.php'];
  assert(php, 'missing syntax.php');
  assert(/if\s*\(\s*!defined\s*\(\s*'DOKU_INC'\s*\)\s*\)\s*die\s*\(\s*\)\s*;/.test(php), 'DOKU_INC guard');
  assert(/extends\s+DokuWiki_Syntax_Plugin/.test(php));
  assert(/function\s+getType\s*\(/.test(php));
  assert(/function\s+getSort\s*\(/.test(php));
  assert(/function\s+connectTo\s*\(/.test(php));
  assert(/function\s+handle\s*\(/.test(php));
  assert(/function\s+render\s*\(/.test(php));
  const info = m['plugin.info.txt'];
  assert(/base\s+weather_box/.test(info));
  assert(/author\s+Jan Ritt/.test(info));
  assert(/email\s+jan@example.com/.test(info));
  assert(/name\s+Weather Box/.test(info));
  assert(/desc\s+Shows weather info/.test(info));
  assert(/url\s+https:\/\/example.com/.test(info));
  assert(/level\s+advanced/.test(info));
});

test('action scaffold uses DokuWiki_Action_Plugin', () => {
  const cfg = Object.assign({}, dwBaseCfg, { plugin_type: 'action' });
  const php = dwFilemap(buildPluginFiles(cfg))['action.php'];
  assert(/extends\s+DokuWiki_Action_Plugin/.test(php));
  assert(/function\s+register\s*\(/.test(php));
  assert(/if\s*\(\s*!defined\s*\(\s*'DOKU_INC'\s*\)\s*\)\s*die\s*\(\s*\)\s*;/.test(php));
});

test('admin scaffold uses DokuWiki_Admin_Plugin', () => {
  const cfg = Object.assign({}, dwBaseCfg, { plugin_type: 'admin' });
  const php = dwFilemap(buildPluginFiles(cfg))['admin.php'];
  assert(/extends\s+DokuWiki_Admin_Plugin/.test(php));
  assert(/function\s+getMenuSort\s*\(/.test(php));
  assert(/function\s+forAdminOnly\s*\(/.test(php));
  assert(/function\s+handle\s*\(/.test(php));
  assert(/function\s+html\s*\(/.test(php));
  assert(/if\s*\(\s*!defined\s*\(\s*'DOKU_INC'\s*\)\s*\)\s*die\s*\(\s*\)\s*;/.test(php));
});

test('helper scaffold uses DokuWiki_Helper_Plugin', () => {
  const cfg = Object.assign({}, dwBaseCfg, { plugin_type: 'helper' });
  const php = dwFilemap(buildPluginFiles(cfg))['helper.php'];
  assert(/extends\s+DokuWiki_Helper_Plugin/.test(php));
  assert(/function\s+getMethods\s*\(/.test(php));
  assert(/function\s+getData\s*\(/.test(php));
  assert(/if\s*\(\s*!defined\s*\(\s*'DOKU_INC'\s*\)\s*\)\s*die\s*\(\s*\)\s*;/.test(php));
});

test('asset toggles on include expected files', () => {
  const cfg = Object.assign({}, dwBaseCfg, {
    complexity: 'advanced',
    assets: { css: true, js: true, conf: true, lang: true }
  });
  const m = dwFilemap(buildPluginFiles(cfg));
  ['style/all.css', 'script.js', 'conf/default.php', 'conf/metadata.php', 'lang/en/lang.php', 'lang/de/lang.php']
    .forEach(n => assert(m[n] !== undefined, 'missing ' + n));
});

test('asset toggles off omit optional files', () => {
  const cfg = Object.assign({}, dwBaseCfg, {
    assets: { css: false, js: false, conf: false, lang: false }
  });
  const m = dwFilemap(buildPluginFiles(cfg));
  ['style/all.css', 'script.js', 'conf/default.php', 'conf/metadata.php', 'lang/en/lang.php', 'lang/de/lang.php']
    .forEach(n => assert(m[n] === undefined, 'should omit ' + n));
});


test('basic complexity omits conf and lang when assets on', () => {
  const cfg = Object.assign({}, dwBaseCfg, {
    complexity: 'basic',
    assets: { css: true, js: true, conf: true, lang: true }
  });
  const m = dwFilemap(buildPluginFiles(cfg));
  assert(/level\s+basic/.test(m['plugin.info.txt']), 'plugin.info level basic');
  ['conf/default.php', 'conf/metadata.php', 'lang/en/lang.php', 'lang/de/lang.php']
    .forEach(n => assert(m[n] === undefined, 'basic should omit ' + n));
  assert(m['style/all.css'] !== undefined, 'basic may include css');
});
test('identifier sanitization for non-ASCII and reserved tokens', () => {
  const cfg = {
    plugin_base: 'Météo Café',
    plugin_name: 'class',
    author: 'Author',
    email: 'a@b.c',
    url: 'https://x',
    desc: 'd',
    plugin_type: 'syntax',
    complexity: 'basic',
    assets: { css: false, js: false, conf: false, lang: false }
  };
  const norm = normalizeConfig(cfg);
  assert.strictEqual(norm.plugin_base, 'm_t_o_caf');
  const php = dwFilemap(buildPluginFiles(cfg))['syntax.php'];
  assert(/class\s+syntax_plugin_m_t_o_caf\s+extends/.test(php));
  assert.strictEqual(sanitizeBase('Météo Café'), 'm_t_o_caf');
  assert.strictEqual(phpIdent('class', 'tool'), 'tool_class');
});

console.log('\nLlmConnector tests');

async function runAsyncTests() {
  try {
    const mockFetchOk = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello from mock' } }] })
    });
    const r1 = await LlmConnector.chat('http://localhost:9999/v1', 'test-model',
      [{ role: 'user', content: 'hi' }], '', { fetchImpl: mockFetchOk, timeoutMs: 5000 });
    assert.strictEqual(r1.content, 'hello from mock');
    assert.strictEqual(r1.status, 'ok');
    passed++; console.log('  ✓ connector mock success returns content');

    const mockFetchFail = async () => { throw new Error('Failed to fetch'); };
    const r2 = await LlmConnector.chat('http://localhost:1/v1', 'm',
      [{ role: 'user', content: 'hi' }], '', { fetchImpl: mockFetchFail, timeoutMs: 100 });
    assert.strictEqual(r2.content, null);
    assert(r2.status, 'expected status string');
    passed++; console.log('  ✓ connector failure returns null content without throw');

    const mockFetchHttp = async () => ({ ok: false, status: 503, json: async () => ({}) });
    const r3 = await LlmConnector.chat('http://localhost:2/v1', 'm',
      [{ role: 'user', content: 'x' }], '', { fetchImpl: mockFetchHttp });
    assert.strictEqual(r3.content, null);
    assert(/503/.test(r3.status));
    passed++; console.log('  ✓ connector HTTP error degrades gracefully');
  } catch (e) {
    failures.push({ name: 'async connector tests', e });
    console.log('  ✗ async connector tests\n      ' + (e && e.message));
  }
}

runAsyncTests().then(function () {
  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) {
    failures.forEach(f => console.log('FAIL: ' + f.name + ' — ' + (f.e && f.e.message)));
    process.exit(1);
  }
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
