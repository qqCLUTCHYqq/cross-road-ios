import { installGameMenu } from './mobile-menu.js';

// The worker expects normalized coordinates and kinds 1/2/3/4 (begin/move/end/cancel).
export function gamePoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
  const width = canvas.width * scale, height = canvas.height * scale;
  const left = rect.left + (rect.width - width) / 2;
  const top = rect.top + (rect.height - height) / 2;
  return { x: Math.max(0, Math.min(1, (event.clientX - left) / width)),
    y: Math.max(0, Math.min(1, (event.clientY - top) / height)),
    inside: event.clientX >= left && event.clientX <= left + width && event.clientY >= top && event.clientY <= top + height };
}

export class MobilePointer {
  constructor(canvas, send, unlock) {
    this.canvas = canvas; this.post = send; this.unlock = unlock;
    this.active = null; this.last = null; this.handlers = [];
    this.sequence = 0; this.contact = null; this.traceMoves = 0;
  }
  trace(label, event) {
    const rect = this.canvas.getBoundingClientRect();
    const target = event?.target;
    const hit = event && Number.isFinite(event.clientX) ? document.elementFromPoint?.(event.clientX, event.clientY) : null;
    const name = node => node ? `${node.tagName || '?'}#${node.id || ''}` : '-';
    globalThis.safariLog?.(`[touch v12 #${this.sequence}] ${label} pointer=${event?.pointerId ?? '-'} active=${this.active ?? '-'} target=${name(target)} hit=${name(hit)} capture=${this.active !== null && !!this.canvas.hasPointerCapture?.(this.active)} rect=${[rect.left,rect.top,rect.width,rect.height].map(n=>Math.round(n)).join(',')}`);
  }
  listen(target, name, handler, options = { passive: false }) {
    target.addEventListener(name, handler, options);
    this.handlers.push(() => target.removeEventListener(name, handler, options));
  }
  emit(kind, event) {
    const point = event ? gamePoint(this.canvas, event) : this.last;
    if (!point) return;
    this.last = point;
    this.post({ type: 'input', kind, x: point.x, y: point.y, inputSequence: this.sequence,
      inputTrace: kind !== 2 || this.traceMoves++ === 0 });
  }
  begin(id, event) {
    if (this.blocked || document.querySelector('#mobile-menu[open]') || !gamePoint(this.canvas, event)?.inside) return;
    // A fresh primary down is also recovery from a missed release/interruption.
    if (this.active !== null) this.finish(this.active, null, 4);
    this.active = id;
    this.sequence++; this.traceMoves = 0;
    this.trace('BEGIN sent', event);
    // Audio must never prevent delivery of game input.
    try { this.unlock(); } catch (error) { console.warn('Audio unlock:', error); }
    this.emit(1, event);
  }
  finish(id, event, kind = 3) {
    if (this.active === null || this.active !== id) return;
    // Clear first: releasePointerCapture may synchronously report capture loss.
    this.active = null;
    this.emit(kind, event);
    this.contact = null;
    this.trace(kind === 3 ? 'END sent' : 'CANCEL sent', event);
    try { if (this.canvas.hasPointerCapture?.(id)) this.canvas.releasePointerCapture(id); } catch {}
  }
  attach() {
    this.canvas.style.touchAction = 'none';
    if (typeof PointerEvent !== 'undefined') {
      this.listen(this.canvas, 'pointerdown', event => {
        if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
        if (!gamePoint(this.canvas, event)?.inside) return;
        event.preventDefault(); this.begin(event.pointerId, event);
        try { if (this.active === event.pointerId) this.canvas.setPointerCapture(event.pointerId); } catch {}
      });
      this.listen(this.canvas, 'pointermove', event => {
        if (this.active !== event.pointerId) return;
        event.preventDefault(); this.emit(2, event);
      });
      // Capture-phase cleanup cannot be swallowed by a control/overlay handler.
      // Global cleanup must not cancel the default behavior of DOM controls.
      this.listen(window, 'pointerup', event => this.finish(event.pointerId, event), {capture:true,passive:true});
      this.listen(window, 'pointercancel', event => this.finish(event.pointerId, null, 4), {capture:true,passive:true});
      this.listen(this.canvas, 'lostpointercapture', event => this.finish(event.pointerId, null, 4));
      // Safari also reports the physical contact through Touch Events. Use only
      // its terminal event if Pointer Events failed to finish that same contact.
      // Never synthesize a second Begin or a second terminal event.
      this.listen(this.canvas, 'touchstart', event => {
        if (this.active !== null && event.touches.length === 1) this.contact = event.changedTouches[0]?.identifier ?? null;
      }, {capture:true,passive:true});
      for (const name of ['touchend','touchcancel']) this.listen(window, name, event => {
        const touch = Array.from(event.changedTouches).find(t => t.identifier === this.contact);
        if (this.active === null || !touch) return;
        this.trace(`${name} terminal fallback`, touch);
        this.finish(this.active, touch, name === 'touchend' ? 3 : 4);
      }, {capture:true,passive:true});
      for (const name of ['pointerdown','pointerup','pointercancel','lostpointercapture']) this.listen(window, name, event => {
        if (!document.querySelector('#mobile-menu[open]')) this.trace(`DOM ${name} primary=${event.isPrimary}`, event);
      }, {capture:true,passive:true});
    } else {
      this.listen(this.canvas, 'touchstart', event => {
        if (this.active !== null && event.touches?.length > 1) return;
        const touch = event.changedTouches[0];
        if (!touch || !gamePoint(this.canvas, touch)?.inside) return;
        event.preventDefault(); this.begin(touch.identifier, touch);
      });
      this.listen(this.canvas, 'touchmove', event => {
        const touch = Array.from(event.changedTouches).find(t => t.identifier === this.active);
        if (touch) { event.preventDefault(); this.emit(2, touch); }
      });
      for (const name of ['touchend', 'touchcancel']) this.listen(window, name, event => {
        const touch = Array.from(event.changedTouches).find(t => t.identifier === this.active);
        if (touch) this.finish(touch.identifier, touch, name === 'touchcancel' ? 4 : 3);
      }, {capture:true,passive:true});
    }
    this.listen(document, 'crossroad-menu-state', event => {
      this.finish(this.active, null, 4); this.blocked = !!event.detail?.open;
    });
    this.listen(document, 'pointerdown', event => {
      if (event.target !== this.canvas) this.finish(this.active, null, 4);
    }, {capture:true,passive:true});
    this.listen(window, 'orientationchange', () => this.finish(this.active, null, 4));
    this.listen(window, 'blur', () => this.finish(this.active, null, 4));
    this.listen(document, 'visibilitychange', () => { if (document.hidden) this.finish(this.active, null, 4); });
    this.listen(this.canvas, 'contextmenu', event => event.preventDefault());
    this.listen(this.canvas, 'wheel', event => {
      const point = gamePoint(this.canvas, event);
      if (!point?.inside) return;
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const factor = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? rect.height : 1;
      this.post({ type: 'wheel', x: point.x, y: point.y, dx: event.deltaX * factor / rect.width, dy: event.deltaY * factor / rect.height });
    });
  }
  destroy() { this.finish(this.active, null, 4); this.handlers.splice(0).forEach(remove => remove()); }
}

