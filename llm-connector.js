/*
 * Die Glocke — OpenAI-compatible local LLM connector (browser + Node testable).
 * No cloud calls. Config in localStorage (browser only).
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'glocke-llm-connector';
  var DEFAULT_TIMEOUT_MS = 30000;

  var PRESETS = {
    lmstudio: { label: 'LM Studio', endpoint: 'http://localhost:1234/v1' },
    ollama: { label: 'Ollama', endpoint: 'http://localhost:11434/v1' },
    vllm: { label: 'vLLM', endpoint: '' }
  };

  function getFetch(fetchImpl) {
    if (fetchImpl) return fetchImpl;
    if (typeof fetch === 'function') return fetch.bind(root);
    return null;
  }

  function trimEndpoint(endpoint) {
    return String(endpoint || '').replace(/\/+$/, '');
  }

  function loadConfig() {
    if (typeof localStorage === 'undefined') return { endpoint: '', model: '', key: '' };
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { endpoint: '', model: '', key: '' };
      var parsed = JSON.parse(raw);
      return {
        endpoint: trimEndpoint(parsed.endpoint || ''),
        model: String(parsed.model || ''),
        key: String(parsed.key || '')
      };
    } catch (_) {
      return { endpoint: '', model: '', key: '' };
    }
  }

  function saveConfig(config) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        endpoint: trimEndpoint(config.endpoint || ''),
        model: String(config.model || ''),
        key: String(config.key || '')
      }));
    } catch (_) { /* ignore quota errors */ }
  }

  function parseChatResponse(data) {
    if (!data || !data.choices || !data.choices.length) return null;
    var choice = data.choices[0];
    if (choice.message && choice.message.content != null) return String(choice.message.content);
    if (choice.text != null) return String(choice.text);
    return null;
  }

  async function chat(endpoint, model, messages, key, options) {
    options = options || {};
    var fetchFn = getFetch(options.fetchImpl);
    if (!fetchFn) return { content: null, status: 'fetch unavailable' };

    var ep = trimEndpoint(endpoint);
    if (!ep || !model) return { content: null, status: 'endpoint or model missing' };

    var url = ep + '/chat/completions';
    var headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    var timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;

    try {
      var res = await fetchFn(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ model: model, messages: messages || [] }),
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);
      if (!res.ok) return { content: null, status: 'HTTP ' + res.status };
      var data = await res.json();
      var content = parseChatResponse(data);
      return content != null ? { content: content, status: 'ok' } : { content: null, status: 'empty response' };
    } catch (e) {
      if (timer) clearTimeout(timer);
      var msg = e && e.name === 'AbortError' ? 'timeout' : (e && e.message ? e.message : 'network error');
      if (/cors/i.test(msg) || /failed to fetch/i.test(msg)) msg = 'CORS or network error';
      return { content: null, status: msg };
    }
  }

  async function checkReachability(endpoint, key, options) {
    var cfg = loadConfig();
    var ep = trimEndpoint(endpoint || cfg.endpoint);
    var model = (options && options.model) || cfg.model || 'local-model';
    if (!ep) return { ok: false, status: 'no endpoint configured' };
    var result = await chat(ep, model, [{ role: 'user', content: 'ping' }], key || cfg.key, options);
    return result.content != null
      ? { ok: true, status: 'reachable' }
      : { ok: false, status: result.status };
  }

  async function improveDescription(desc, pluginName, connectorCfg, options) {
    var cfg = connectorCfg || loadConfig();
    var prompt = 'Improve this DokuWiki plugin description professionally (keep language): "' +
      String(desc || '') + '". Plugin name: "' + String(pluginName || '') + '". Return ONLY the improved description.';
    var result = await chat(cfg.endpoint, cfg.model, [{ role: 'user', content: prompt }], cfg.key, options);
    return result;
  }

  async function previewCode(pluginType, pluginBase, pluginName, desc, connectorCfg, options) {
    var cfg = connectorCfg || loadConfig();
    var prompt = 'Generate DokuWiki ' + pluginType + ' plugin PHP code for "' + pluginName +
      '" (base: ' + pluginBase + '). Description: ' + desc +
      '. Follow DokuWiki conventions with DOKU_INC guard. Return ONLY PHP code.';
    var result = await chat(cfg.endpoint, cfg.model, [{ role: 'user', content: prompt }], cfg.key, options);
    return result;
  }

  async function generateDeployment(pluginBase, pluginName, connectorCfg, options) {
    var cfg = connectorCfg || loadConfig();
    var prompt = 'Create a deployment guide for DokuWiki plugin "' + pluginName + '" (base: ' + pluginBase +
      '). Primary: Docker Compose container setup. Secondary: manual install to lib/plugins/. ' +
      'Include docker-compose.yml snippet and step-by-step instructions. Markdown format.';
    var result = await chat(cfg.endpoint, cfg.model, [{ role: 'user', content: prompt }], cfg.key, options);
    return result;
  }

  var api = {
    PRESETS: PRESETS,
    STORAGE_KEY: STORAGE_KEY,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    chat: chat,
    checkReachability: checkReachability,
    improveDescription: improveDescription,
    previewCode: previewCode,
    generateDeployment: generateDeployment
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LlmConnector = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
