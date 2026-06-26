// Utilities
async function fetchGlockeMd(){
  const bases=['','/', window.location.origin+'/', (new URL('.', window.location.href)).href];
  const names=['GLOCKE.md','glocke.md'];
  for(let b=0;b<bases.length;b++){
    for(let n=0;n<names.length;n++){
      const url=bases[b]+names[n];
      try{ const res=await fetch(url,{cache:'no-store'}); if(res.ok) return await res.text(); }catch(_){}
    }
  }
  try{ const res=await fetch('../GLOCKE.md',{cache:'no-store'}); if(res.ok) return await res.text(); }catch(_){ }
  return '';
}

function addDownloadAllButton(files, serverNameSafe){
  const content=document.getElementById('modal-content');
  const bar=document.createElement('div');
  bar.style.display='flex'; bar.style.justifyContent='flex-end'; bar.style.gap='0.5rem'; bar.style.margin='0 0 0.5rem 0';
  const dlAll=document.createElement('button');
  dlAll.className='mcp-btn';
  dlAll.textContent='Download all files';
  dlAll.addEventListener('click', async ()=>{
    try{
      const zip=new JSZip();
      const dir=zip.folder(`${serverNameSafe}-mcp-server`);
      files.forEach(f=>{ dir.file(f.name, f.content); });
      const blob=await zip.generateAsync({type:'blob'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=`${serverNameSafe}-mcp-server.zip`;
      document.body.appendChild(a); a.click(); a.remove();
    }catch(e){ console.error(e); }
  });
  bar.appendChild(dlAll);
  content.appendChild(bar);
}

// App init
document.addEventListener('DOMContentLoaded',()=>{
  // Inject version string under PORTAL title; increments per commit via Git short SHA length
  try{
    const vEl=document.getElementById('portal-version');
    const hv=document.getElementById('header-version');
    // Prefer window.__APP_VERSION__, then version.json (static), fallback to date string
    if(window.__APP_VERSION__){ if(vEl) vEl.textContent=window.__APP_VERSION__; }
    else {
      fetch('version.json', { cache: 'no-store' }).then(r=>r.ok?r.json():null).then(j=>{
        const text = j ? `${j.version} • ${j.date}` : 'v0.0.0 • '+(new Date()).toISOString().slice(0,10);
        if(vEl) vEl.textContent = text;
        if(hv) hv.textContent = text;
      }).catch(()=>{ if(vEl) vEl.textContent='v0.0.0 • '+(new Date()).toISOString().slice(0,10); });
    }
  }catch(_){ }

  // Adders
  document.getElementById('btn-add-tool').addEventListener('click',()=>{
    const container=document.getElementById('tools-container');
    const div=document.createElement('div'); div.className='tool-item';
    div.innerHTML=`
      <label class="mcp-label">Tool Name</label>
      <input class="mcp-input tool-name" type="text" placeholder="tool_name" />
      <label class="mcp-label">Description</label>
      <input class="mcp-input tool-desc" type="text" placeholder="Single-line description" />
      <label class="mcp-label">Parameters (comma-separated)</label>
      <input class="mcp-input tool-params" type="text" placeholder="param1, param2" />
    `;
    container.appendChild(div);
  });

  document.getElementById('btn-add-env').addEventListener('click',()=>{
    const container=document.getElementById('env-vars-container');
    const div=document.createElement('div'); div.className='env-item';
    div.innerHTML=`
      <label class="mcp-label">Name</label>
      <input class="mcp-input env-name" type="text" placeholder="VAR_NAME" />
      <label class="mcp-label">Value (optional)</label>
      <input class="mcp-input env-value" type="text" placeholder="value" />
    `;
    container.appendChild(div);
  });

  document.getElementById('btn-add-api').addEventListener('click',()=>{
    const container=document.getElementById('apis-container');
    const div=document.createElement('div'); div.className='api-item';
    div.innerHTML=`
      <label class="mcp-label">API Name</label>
      <input class="mcp-input api-name" type="text" placeholder="Service Name" />
      <label class="mcp-label">Base URL</label>
      <input class="mcp-input api-url" type="text" placeholder="https://api.example.com" />
      <label class="mcp-label">Docs URL</label>
      <input class="mcp-input api-docs" type="text" placeholder="https://docs.example.com" />
      <label class="mcp-label">Rate Limit</label>
      <input class="mcp-input api-rate" type="text" placeholder="1000 req/hour" />
    `;
    container.appendChild(div);
  });

  // Generate
  document.getElementById('btn-generate').addEventListener('click', async ()=>{
    const svc=document.getElementById('input-service-name').value.trim();
    const desc=document.getElementById('input-description').value.trim();
    const author=document.getElementById('input-author').value.trim();
    const category=document.getElementById('select-category').value;
    const tags=document.getElementById('input-tags').value.trim();
    const license=document.getElementById('select-license').value;

    const apis=Array.from(document.querySelectorAll('#apis-container .api-item')).map(el=>({
      name:(el.querySelector('.api-name')||{}).value||'', url:(el.querySelector('.api-url')||{}).value||'', docs:(el.querySelector('.api-docs')||{}).value||'', rate:(el.querySelector('.api-rate')||{}).value||''
    }));

    const tools=Array.from(document.querySelectorAll('#tools-container .tool-item')).map(el=>({
      name:(el.querySelector('.tool-name')||{}).value||'', desc:(el.querySelector('.tool-desc')||{}).value||'', params:(el.querySelector('.tool-params')||{}).value||''
    }));

    const auth={
      type:document.getElementById('select-auth-type').value,
      header:document.getElementById('input-auth-header').value.trim(),
      secret:document.getElementById('input-secret-name').value.trim(),
      embed:document.getElementById('check-auth-secret-embed').checked
    };

    const docker={
      base:document.getElementById('select-base-image').value,
      workdir:document.getElementById('input-workdir').value,
      uid:document.getElementById('input-user-id').value,
      uname:document.getElementById('input-user-name').value,
      extra:document.getElementById('input-docker-packages').value,
      net:document.getElementById('check-docker-network').checked,
      priv:document.getElementById('check-docker-privileged').checked
    };

    const output={
      style:document.getElementById('select-output-format').value,
      emojis:{ ok:document.getElementById('input-emoji-success').value, err:document.getElementById('input-emoji-error').value, warn:document.getElementById('input-emoji-warning').value, info:document.getElementById('input-emoji-info').value },
      color:document.getElementById('check-color-output').checked,
      ts:document.getElementById('check-timestamps').checked,
      verbose:document.getElementById('check-verbose').checked,
      includeInstall:document.getElementById('check-install-guide').checked,
      includeCatalog:document.getElementById('check-catalog-snippets').checked
    };

    const adv={
      timeout:document.getElementById('input-timeout').value,
      retries:document.getElementById('input-max-retries').value,
      log:document.getElementById('select-log-level').value,
      cache:document.getElementById('select-cache').value,
      ttl:document.getElementById('input-cache-ttl').value,
      hc:document.getElementById('check-health-check').checked,
      metrics:document.getElementById('check-metrics').checked,
      shutdown:document.getElementById('check-graceful-shutdown').checked,
      oneLine:document.getElementById('check-one-line-docstrings').checked,
      emptyDefaults:document.getElementById('check-empty-defaults').checked
    };

    const deps=(document.getElementById('input-dependencies').value||'').trim();
    const sysdeps=document.getElementById('input-sys-deps').value.trim();
    const envs=Array.from(document.querySelectorAll('#env-vars-container .env-item')).map(el=>({ name:(el.querySelector('.env-name')||{}).value||'', value:(el.querySelector('.env-value')||{}).value||'' }));

    if(!svc){ alert('Please enter a Service Name.'); return; }
    if(!author){ alert('Please enter an Author.'); return; }

    const promptText=await fetchGlockeMd();

    // New (optional) modern controls — read defensively so the form works
    // whether or not the markup is present yet.
    const val=(id,def)=>{ const el=document.getElementById(id); return el?el.value:def; };
    const chk=(id,def)=>{ const el=document.getElementById(id); return el?el.checked:def; };

    const config={
      svc, desc, author, category, tags, license,
      apis, tools, auth, docker, output, adv, deps, sysdeps, envs, promptText,
      transport: val('select-transport','stdio'),
      httpPort: val('input-http-port','8000'),
      annotations:{
        readOnly: chk('check-ann-readonly', true),
        idempotent: chk('check-ann-idempotent', true),
        openWorld: chk('check-ann-openworld', true)
      }
    };
    config.output=Object.assign({}, output, { structured: chk('check-structured-output', false) });

    const built=window.GlockeGenerator.buildServerFiles(config);
    const serverNameSafe=built.serverNameSafe;
    const files=built.files;

    const modal=document.getElementById('generator-modal');
    const content=document.getElementById('modal-content');
    content.innerHTML='';

    // Add Download All button
    addDownloadAllButton(files, serverNameSafe);

    files.forEach(f=>{
      const wrap=document.createElement('div'); wrap.className='file-block';
      const name=document.createElement('div'); name.className='file-name'; name.textContent=f.name;
      const actions=document.createElement('div'); actions.className='file-actions';
      const btnCopy=document.createElement('button'); btnCopy.className='add-btn'; btnCopy.textContent='Copy';
      btnCopy.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(f.content); btnCopy.textContent='Copied'; setTimeout(()=>btnCopy.textContent='Copy',1200);}catch(_){} });
      const btnDl=document.createElement('button'); btnDl.className='add-btn'; btnDl.textContent='Download';
      btnDl.addEventListener('click',()=>{ const blob=new Blob([f.content],{type:'text/plain;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=f.name; document.body.appendChild(a); a.click(); a.remove(); });
      actions.appendChild(btnCopy); actions.appendChild(btnDl);
      const pre=document.createElement('pre'); pre.className='code-block'; pre.textContent=f.content;
      wrap.appendChild(name); wrap.appendChild(actions); wrap.appendChild(pre);
      content.appendChild(wrap);
    });
    document.getElementById('modal-close').onclick=()=>{ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); };
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  });

  // Tools toggle behavior remains in glocke.js

  // --- DokuWiki Plugin Wizard ------------------------------------------------
  initDokuWikiWizard();
});

function fieldVal(id, placeholderDefault) {
  const el = document.getElementById(id);
  if (!el) return '';
  const v = String(el.value || '').trim();
  return v || (placeholderDefault != null ? String(placeholderDefault) : '');
}

function setDwStatus(msg) {
  const el = document.getElementById('dw-status');
  if (el) el.textContent = msg || '';
}

function setDwFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || '';
}

function clearDwValidation() {
  ['dw-err-base', 'dw-err-email', 'dw-err-type'].forEach(id => setDwFieldError(id, ''));
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));
}