export function installMobileInterface(audio) {
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = new URL('./mobile-ui.css',import.meta.url).href;
  document.head.append(style);
  let unlocked = false;
  let pageAway = false;
  const menu = installGameMenu({afterRestart:()=>{if(unlocked)unlock();}});
  const button = menu.button;
  function layout() {
    const canvas = document.querySelector('#game'); if (!canvas) return;
    const viewport = window.visualViewport;
    const width = viewport?.width || document.documentElement.clientWidth || innerWidth;
    const height = viewport?.height || innerHeight;
    const stage = canvas.parentElement;
    const insets = getComputedStyle(stage);
    const left = parseFloat(insets.paddingLeft)||0, right = parseFloat(insets.paddingRight)||0;
    const top = parseFloat(insets.paddingTop)||0, bottom = parseFloat(insets.paddingBottom)||0;
    const box = fitGameViewport(width,height,canvas.width,canvas.height,{left,right,top,bottom});
    const root = document.documentElement.style;
    root.setProperty('--view-width',width+'px'); root.setProperty('--view-height',height+'px');
    root.setProperty('--view-left',(viewport?.offsetLeft||0)+'px'); root.setProperty('--view-top',(viewport?.offsetTop||0)+'px');
    root.setProperty('--game-width',box.width+'px'); root.setProperty('--canvas-height',box.height+'px');
    root.setProperty('--canvas-left',box.left+'px'); root.setProperty('--canvas-top',box.top+'px');
  }
  style.addEventListener('load',layout);
  function unlock() {
    if (document.hidden) return;
    pageAway=false; audio.setBackground(false,"user gesture");
    unlocked = true;
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
      const ctx = audio.open();
      if (ctx.state !== 'running') Promise.resolve(ctx.resume()).catch(error => console.warn('Tap again to resume audio:', error));
      // Prime the existing emulator graph synchronously inside the trusted gesture.
      const source = ctx.createBufferSource(); source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      source.connect(ctx.destination); source.onended = () => source.disconnect(); source.start();
    } catch (error) { console.warn('Audio unlock:', error); }
  }
  const gesture = event => {
    if (event.target.closest?.('#game,#start,#files,#mobile-controls')) unlock();
  };
  document.addEventListener('pointerdown', gesture, { capture:true, passive:true });
  document.addEventListener('touchend', gesture, { capture:true, passive:true });
  const ready = () => { document.body.classList.add('game-focused'); layout(); };
  document.addEventListener('crossroad-ready', ready);
  document.addEventListener('crossroad-stop', () => { document.body.classList.remove('game-focused'); layout(); });
  document.addEventListener('visibilitychange', () => {
    pageAway=document.hidden; audio.setBackground(document.hidden,"visibilitychange");
  });
  window.addEventListener('pagehide', () => { pageAway = true; audio.setBackground(true,"pagehide"); });
  window.addEventListener('pageshow', () => { pageAway = false; layout(); audio.setBackground(document.hidden,"pageshow"); });
  document.addEventListener('freeze', () => audio.setBackground(true,'freeze'));
  window.addEventListener('blur', () => audio.setBackground(true,'blur'));
  window.addEventListener('focus', () => {pageAway=false;audio.setBackground(document.hidden,'focus');});
  document.addEventListener('resume', () => {pageAway=false;audio.setBackground(document.hidden,'resume');});
  audio.setBackground(document.hidden);
  window.addEventListener('resize', layout); window.visualViewport?.addEventListener('resize', layout);
  window.visualViewport?.addEventListener('scroll', layout);
  window.addEventListener('orientationchange',()=>requestAnimationFrame(layout));
  document.addEventListener('fullscreenchange',layout);
  new MutationObserver(layout).observe(document.querySelector('#app'), { childList:true, subtree:true });
  layout();
}

// CSS sizing only. Never write the emulated canvas width/height.
export function fitGameViewport(width,height,nativeWidth,nativeHeight,insets={}) {
  const {left=0,right=0,top=0,bottom=0}=insets;
  const usableWidth=Math.max(1,width-left-right),usableHeight=Math.max(1,height-top-bottom);
  const scale=Math.min(usableWidth/nativeWidth,usableHeight/nativeHeight);
  const gameWidth=nativeWidth*scale,gameHeight=nativeHeight*scale;
  return {width:gameWidth,height:gameHeight,left:left+(usableWidth-gameWidth)/2,top:top+(usableHeight-gameHeight)/2};
}
