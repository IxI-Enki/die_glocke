(function(){
  function createScribbles(rootId){
    var layer=document.getElementById(rootId||'occult-layer');
    if(!layer) return;
    // ASCII/Nerd-font safe symbols to avoid tofu boxes
    var symbols="*+%&Ψ∇℧℥⊙⊛⊚⋄⋇⌖⨀⨝αβδεζγκνιπφΩ";
    var count=100;
    for(var i=0;i<count;i++){
      var el=document.createElement('div');
      el.className='scribble';
      var text=symbols.charAt(Math.floor(Math.random()*symbols.length));
      el.textContent=text;
      el.style.left=Math.random()*100+'%';
      el.style.top=Math.random()*100+'%';
      el.style.animationDelay=Math.random()*5+'s';
      el.style.animation='scribble-float '+(3+Math.random()*4)+'s ease-in-out infinite';
      layer.appendChild(el);
      if(!document.getElementById('scribble-keyframes')){
        var style=document.createElement('style');
        style.id='scribble-keyframes';
        style.textContent='@keyframes scribble-float{0%,100%{transform:translate(0,0) rotate(0deg);opacity:0.2;}25%{transform:translate('+((Math.random()-0.5)*40)+'px,'+((Math.random()-0.5)*40)+'px) rotate('+Math.random()*360+'deg);opacity:0.8;}50%{transform:translate('+((Math.random()-0.5)*60)+'px,'+((Math.random()-0.5)*60)+'px) rotate('+Math.random()*360+'deg);opacity:0.6;}75%{transform:translate('+((Math.random()-0.5)*30)+'px,'+((Math.random()-0.5)*30)+'px) rotate('+Math.random()*360+'deg);opacity:0.9;}}';
        document.head.appendChild(style);
      }
    }
  }
  function createRings(){
    var root=document.getElementById('tool-bell');
    if(!root) return;
    for(var i=0;i<3;i++){
      var ring=document.createElement('div');
      ring.className='quantum-ring';
      ring.style.left='50%';
      ring.style.top='50%';
      ring.style.animationDelay=(i*1)+'s';
      root.appendChild(ring);
    }
  }
  function createParticles(){
    var root=document.getElementById('tool-bell');
    if(!root) return;
    for(var i=0;i<12;i++){
      var p=document.createElement('div');
      p.className='particle';
      p.style.left='50%';
      p.style.bottom='0';
      p.style.setProperty('--dx',((Math.random()-0.5)*80)+'px');
      p.style.animationDelay=(Math.random()*2)+'s';
      root.appendChild(p);
    }
  }
  function createCircuits(){
    var root=document.getElementById('tool-bell');
    if(!root) return;
    for(var i=0;i<6;i++){
      var line=document.createElement('div');
      line.className='circuit-line';
      var start=Math.random()*100;
      var length=30+Math.random()*50;
      var end=start+length;
      line.style.setProperty('--start',start+'%');
      line.style.setProperty('--length',length+'%');
      line.style.setProperty('--end',end+'%');
      line.style.top=(10+i*12)+'%';
      line.style.animationDelay=(Math.random()*2)+'s';
      root.appendChild(line);
    }
  }
  function createLightning(){
    var root=document.getElementById('tool-bell');
    if(!root) return;
    for(var i=0;i<4;i++){
      var l=document.createElement('div');
      l.className='lightning';
      l.style.left=(45+i*2)+'%';
      l.style.top='0';
      l.style.height=(60+Math.random()*40)+'px';
      l.style.animationDelay=(Math.random()*5)+'s';
      root.appendChild(l);
    }
  }
  document.addEventListener('DOMContentLoaded',function(){
    createScribbles('occult-layer');
    createScribbles('tool-occult');
    createRings();
    createParticles();
    createCircuits();
    createLightning();

    // Extra orbiters and center-burst around tool bell
    var bell=document.getElementById('tool-bell');
    if(bell){
      var orbitSymbols=['Ψ','∇','Ω','⊙','⊛','α','β','φ','*','+','~'];
      for(var i=0;i<14;i++){
        var o=document.createElement('div');
        o.className='orbiter';
        var s=document.createElement('span'); s.textContent=orbitSymbols[i % orbitSymbols.length];
        s.style.setProperty('--w', (2.6+Math.random()*2)+'s');
        s.style.setProperty('--ox', (Math.random()*3-1.5)+'px');
        s.style.setProperty('--oy', (Math.random()*3-1.5)+'px');
        o.appendChild(s);
        var radius=(40 + Math.random()*60);
        var duration=(6 + Math.random()*14);
        // Use JS-driven orbit for chaos
        (function(el,r,d){
          var t=Math.random()*Math.PI*2;
          function step(){ t+=0.008*(60/d); var x=Math.cos(t)*r; var y=Math.sin(t)*r; el.style.transform='translate(-50%,-50%) translate('+x+'px,'+y+'px)'; requestAnimationFrame(step); }
          step();
        })(o,radius,duration);
        bell.appendChild(o);
      }
      for(var p=0;p<36;p++){
        var pr=document.createElement('div'); pr.className='particle';
        pr.style.left='50%'; pr.style.top='50%';
        var angle=Math.random()*Math.PI*2; var r=60+Math.random()*120;
        pr.style.setProperty('--dx', Math.cos(angle)*r+'px');
        pr.style.setProperty('--dy', Math.sin(angle)*r+'px');
        pr.style.animationDelay=(Math.random()*2)+'s';
        bell.appendChild(pr);
      }
    }

    // Tools list toggle behavior
    var toolsList=document.getElementById('tools-list');
    if (toolsList){
      toolsList.addEventListener('click',function(e){
        var card=e.target.closest('[data-tool-id]');
        if(!card) return;
        var id=card.getAttribute('data-tool-id');
        var panelIdMap={ 'mcp-generator': 'tool-mcp-generator' };
        var panelId=panelIdMap[id];
        if(!panelId) return;
        var panel=document.getElementById(panelId);
        if(!panel) return;
        if(panel.classList.contains('hidden')){ panel.classList.remove('hidden'); }
        else { panel.classList.add('hidden'); }
      });
    }
  });
})();
