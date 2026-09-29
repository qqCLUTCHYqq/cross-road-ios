import { installDiagnosticExport } from './diagnostics.js';
// Presentation only: reuse the existing controls, save fields and their handlers.
// Owns the dialog/proxies, safariLog wrapper, log polling and panel observer for
// this document. Stop/Restart must retain these; see TECHNICAL.md for boundaries.
const gameMenuKey = Symbol.for('crossroad.game-menu');
export function installGameMenu({ afterRestart = () => {} } = {}) {
  if (document[gameMenuKey]) return document[gameMenuKey].api;
  const installation = document[gameMenuKey] = {};
  const app = document.querySelector('#app');
  const playArea = document.querySelector('#play-area');
  const button = document.createElement('button');
  button.id = 'mobile-controls'; button.type = 'button'; button.textContent = '⋯';
  button.setAttribute('aria-label', 'Open game menu');
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
  const sheet = document.createElement('dialog');
  sheet.id = 'mobile-menu'; sheet.setAttribute('aria-labelledby', 'mobile-menu-title');
  sheet.innerHTML = `<header class="mobile-menu-header"><button type="button" id="mobile-menu-back">‹ Menu</button><h2 id="mobile-menu-title">Cross Road</h2><button type="button" id="mobile-menu-close">Close</button></header>
  <div class="mobile-menu-scroll">
    <section data-view="home"><h3>Game</h3><div class="mobile-menu-grid" id="mobile-game-actions"></div>
      <h3>Save Data</h3><p class="mobile-hint">Game progress is stored locally by the game. Exporting a backup is optional and is not the normal save step.</p><div class="mobile-menu-grid"><button type="button" data-open="editor">Save Game Editor</button><button type="button" data-open="backup">Back Up / Restore Save</button></div>
      <h3>Settings / Advanced</h3><div class="mobile-menu-grid"><button type="button" data-open="advanced">Settings &amp; Content</button><button type="button" data-open="diagnostics">Diagnostics</button></div></section>
    <section data-view="editor"><p class="mobile-hint">This editor supports <b>Dark Road</b>. Load Dark Road first to enable its fields. Use <b>Write save file</b> after editing values; this is separate from normal game saving. The game continues running behind this sheet.</p><div id="mobile-editor-slot"></div></section>
    <section data-view="backup"><p class="mobile-hint">Your normal progress stays in this browser or Home Screen app. <b>Back Up / Export Save</b> downloads a separate backup. <b>Restore / Import Save</b> replaces local progress with a backup. Stop the game before using these controls.</p></section>
    <section data-view="advanced"><div id="mobile-speed-slot"></div><h3>Game Content</h3><div id="mobile-content-actions" class="mobile-menu-grid"></div><p class="mobile-hint">Normal launches load Content automatically. Local file controls are optional.</p></section>
    <div id="mobile-details-slot"></div>
    <section data-view="diagnostics"><p class="mobile-hint">Recent runtime messages. Opening this view does not restart the game.</p><pre id="mobile-diagnostics" tabindex="0" aria-label="Runtime diagnostics"></pre></section>
  </div>`;
  playArea.append(button, sheet);
  const title = sheet.querySelector('#mobile-menu-title');
  const back = sheet.querySelector('#mobile-menu-back');
  const close = sheet.querySelector('#mobile-menu-close');
  const scroll = sheet.querySelector('.mobile-menu-scroll');
  const titles = {home:'Cross Road',editor:'Save Game Editor',backup:'Back Up / Restore Save',advanced:'Settings / Advanced',diagnostics:'Diagnostics'};
  let view = 'home', restartRequested = false;
  const actions = [];
  const addAction = (host, label, find, dismiss = false) => {
    const proxy = document.createElement('button'); proxy.type = 'button'; proxy.textContent = label;
    proxy.onclick = () => { const original = find(); if (original && !original.disabled) { if(original.id==='start' && original.textContent.trim()==='Restart')restartRequested=true; original.click(); if(dismiss) hide(); queueMicrotask(sync); } };
    host.append(proxy); actions.push({proxy,find,label}); return proxy;
  };
  const gameActions = sheet.querySelector('#mobile-game-actions');
  const originalActions = () => Array.from(document.querySelectorAll('#play-area > .container > .actions button'));
  addAction(gameActions,'Full screen',()=>originalActions().find(node=>node.textContent.trim()==='Full screen'),true);
  const exit = document.createElement('button'); exit.type='button';exit.textContent='Exit full screen';
  exit.onclick=()=>{document.exitFullscreen?.();hide();};gameActions.append(exit);
  addAction(gameActions,'Restart',()=>document.querySelector('#start'),true);
  addAction(gameActions,'Stop game',()=>document.querySelector('#stop'));
  const launcher = document.createElement('a');launcher.href='./index.html';launcher.textContent='Return to launcher';gameActions.append(launcher);
  const contentActions=sheet.querySelector('#mobile-content-actions');
  addAction(contentActions,'Change Game Files',()=>document.querySelector('#reset'));
  addAction(contentActions,'Choose local Content folder',()=>document.querySelector('#files'));
  addAction(contentActions,'Clear Storage',()=>document.querySelector('#clear'));
  const messages = [];
  const baseLog = globalThis.safariLog;
  globalThis.safariLog = line => {
    baseLog?.(line);
    const text=String(line);
    if(text.startsWith('OpenSL ES output:') && messages.at(-1)?.startsWith('OpenSL ES output:')) messages[messages.length-1]=text;
    else { messages.push(text);if(messages.length>300)messages.shift(); }
  };
  const logView=sheet.querySelector('#mobile-diagnostics');
  installDiagnosticExport(logView.parentElement,()=>logView.textContent);
  function updateLog(){if(sheet.open && view==='diagnostics')setText(logView,messages.join('\n') || document.querySelector('#pwa-status')?.textContent || 'Waiting for runtime messages…');}
  installation.logInterval = setInterval(updateLog,1000);
  function setText(node,text){if(node.textContent!==text)node.textContent=text;}
  function sync() {
    // Moving whole stable panels inside the same Svelte root preserves all handlers
    // and dynamic anchors. Never clone fields, rewrite values, or move the canvas.
    const panel=document.querySelector('#panel');
    const editorSlot=sheet.querySelector('#mobile-editor-slot');
    if(panel && panel.parentElement!==editorSlot) {
      const speed=document.querySelector('#speed')?.closest('label');
      const heading=speed?.previousElementSibling;
      const speedSlot=sheet.querySelector('#mobile-speed-slot');
      if(heading?.tagName==='H2')speedSlot.append(heading);
      if(speed)speedSlot.append(speed);
      editorSlot.append(panel);
    }
    const extras=document.querySelector('#app .panel');
    const detailsSlot=sheet.querySelector('#mobile-details-slot');
    if(extras && extras.parentElement!==detailsSlot)detailsSlot.append(extras);
    detailsSlot.hidden = view!=='backup' && view!=='advanced';
    if(extras)for(const detail of extras.children) {
      const isBackup=detail.querySelector('summary')?.textContent.trim()==='Save backup';
      detail.hidden = view==='backup' ? !isBackup : isBackup;
      if(isBackup && view==='backup')detail.open=true;
    }
    if(extras)for(const control of extras.querySelectorAll('button')) {
      if(control.textContent.trim()==='Export save')setText(control,'Back Up / Export Save');
      if(control.textContent.trim()==='Import save')setText(control,'Restore / Import Save');
    }
    for(const {proxy,find,label} of actions) {
      const original=find();proxy.hidden=!original;proxy.disabled=!!original?.disabled;
      const text=original?.id==='start'?original.textContent.trim():original?.id==='clear'?original.textContent.trim():label;
      setText(proxy,text||label);
      if(label==='Full screen')proxy.hidden=!original||!document.fullscreenEnabled;
    }
    exit.hidden=!document.fullscreenElement;
    for(const row of document.querySelectorAll('#savefields .savefield')) {
      const label=row.querySelector('span')?.textContent;
      const group=row.closest('fieldset')?.querySelector('legend')?.textContent;
      for(const input of row.querySelectorAll('input'))if(!input.hasAttribute('aria-label'))input.setAttribute('aria-label',`${group}: ${label}${input.type==='checkbox'?' — keep value':''}`);
    }
  }
  function show(next='home') {
    document.dispatchEvent(new CustomEvent('crossroad-menu-state',{detail:{open:true}}));
    view=next;sheet.dataset.view=view;
    for(const section of sheet.querySelectorAll('[data-view]'))section.hidden=section.dataset.view!==view;
    setText(title,titles[view]);back.hidden=false;setText(back,view==='home'?'‹ Game':'‹ Back');
    sync();updateLog();
    if(!sheet.open)sheet.showModal();
    document.body.classList.add('mobile-menu-open');button.setAttribute('aria-expanded','true');
    scroll.scrollTop=0;(view==='home'?close:back).focus({preventScroll:true});
    if(view==='editor') { const refresh=document.querySelector('#saverefresh');if(refresh&&!refresh.disabled)refresh.click(); }
  }
  function hide(){sheet.close();}
  button.onclick=()=>show();back.onclick=()=>view==='home'?hide():show();close.onclick=hide;
  for(const item of sheet.querySelectorAll('[data-open]'))item.onclick=()=>show(item.dataset.open);
  sheet.addEventListener('close',()=>{document.body.classList.remove('mobile-menu-open');button.setAttribute('aria-expanded','false');document.dispatchEvent(new CustomEvent('crossroad-menu-state',{detail:{open:false}}));button.focus({preventScroll:true});});
  // Activate touch buttons on release, without relying on Safari's synthesized
  // mouse click after hover/layout changes. Leave inputs and scrolling native.
  let touchPress=null, lastActivation=null;
  sheet.addEventListener('pointerdown',event=>{
    const target=event.target.closest('button');
    touchPress=event.pointerType==='touch'&&target&&!target.disabled?{id:event.pointerId,target,x:event.clientX,y:event.clientY,scroll:scroll.scrollTop}:null;
  },{capture:true,passive:true});
  sheet.addEventListener('pointercancel',()=>{touchPress=null;},{capture:true,passive:true});
  sheet.addEventListener('pointerup',event=>{
    const press=touchPress;touchPress=null;
    if(!press||press.id!==event.pointerId||event.target.closest('button')!==press.target||Math.hypot(event.clientX-press.x,event.clientY-press.y)>10||Math.abs(scroll.scrollTop-press.scroll)>2)return;
    event.preventDefault();lastActivation={target:press.target,until:performance.now()+700};press.target.click();
  },{capture:true,passive:false});
  sheet.addEventListener('click',event=>{
    if(event.isTrusted&&lastActivation?.target===event.target.closest('button')&&performance.now()<lastActivation.until){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  sheet.addEventListener('click',event=>{if(event.target===sheet){const r=sheet.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)hide();}});
  document.addEventListener('fullscreenchange',sync);
  installation.observer = new MutationObserver(sync);
  installation.observer.observe(app,{childList:true,subtree:true});
  // Stop retains access to backup/import. No save operation is added to this UI.
  document.addEventListener('crossroad-stop',()=>{
    const restarting=restartRequested;restartRequested=false;
    queueMicrotask(()=>{sync();if(restarting)afterRestart();});
  });
  sync();return installation.api = {button,show,hide};
}
