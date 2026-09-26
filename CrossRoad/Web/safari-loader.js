'use strict';
const panel=document.createElement('details');panel.open=false;panel.hidden=true;
panel.style.cssText='position:relative;z-index:20;background:#152033;color:white;padding:14px;max-height:35vh;overflow:auto;font:14px system-ui';
const heading=document.createElement('summary');heading.textContent='Safari test — startup log (session-only game assets)';
const text=document.createElement('pre');text.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';panel.append(heading,text);document.body.prepend(panel);
globalThis.safariLog=line=>{globalThis.webkit?.messageHandlers?.nativeLog?.postMessage(String(line));text.textContent+=(String(line)+'\n');if(text.textContent.length>40000)text.textContent=text.textContent.slice(-30000);};
safariLog(navigator.userAgent);
globalThis.__createStandaloneWorker=()=>{
 const worker=new Worker(new URL('runtime-worker.js',document.baseURI));
 worker.addEventListener('message',({data})=>{if(data.type==='error')safariLog('FAIL: '+data.error);else if(data.type==='log')safariLog(data.line);else if(data.type==='ready')safariLog('PASS: first render-loop iteration completed');});
 worker.addEventListener('error',e=>safariLog('Worker error: '+e.message));return worker;
};
addEventListener('error',e=>safariLog('Page error: '+e.message));
addEventListener('unhandledrejection',e=>safariLog('Unhandled error: '+(e.reason?.stack||e.reason)));
