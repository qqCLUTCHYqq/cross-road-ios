// Run from any directory: node scripts/test-close-probe.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.join(__dirname,'../CrossRoad/Web');
(async()=>{
 const mobile=fs.readFileSync(path.join(root,'mobile-runtime.js'),'utf8');
 const {MobilePointer}=await import('data:text/javascript;base64,'+Buffer.from(mobile.slice(mobile.indexOf('// The worker'),mobile.indexOf('// Document-lifetime owner'))).toString('base64'));
 function run(enabled){
  global.window=new EventTarget();global.document=new EventTarget();document.querySelector=()=>null;document.elementFromPoint=()=>canvas;global.PointerEvent=class{};
  const canvas=new EventTarget();Object.assign(canvas,{style:{},tagName:'CANVAS',id:'game',width:1280,height:720});
  let rect={left:20,top:80,width:400,height:225},captured=null,unlocks=0;
  canvas.getBoundingClientRect=()=>rect;canvas.hasPointerCapture=id=>captured===id;canvas.setPointerCapture=id=>captured=id;
  canvas.releasePointerCapture=id=>{captured=null;emit(canvas,'lostpointercapture',{pointerId:id})};
  let messages=[],logs=[];global.crossroadCloseProbe=enabled;global.safariLog=line=>logs.push(line);
  const adapter=new MobilePointer(canvas,m=>messages.push(m),()=>unlocks++);adapter.attach();
  function emit(target,type,props={}){const e=new Event(type,{cancelable:true});Object.assign(e,props);target.dispatchEvent(e);return e;}
  const tap={pointerId:10,pointerType:'touch',isPrimary:true,button:0,clientX:380,clientY:105};
  const down=(props={})=>emit(canvas,'pointerdown',{...tap,...props});const up=(props={})=>emit(window,'pointerup',{...tap,...props});
  // Stationary X-position tap is just a complete Begin/End, with no synthetic move.
  down();up();assert.deepEqual(messages.map(x=>x.kind),[1,3]);assert.equal(captured,null);if(enabled)assert.equal(messages.at(-1).closeProbe.captureBeforeRelease,true);
  // A different terminal DOM target alone does not change game coordinates.
  adapter.begin(40,{...tap,target:canvas});adapter.finish(40,{...tap,target:{tagName:'DIV',id:'stage'}});
  assert.equal(messages.at(-1).x,messages.at(-2).x);assert.equal(messages.at(-1).y,messages.at(-2).y);
  // Ordinary swipes still deliver every Move and a single End.
  down();for(let i=1;i<=4;i++)emit(canvas,'pointermove',{...tap,clientX:380-i*12});up({clientX:332});
  // Outside terminal coordinates retain the existing clamp, observable but not fixed.
  down();up({clientX:450,clientY:350});const outside=messages.at(-1);assert.equal(outside.x,1);assert.equal(outside.y,1);
  if(enabled)assert.equal(outside.closeProbe.clamped,true);
  // Geometry change across a contact is visible without altering conversion.
  down();rect={left:0,top:200,width:320,height:180};up();if(enabled)assert.equal(messages.at(-1).closeProbe.rectChanged,true);
  rect={left:20,top:80,width:400,height:225};
  // Terminal Touch Events fallback; later PointerEvent up remains suppressed.
  down();emit(canvas,'touchstart',{touches:[{identifier:91}],changedTouches:[{identifier:91}]});
  emit(window,'touchend',{changedTouches:[{identifier:91,clientX:380,clientY:105}]});const count=messages.length;up();assert.equal(messages.length,count);assert.equal(messages.at(-1).kind,3);
  // Cancel retains last point, and stale-contact recovery remains Cancel -> Begin.
  down();emit(window,'pointercancel',tap);assert.equal(messages.at(-1).kind,4);
  down();down({pointerId:11});assert.deepEqual(messages.slice(-3).map(x=>x.kind),[1,4,1]);
  emit(window,'blur');assert.equal(messages.at(-1).kind,4);
  down();emit(window,'orientationchange');assert.equal(messages.at(-1).kind,4);
  down();document.hidden=true;emit(document,'visibilitychange');document.hidden=false;
  emit(document,'crossroad-menu-state',{detail:{open:true}});const before=messages.length;down();up();assert.equal(messages.length,before);
  emit(document,'crossroad-menu-state',{detail:{open:false}});down();up();
  adapter.destroy();
  return {messages,logs,unlocks};
 }
 const off=run(false),on=run(true);assert.deepEqual(on.messages.map(({closeProbe,...m})=>m),off.messages);assert.equal(on.unlocks,off.unlocks);
 assert.ok(!off.logs.some(x=>x.startsWith('[touch probe')));assert.ok(on.logs.some(x=>x.includes('clamped=true')));assert.ok(on.logs.some(x=>x.includes('rectChanged=true')));
 console.log('PASS: enabled/disabled probes preserve exact touch messages, swipes, cancellation, capture release, stale recovery, menu blocking, orientation and terminal fallback.');
 const worker=fs.readFileSync(path.join(root,'runtime-worker.js'),'utf8');
 const helper=worker.slice(worker.indexOf('function crossroadCloseProbe'),worker.indexOf('\n}',worker.indexOf('function crossroadCloseProbe'))+2);
 let time=15,logs=[];const factory=vm.runInNewContext('('+helper+')',{performance:{timeOrigin:1000,now:()=>time}});const probe=factory(s=>logs.push(s));
 const m={closeProbe:{sentAt:1000,heldMs:50,moves:0},inputTrace:true,inputSequence:1};probe({...m,kind:1},8);probe({...m,kind:3},8);assert.ok(logs.at(-1).includes('framesSinceBegin=0'));
 probe({...m,kind:1},9);probe({...m,kind:3},12);assert.ok(logs.at(-1).includes('framesSinceBegin=3'));
 const n=logs.length;probe({kind:1},12);assert.equal(logs.length,n);factory(()=>{throw Error('log failure')})({...m,kind:1},1);
 // Execute the extracted native adapter with observed ABI arguments, without game code.
 const at=worker.indexOf('let ot=');const ot=worker.slice(at+'let ot='.length,worker.indexOf(',st=0',at));
 function native(enabled){const calls=[],dv=new DataView(new ArrayBuffer(32));const touch=vm.runInNewContext('('+ot+')',{tt:{},s(){},He:{},nt:{width:1280,height:720},L:()=>dv,rt:0,it:4,at:8,p:99,$e:'Java_org_cocos2dx_lib_Cocos2dxRenderer_nativeTouches',E:()=>11938700,q:(...args)=>calls.push(args)});
  for(const kind of [1,2,3,4])touch(kind,.95,.08,enabled?{sequence:1}:null);
  return {calls:JSON.parse(JSON.stringify(calls,(_,v)=>typeof v==='bigint'?v+'n':v)),bytes:[...new Uint8Array(dv.buffer)]};}
 assert.deepEqual(native(true),native(false));const nc=native(true).calls;assert.deepEqual(nc[0][1],[99,0,0]);assert.deepEqual(nc[0][2],[1216,57.6]);assert.deepEqual(nc[2][2],nc[0][2]);
 const diagnostics=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(root,'diagnostics.js'),'utf8')).toString('base64'));
 assert.ok(diagnostics.safeDiagnosticLines('[touch probe #1] native End id=0').includes('native End'));
 const created=[];global.document={createElement(tag){const el={tag,style:{},textContent:'',setAttribute(){},append(...xs){created.push(...xs)}};return el},visibilityState:'visible'};
 global.crossroadAudioDiagnostics=()=>null;global.setInterval=()=>0;global.crossroadCloseProbe=false;
 diagnostics.installDiagnosticExport({prepend(){}},()=> '');const toggle=created.find(x=>x.textContent==='Record Close-control traces');assert.ok(toggle);toggle.onclick();assert.equal(global.crossroadCloseProbe,true);toggle.onclick();assert.equal(global.crossroadCloseProbe,false);
 console.log('PASS: frame correlation, native scalar/array ABI arguments unchanged, opt-in toggle and diagnostic export filtering.');
})().catch(error=>{console.error(error);process.exitCode=1});
