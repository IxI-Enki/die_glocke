// Utilities
function show(el){ el.classList.remove('hidden'); el.setAttribute('aria-hidden','false'); }
function hide(el){ el.classList.add('hidden'); el.setAttribute('aria-hidden','true'); }

function setLoginMessage(msg, ok){
  const m=document.getElementById('login-message');
  m.textContent=msg;
  m.className=ok?'login-success':'login-error';
}

function clearLoginMessage(){
  const m=document.getElementById('login-message');
  m.textContent='';
  m.className='login-hint';
}

function toHex(buffer){
  const bytes=new Uint8Array(buffer);
  let hex='';
  for(let i=0;i<bytes.length;i++){ hex+=bytes[i].toString(16).padStart(2,'0'); }
  return hex;
}

async function sha256Hex(text){
  const enc=new TextEncoder();
  const data=enc.encode(text);
  const digest=await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

function constantTimeEqual(a,b){
  if(a.length!==b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++){ diff|=a.charCodeAt(i)^b.charCodeAt(i); }
  return diff===0;
}

function getObfuscatedReference(){
  const x=[63,52,49,51,96,46,105,126,46,15,126,105,40];
  return String.fromCharCode.apply(null, x.map(n=>n^0x5A));
}

async function getExpectedHash(){
  const key='PORTAL_CRED_SHA256';
  let h=''; try{ h=localStorage.getItem(key)||''; }catch(_){}
  if(h) return h;
  const ref=getObfuscatedReference();
  const digest=await sha256Hex(ref);
  try{ localStorage.setItem(key,digest); }catch(_){}
  return digest;
}

async function validateLogin(user,pass){
  if(!user||!pass) return false;
  const expected=await getExpectedHash();
  const provided=await sha256Hex(`${user}:${pass}`);
  return constantTimeEqual(provided, expected);
}

function triggerBrowserSave(username,password){
  try{
    const form=document.createElement('form');
    form.method='post'; form.action='.'; form.target='authSink'; form.style.display='none';
    form.setAttribute('name','portal-login-shadow');
    form.setAttribute('autocomplete','on');
    const u=document.createElement('input'); u.type='text'; u.name='username'; u.autocomplete='username'; u.value=username;
    const p=document.createElement('input'); p.type='password'; p.name='password'; p.autocomplete='current-password'; p.value=password;
    form.appendChild(u); form.appendChild(p);
    document.body.appendChild(form);
    form.submit();
    setTimeout(()=>{ try{ form.remove(); }catch(_){} },200);
  }catch(_){}
}

function completeLogin(){
  const portal=document.getElementById('portal-hero'); if(portal) hide(portal);
  hide(document.getElementById('login-screen'));
  show(document.getElementById('app-root'));
}

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
  // Login UI
  const loginForm=document.getElementById('login-form');
  const inputUser=document.getElementById('login-username');
  const inputPass=document.getElementById('login-password');
  // Strengthen hints for password managers
  loginForm.setAttribute('name','portal-login');
  loginForm.setAttribute('autocomplete','on');
  inputUser.setAttribute('name','username'); inputUser.setAttribute('autocomplete','username');
  inputPass.setAttribute('name','password'); inputPass.setAttribute('autocomplete','current-password');

  loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    clearLoginMessage();
    const u=inputUser.value.trim();
    const p=inputPass.value;
    const ok=await validateLogin(u,p);
    if(ok){
      try{ if(navigator.credentials && window.PasswordCredential && navigator.credentials.store){ const cred=new PasswordCredential({id:u,name:u,password:p}); await navigator.credentials.store(cred);} }catch(_){ }
      triggerBrowserSave(u,p);
      completeLogin();
    }else{
      setLoginMessage('Invalid credentials.', false);
    }
  });

  let loginVisible=false;
  document.addEventListener('keydown',(e)=>{
    const key=(e.key||'').toLowerCase();
    const hasAltGr=e.getModifierState && e.getModifierState('AltGraph');
    const hasAlt=e.altKey||hasAltGr;
    const isOeLike=(key==='ö'||key==='ø'||key===';'||e.keyCode===186);
    if((e.ctrlKey||hasAltGr) && e.shiftKey && hasAlt && isOeLike){
      e.preventDefault();
      loginVisible=!loginVisible;
      const login=document.getElementById('login-screen');
      if(loginVisible){ show(login); } else { hide(login); }
      clearLoginMessage();
    }
  });

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

    const serverNameSafe=svc.toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
    const serverPyName=`${serverNameSafe}_server.py`;

    const requirements=(deps?deps.split(/\s+/).join('\n'):'mcp[cli]>=1.2.0\nhttpx').trim();

    const dockerfile=`FROM ${docker.base}\nWORKDIR ${docker.workdir}\nENV PYTHONUNBUFFERED=1\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY ${serverPyName} .\nRUN useradd -m -u ${docker.uid||'1000'} ${docker.uname||'mcpuser'} \\n && chown -R ${docker.uname||'mcpuser'}:${docker.uname||'mcpuser'} ${docker.workdir}\nUSER ${docker.uname||'mcpuser'}\nCMD [\"python\", \"${serverPyName}\"]\n`;

    const pyTools=tools.map(t=>{
      const params=(t.params||'').split(',').map(s=>s.trim()).filter(Boolean);
      const sig=params.map(p=>`${p}: str = ${adv.emptyDefaults?'\"\"':'""'}`).join(', ');
      const doc=(t.desc||'Tool').replace(/\n/g, adv.oneLine?' ':'\n').replace(/\"/g,'\\\"');
      return `@mcp.tool()\nasync def ${t.name||'tool'}(${sig}):\n    \"\"\"${doc}\"\"\"\n    try:\n        return f\"${output.emojis.ok||'✅'} ${t.name||'tool'} executed\"\n    except Exception as e:\n        return f\"${output.emojis.err||'❌'} Error: {str(e)}\"\n`;
    }).join('\n');

    const secretLine=(auth.embed&&auth.secret)?`\nAPI_TOKEN = os.environ.get(\"${auth.secret.toUpperCase()}\", \"\")`:'';
    const healthTool=adv.hc?`\n@mcp.tool()\nasync def health():\n    \"\"\"Simple health check tool\"\"\"\n    return \"${output.emojis.ok||'✅'} ok\"\n`:'';
    const metricsTool=adv.metrics?`\n@mcp.tool()\nasync def metrics():\n    \"\"\"Simple metrics tool\"\"\"\n    return \"${output.emojis.info||'ℹ️'} metrics: none\"\n`:'';

    const serverPy=`#!/usr/bin/env python3\n\n\"\"\"${svc} MCP Server - ${desc}\"\"\"\nimport os, sys, logging, httpx\nfrom datetime import datetime, timezone\nfrom mcp.server.fastmcp import FastMCP\nlogging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', stream=sys.stderr)\nlogger = logging.getLogger(\"${serverNameSafe}-server\")\nmcp = FastMCP(\"${svc}\")${secretLine}\n${pyTools||''}${healthTool}${metricsTool}\nif __name__ == \"__main__\":\n    logger.info(\"Starting ${svc} MCP server...\")\n    try:\n        mcp.run(transport='stdio')\n    except Exception as e:\n        logger.error(f\"Server error: {e}\", exc_info=True)\n        sys.exit(1)\n`;

    const claudeMd=`# CLAUDE.md\n\nFollow MCP generation rules from GLOCKE.md.\n- No @mcp.prompt decorators\n- No prompt param to FastMCP()\n- Single-line docstrings\n- Empty string defaults for params\n- Return strings; log to stderr\n- Docker non-root user\n`;
    const installMd=`# INSTALLATION\n\n1. Save files locally\n2. docker build -t ${serverNameSafe}-mcp-server .\n3. Optionally set secrets via Docker Desktop (mcp secrets)\n4. Configure catalog/registry (see YAML files if included)\n5. Run via MCP Gateway (stdio)\n`;
    const catalogYaml=`version: 2\nname: custom\ndisplayName: Custom MCP Servers\nregistry:\n  ${serverNameSafe}:\n    description: \"${desc}\"\n    title: \"${svc}\"\n    type: server\n    dateAdded: \"${new Date().toISOString()}\"\n    image: ${serverNameSafe}-mcp-server:latest\n    ref: \"\"\n    readme: \"\"\n    toolsUrl: \"\"\n    source: \"\"\n    upstream: \"\"\n    icon: \"\"\n    tools:${tools.map(t=>`\n      - name: ${t.name||'tool'}`).join('')}\n`;
    const registryYaml=`registry:\n  ${serverNameSafe}:\n    ref: \"\"\n`;
    const readmeTxt=`Create the files listed and build the Docker image. See instructions in GLOCKE.md. Author: ${author}`;
    const readme=`# ${svc} MCP Server\n\n${desc||''}\n\n## Author\n${author}\n\n## Category\n${category}\n\n## Tools\n${tools.map(t=>`- ${t.name}: ${t.desc}`).join('\n')}\n\n## APIs\n${apis.map(a=>`- ${a.name} (${a.url})`).join('\n')}\n`;

    const files=[
      {name:'Dockerfile', content:dockerfile},
      {name:'requirements.txt', content:requirements+'\n'},
      {name:serverPyName, content:serverPy},
      {name:'README.md', content:readme},
      {name:'readme.txt', content:readmeTxt+'\n'},
      {name:'CLAUDE.md', content:claudeMd}
    ];
    if(promptText){ files.push({name:'GLOCKE.md', content:promptText}); }
    if(output.includeInstall){ files.push({name:'INSTALL.md', content:installMd}); }
    if(output.includeCatalog){ files.push({name:'catalog.yaml', content:catalogYaml}); files.push({name:'registry.yaml', content:registryYaml}); }

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
});