function collectDwConfig() {
  const basePh = document.getElementById('dw-input-base')?.getAttribute('placeholder') || 'my_plugin';
  const namePh = document.getElementById('dw-input-name')?.getAttribute('placeholder') || basePh;
  const authorPh = document.getElementById('dw-input-author')?.getAttribute('placeholder') || 'Jan Ritt';
  const emailPh = document.getElementById('dw-input-email')?.getAttribute('placeholder') || 'jan@example.com';
  const urlPh = document.getElementById('dw-input-url')?.getAttribute('placeholder') || 'https://github.com/IxI-Enki';
  const descPh = document.getElementById('dw-input-desc')?.getAttribute('placeholder') || 'A DokuWiki plugin scaffold';

  return window.DokuWikiGenerator.normalizeConfig({
    plugin_base: fieldVal('dw-input-base', basePh),
    plugin_name: fieldVal('dw-input-name', namePh),
    author: fieldVal('dw-input-author', authorPh),
    email: fieldVal('dw-input-email', emailPh),
    url: fieldVal('dw-input-url', urlPh),
    desc: fieldVal('dw-input-desc', descPh),
    plugin_type: document.getElementById('dw-select-type')?.value || 'syntax',
    complexity: document.getElementById('dw-select-complexity')?.value || 'advanced',
    assets: {
      css: document.getElementById('dw-check-css')?.checked !== false,
      js: document.getElementById('dw-check-js')?.checked !== false,
      conf: document.getElementById('dw-check-conf')?.checked !== false,
      lang: document.getElementById('dw-check-lang')?.checked !== false
    }
  });
}

