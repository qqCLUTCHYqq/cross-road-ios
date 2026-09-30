// Generated mirror of service-worker.js CACHE; scripts/check-build-identity.cjs --write.
export const DIAGNOSTIC_BUILD = 'v16 / cross-road-pwa-native-dispatch-v16';
const DIAGNOSTIC_VERSION = DIAGNOSTIC_BUILD.split(' / ')[0];
const DIAGNOSTIC_FILENAME = `CrossRoad-diagnostics-${DIAGNOSTIC_VERSION}.txt`;

// Export diagnostic categories only. Never inspect save records, file contents,
// cookies, URLs, authentication storage, or arbitrary application objects.
export function safeDiagnosticLines(text) {
  return String(text).split('\n').map(line => {
    if (!/^(\[touch(?: v12)?|\[audio lifecycle(?: v14)?|Audio timing:|OpenSL ES|PASS:|Runtime ready\.|R2 Content verified\.|\d+ game files loaded|Restored \d+ saved game files\.|Saved \d+ game files on this device\.|render loop:|file I\/O:|native(?:Init|Render|On|Set)|libpng warning:|save: the engine has loaded its save data)/.test(line)) return '[other log omitted for privacy]';
    return line.replace(/https?:\/\/\S+/gi,'[URL omitted]')
      .replace(/(?:[A-Z]:[\\/]|\/Users\/|\/home\/)\S+/gi,'[path omitted]')
      .replace(/\b(token|secret|password|authorization|cookie|api[_-]?key)\s*[:=]\s*\S+/gi,'$1=[redacted]');
  }).filter((line,i,lines)=>line!=='[other log omitted for privacy]' || lines[i-1]!==line).join('\n');
}

export function audioDiagnosticText() {
  const a=globalThis.crossroadAudioDiagnostics?.();
  if(!a)return 'Audio lifecycle: not initialized';
  return [`Build/cache: ${DIAGNOSTIC_BUILD}`,`Visibility: ${document.visibilityState}`,
    `AudioContext: ${a.context}; active: ${a.active}; background: ${a.background}`,
    `Waiting for user gesture: ${a.waitingForGesture}`,
    `Last suspend: ${a.lastSuspend}`,`Last resume attempt: ${a.lastResume}`,`Resume result: ${a.resumeResult}`,
    `Queued audio: ${a.queuedMs} ms; PCM sources: ${a.sources}; underruns: ${a.underruns}`,
    `Worker refill: epoch ${a.epoch}; request ${a.refillRequest}; pending ${a.refillPending}; reporter running ${a.reporterRunning}; timeouts ${a.refillTimeouts}`,
    `AudioContext replacements: ${a.contextReplacements}; return-tap refresh pending: ${a.gestureRefreshPending}`].join('\n');
}

export function diagnosticReport(logs) {
  const canvas = document.querySelector('#game');
  const rect = canvas?.getBoundingClientRect();
  return [
    'Cross Road diagnostic report', `Build/cache: ${DIAGNOSTIC_BUILD}`,
    `Time (UTC): ${new Date().toISOString()}`,
    `User agent: ${navigator.userAgent}`, `Platform: ${navigator.platform}`,
    `Visibility: ${document.visibilityState}; online: ${navigator.onLine}`,
    `Home Screen mode: ${!!navigator.standalone || matchMedia('(display-mode: standalone)').matches}`,
    `Runtime focused: ${document.body.classList.contains('game-focused')}; custom menu open: ${!!document.querySelector('#mobile-menu[open]')}`,
    `Canvas: ${canvas?.width ?? 0}x${canvas?.height ?? 0}; bounds: ${rect ? [rect.left,rect.top,rect.width,rect.height].map(Math.round).join(',') : 'absent'}`,
    `Service worker controlling page: ${!!navigator.serviceWorker?.controller}`,
    `IndexedDB available: ${typeof indexedDB !== 'undefined'}; save records NOT read or exported`,
    `Content status in retained logs: ${/R2 Content verified\./.test(logs) ? 'R2 verified' : /\d+ game files loaded/.test(logs) ? 'game files loaded (source not recorded in retained logs)' : 'not recorded'}`,
    `Save status in retained logs: ${/Saved \d+ game files on this device\./.test(logs) ? 'local write reported' : /Restored \d+ saved game files\./.test(logs) ? 'local files restored' : 'not recorded'}`,
    'Content, audio and save status: see runtime log below; no credentials or save contents included.',
    '', audioDiagnosticText(), '', 'Runtime log (sensitive/unrecognized lines omitted):', safeDiagnosticLines(logs)
  ].join('\n');
}

export function installDiagnosticExport(host, readDisplayedLogs) {
  const actions = document.createElement('div'); actions.className='mobile-menu-grid';
  const status = document.createElement('p'); status.setAttribute('role','status');
  status.textContent=`Diagnostic build ${DIAGNOSTIC_VERSION}. Reports exclude save contents and sensitive log lines.`;
  const copy = document.createElement('button'); copy.type='button'; copy.textContent='Copy Diagnostics';
  const share = document.createElement('button'); share.type='button'; share.textContent='Export Diagnostics';
  const download = report => {
    const url=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=DIAGNOSTIC_FILENAME;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    status.textContent='Diagnostic text file downloaded.';
  };
  copy.onclick=async()=>{
    const report=diagnosticReport(readDisplayedLogs());
    try {await navigator.clipboard.writeText(report);status.textContent='Diagnostics copied.';}
    catch {download(report);status.textContent='Clipboard unavailable; downloaded diagnostics instead.';}
  };
  share.onclick=async()=>{
    const report=diagnosticReport(readDisplayedLogs());
    const file=new File([report],DIAGNOSTIC_FILENAME,{type:'text/plain'});
    if(navigator.canShare?.({files:[file]})) {
      try {await navigator.share({files:[file],title:'Cross Road diagnostics'});status.textContent='Diagnostics shared.';return;}
      catch(error) {if(error.name==='AbortError'){status.textContent='Export cancelled.';return;}}
    }
    download(report);
  };
  const probe=document.createElement('button');probe.type='button';
  probe.textContent='Record Close-control traces';probe.setAttribute('aria-pressed','false');
  probe.onclick=()=>{
    globalThis.crossroadCloseProbe=!globalThis.crossroadCloseProbe;
    probe.setAttribute('aria-pressed',String(globalThis.crossroadCloseProbe));
    probe.textContent=globalThis.crossroadCloseProbe?'Stop Close-control traces':'Record Close-control traces';
    status.textContent=globalThis.crossroadCloseProbe?'Close probe 1 recording. Close this menu, tap a working Home control, then reproduce a failing X and export diagnostics. Input behavior is unchanged.':'Close probe 1 stopped. Existing traces remain available to export.';
    globalThis.safariLog?.('[touch probe] close-probe-1 '+(globalThis.crossroadCloseProbe?'enabled':'disabled'));
  };
  const live=document.createElement('pre');live.style.whiteSpace='pre-wrap';live.style.overflowWrap='anywhere';
  const update=()=>{live.textContent=audioDiagnosticText();};update();
  setInterval(()=>{if(!document.hidden)update();},1000);
  actions.append(copy,share,probe);host.prepend(actions,status,live);
}
