(()=>{
'use strict';
const logBox=document.getElementById('log');
let worker=null, timer=null;
function log(text){logBox.textContent+='\n'+text;globalThis.webkit?.messageHandlers?.nativeLog?.postMessage(text);}
function finish(){clearTimeout(timer);worker?.terminate();worker=null;document.getElementById('test').disabled=false;document.getElementById('stop').disabled=true;}
document.getElementById('stop').addEventListener('click',()=>{log('Stopped by user.');finish();});
document.getElementById('test').addEventListener('click',()=>{
 finish();logBox.textContent=new Date().toISOString()+'\n'+navigator.userAgent;
 log('Secure context: '+isSecureContext);
 log('Original Memory64 supported: '+WebAssembly.validate(Uint8Array.from([0,97,115,109,1,0,0,0,5,3,1,4,0])));
 log('Folder input property: '+('webkitdirectory' in document.createElement('input')));
 if(location.protocol==='file:'){log('BLOCKED: Serve this folder over HTTPS or localhost; do not open it as a Files preview.');return;}
 document.getElementById('test').disabled=true;document.getElementById('stop').disabled=false;
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;document.getElementById('stage').replaceChildren(canvas);
 try{
  if(!canvas.transferControlToOffscreen)throw Error('Canvas transfer is unavailable');
  worker=new Worker('runtime-worker.js');
  worker.onerror=e=>{log('FAIL: '+e.message);finish();};
  worker.onmessage=({data})=>{
   if(data.type==='log')log(data.line);
   if(data.type==='probeCapabilities')log('Worker capabilities: '+JSON.stringify(data.capabilities));
   if(data.type==='error'){log('FAIL: '+data.error);finish();}
   if(data.type==='probeDone'){log('PASS: '+data.constructors+' native constructors; JNI_OnLoad=0x'+data.jniVersion+'; memory='+data.memoryBytes+' bytes.\nNative initialization passed. Game rendering and content loading remain untested.');finish();}
  };
  const offscreen=canvas.transferControlToOffscreen();worker.postMessage({type:'bootProbe',canvas:offscreen},[offscreen]);
  timer=setTimeout(()=>log('Still waiting after 60 seconds. You can stop the test and save this log.'),60000);
 }catch(e){log('FAIL: '+e.message);finish();}
});
document.getElementById('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([logBox.textContent],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='khux-safari-diagnostic.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});

log("Diagnostic script loaded.");
})();