function validateDwForm() {
  clearDwValidation();
  const cfg = collectDwConfig();
  let ok = true;
  if (!cfg.plugin_base) {
    setDwFieldError('dw-err-base', 'Plugin base name is required.');
    ok = false;
  }
  if (!isValidEmail(cfg.email)) {
    setDwFieldError('dw-err-email', 'Enter a valid email address.');
    ok = false;
  }
  const validTypes = ['syntax', 'action', 'admin', 'helper'];
  if (validTypes.indexOf(cfg.plugin_type) < 0) {
    setDwFieldError('dw-err-type', 'Unsupported plugin type.');
    ok = false;
  }
  return ok ? cfg : null;
}

function showDwModal(files, pluginBase, title) {
  const modal = document.getElementById('generator-modal');
  const content = document.getElementById('modal-content');
  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = title || 'Generated DokuWiki Plugin Files';
  content.innerHTML = '';

  const bar = document.createElement('div');
  bar.style.display = 'flex';
  bar.style.justifyContent = 'flex-end';
  bar.style.gap = '0.5rem';
  bar.style.margin = '0 0 0.5rem 0';

  const dlAll = document.createElement('button');
  dlAll.className = 'mcp-btn';
  dlAll.textContent = 'Download ZIP';
  dlAll.addEventListener('click', async () => {
    try {
      if (!window.JSZip) throw new Error('JSZip not loaded');
      const zip = new JSZip();
      const dir = zip.folder(pluginBase);
      files.forEach(f => { dir.file(f.name, f.content); });
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = pluginBase + '.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDwStatus('ZIP download started.');
    } catch (e) {
      setDwStatus('ZIP download failed — try again or use individual file downloads.');
      console.error(e);
    }
  });
  bar.appendChild(dlAll);
  content.appendChild(bar);

  files.forEach(f => {
    const wrap = document.createElement('div');
    wrap.className = 'file-block';
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = f.name;
    const actions = document.createElement('div');
    actions.className = 'file-actions';
    const btnCopy = document.createElement('button');
    btnCopy.className = 'add-btn';
    btnCopy.textContent = 'Copy';
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(f.content);
        btnCopy.textContent = 'Copied';
        setTimeout(() => { btnCopy.textContent = 'Copy'; }, 1200);
      } catch (_) {}
    });
    const btnDl = document.createElement('button');
    btnDl.className = 'add-btn';
    btnDl.textContent = 'Download';
    btnDl.addEventListener('click', () => {
      const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = f.name.replace(/\//g, '_');
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    actions.appendChild(btnCopy);
    actions.appendChild(btnDl);
    const pre = document.createElement('pre');
    pre.className = 'code-block';
    pre.textContent = f.content;
    wrap.appendChild(name);
    wrap.appendChild(actions);
    wrap.appendChild(pre);
    content.appendChild(wrap);
  });

  document.getElementById('modal-close').onclick = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  };
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function updateDwAiButtons(connectorReady) {
  ['dw-btn-ai-desc', 'dw-btn-ai-preview', 'dw-btn-ai-deploy'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (connectorReady) {
      btn.classList.remove('is-disabled');
      btn.disabled = false;
    } else {
      btn.classList.add('is-disabled');
      btn.disabled = true;
    }
  });
  const hint = document.getElementById('dw-llm-hint');
  if (hint && !connectorReady) {
    hint.textContent = 'Lokale LLM-Instanz verbinden — AI buttons disabled until endpoint + model are saved.';
  }
}

