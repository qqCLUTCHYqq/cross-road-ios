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
  }
  listen(target, name, handler, options = { passive: false }) {
    target.addEventListener(name, handler, options);
    this.handlers.push(() => target.removeEventListener(name, handler, options));
  }
  emit(kind, event) {
    const point = event ? gamePoint(this.canvas, event) : this.last;
    if (!point) return;
    this.last = point;
    this.post({ type: 'input', kind, x: point.x, y: point.y });
  }
  begin(id, event) {
    if (this.active !== null || !gamePoint(this.canvas, event)?.inside) return;
    this.active = id;
    // Audio must never prevent delivery of game input.
    try { this.unlock(); } catch (error) { console.warn('Audio unlock:', error); }
    this.emit(1, event);
  }
  finish(id, event, kind = 3) {
    if (this.active === null || this.active !== id) return;
    this.emit(kind, event); this.active = null;
  }
  attach() {
    this.canvas.style.touchAction = 'none';
    if (typeof PointerEvent !== 'undefined') {
      this.listen(this.canvas, 'pointerdown', event => {
        if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
        if (!gamePoint(this.canvas, event)?.inside) return;
        event.preventDefault(); this.begin(event.pointerId, event);
        try { this.canvas.setPointerCapture(event.pointerId); } catch {}
      });
      this.listen(this.canvas, 'pointermove', event => {
        if (this.active !== event.pointerId) return;
        event.preventDefault(); this.emit(2, event);
      });
      this.listen(window, 'pointerup', event => {
        if (this.active === event.pointerId) { event.preventDefault(); this.finish(event.pointerId, event); }
      });
      this.listen(window, 'pointercancel', event => this.finish(event.pointerId, null, 4));
      this.listen(this.canvas, 'lostpointercapture', event => this.finish(event.pointerId, null, 4));
    } else {
      this.listen(this.canvas, 'touchstart', event => {
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
        if (touch) { event.preventDefault(); this.finish(touch.identifier, touch, name === 'touchcancel' ? 4 : 3); }
      });
    }
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
  const style = document.createElement('style');
  style.textContent = `
    html,html body { overflow:auto!important; height:auto!important; min-height:100dvh; }
    html body #app { overflow:visible!important; height:auto!important; min-height:100dvh; }
    html body #play-area,html body #play-area>.container { height:auto!important; }
    html body #stage { box-sizing:border-box; position:relative; width:100%!important; height:var(--game-height,100dvh)!important; display:flex!important; align-items:center!important; justify-content:center!important; background:#000!important; padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)!important; }
    html body #stage canvas#game { flex:none; width:var(--game-width)!important; height:var(--canvas-height)!important; max-width:none!important; max-height:none!important; object-fit:contain; touch-action:none; -webkit-user-select:none; user-select:none; }
    body.game-focused #play-area>.container>.actions,body.game-focused #panel,body.game-focused #app>.panel,body.game-focused #pwa-status,body.game-focused #fullscreen-exit { display:none!important; }
    #mobile-controls { position:fixed; z-index:10001; top:calc(env(safe-area-inset-top,0px) + 8px); right:calc(env(safe-area-inset-right,0px) + 8px); width:auto; padding:8px 12px; font:14px system-ui; opacity:.75!important; }
    #stage .aot-video-overlay { position:absolute; width:var(--game-width); height:var(--canvas-height); }
  `;
  document.head.append(style);
  let unlocked = false;
  const button = document.createElement('button');
  button.id = 'mobile-controls'; button.textContent = 'Controls'; button.hidden = true;
  button.setAttribute('aria-expanded', 'false'); document.body.append(button);
  function layout() {
    const canvas = document.querySelector('#game'); if (!canvas) return;
    const viewport = window.visualViewport;
    const width = Math.min(document.documentElement.clientWidth, viewport?.width || innerWidth);
    const height = viewport?.height || innerHeight;
    const insets = getComputedStyle(canvas.parentElement);
    const insetX = (parseFloat(insets.paddingLeft)||0) + (parseFloat(insets.paddingRight)||0);
    const insetY = (parseFloat(insets.paddingTop)||0) + (parseFloat(insets.paddingBottom)||0);
    const availableHeight = Math.max(1, height - insetY);
    const ratio = canvas.width / canvas.height;
    const gameWidth = Math.min(Math.max(1, width - insetX), availableHeight * ratio);
    const root = document.documentElement.style;
    root.setProperty('--game-width', gameWidth + 'px');
    root.setProperty('--canvas-height', gameWidth / ratio + 'px');
    root.setProperty('--game-height', height + 'px');
  }
  function unlock() {
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
  button.onclick = () => {
    const collapsed = document.body.classList.toggle('game-focused');
    button.textContent = collapsed ? 'Controls' : 'Hide controls';
    button.setAttribute('aria-expanded', String(!collapsed)); layout();
  };
  const ready = () => { document.body.classList.add('game-focused'); button.hidden = false; layout(); };
  document.addEventListener('crossroad-ready', ready);
  document.addEventListener('crossroad-stop', () => { document.body.classList.remove('game-focused'); button.hidden = true; });
  document.addEventListener('visibilitychange', () => {
    audio.resetTiming();
    if (!document.hidden && unlocked) { try { const ctx = audio.open(); Promise.resolve(ctx.resume()).catch(() => {}); } catch {} }
  });
  window.addEventListener('pageshow', () => { layout(); if (unlocked && !document.hidden) { try { Promise.resolve(audio.open().resume()).catch(() => {}); } catch {} } });
  window.addEventListener('resize', layout); window.visualViewport?.addEventListener('resize', layout);
  new MutationObserver(layout).observe(document.querySelector('#app'), { childList:true, subtree:true });
  layout();
}