function initDokuWikiWizard() {
  if (!window.DokuWikiGenerator || !window.LlmConnector) return;

  const cfg = window.LlmConnector.loadConfig();
  if (cfg.endpoint) document.getElementById('dw-llm-endpoint').value = cfg.endpoint;
  if (cfg.model) document.getElementById('dw-llm-model').value = cfg.model;
  if (cfg.key) document.getElementById('dw-llm-key').value = cfg.key;
  updateDwAiButtons(!!(cfg.endpoint && cfg.model));

  document.getElementById('dw-llm-preset')?.addEventListener('change', (e) => {
    const p = window.LlmConnector.PRESETS[e.target.value];
    if (p && p.endpoint) document.getElementById('dw-llm-endpoint').value = p.endpoint;
  });

  document.getElementById('dw-btn-llm-save')?.addEventListener('click', async () => {
    const connectorCfg = {
      endpoint: document.getElementById('dw-llm-endpoint').value.trim(),
      model: document.getElementById('dw-llm-model').value.trim(),
      key: document.getElementById('dw-llm-key').value.trim()
    };
    window.LlmConnector.saveConfig(connectorCfg);
    const reach = await window.LlmConnector.checkReachability(connectorCfg.endpoint, connectorCfg.key, { model: connectorCfg.model });
    updateDwAiButtons(!!(connectorCfg.endpoint && connectorCfg.model));
    setDwStatus(reach.ok ? 'Connector saved and reachable.' : ('Connector saved — ' + reach.status));
  });

  let aiPreviewContent = null;

  document.getElementById('dw-btn-ai-desc')?.addEventListener('click', async () => {
    const formCfg = collectDwConfig();
    setDwStatus('Improving description...');
    const result = await window.LlmConnector.improveDescription(formCfg.desc, formCfg.plugin_name);
    if (result.content) {
      document.getElementById('dw-input-desc').value = result.content.trim();
      setDwStatus('Description improved.');
    } else {
      setDwStatus('AI unavailable: ' + result.status);
    }
  });

  document.getElementById('dw-btn-ai-preview')?.addEventListener('click', async () => {
    const formCfg = collectDwConfig();
    setDwStatus('Generating code preview...');
    const result = await window.LlmConnector.previewCode(formCfg.plugin_type, formCfg.plugin_base, formCfg.plugin_name, formCfg.desc);
    const box = document.getElementById('dw-ai-preview');
    if (result.content) {
      aiPreviewContent = result.content;
      if (box) {
        box.style.display = 'block';
        box.textContent = result.content;
      }
      setDwStatus('Code preview ready (shown alongside deterministic scaffold).');
    } else {
      setDwStatus('AI preview unavailable: ' + result.status);
    }
  });

  document.getElementById('dw-btn-ai-deploy')?.addEventListener('click', async () => {
    const formCfg = collectDwConfig();
    setDwStatus('Generating deployment guide...');
    const result = await window.LlmConnector.generateDeployment(formCfg.plugin_base, formCfg.plugin_name);
    if (result.content) {
      showDwModal([{ name: 'DEPLOYMENT_GUIDE.md', content: result.content }], formCfg.plugin_base, 'Deployment Guide');
      setDwStatus('Deployment guide generated.');
    } else {
      setDwStatus('Deployment guide unavailable: ' + result.status);
    }
  });

  document.getElementById('dw-btn-generate')?.addEventListener('click', () => {
    const cfg = validateDwForm();
    if (!cfg) {
      setDwStatus('Fix validation errors before generating.');
      return;
    }
    let files = window.DokuWikiGenerator.buildPluginFiles(cfg);
    const replaceAi = document.getElementById('dw-check-ai-replace')?.checked;
    if (replaceAi && aiPreviewContent) {
      const type = cfg.plugin_type;
      files = files.map(f => (f.name === type + '.php' ? { name: f.name, content: aiPreviewContent.replace(/```php|```/g, '') } : f));
    } else if (aiPreviewContent) {
      files = files.concat([{ name: '_ai_preview.php.txt', content: aiPreviewContent }]);
    }
    showDwModal(files, cfg.plugin_base, 'Generated DokuWiki Plugin Files');
    setDwStatus('Plugin scaffold generated.');
  });
}
