// Reproduce browser callback re-entry during a synchronous native Content read.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../CrossRoad/Web/runtime-worker.js'),'utf8');
const helper=source.slice(source.indexOf('function crossroadSerialNativeDispatch'),source.indexOf('// Opt-in Close-control probe'));
const make=vm.runInNewContext('('+helper.trim()+')');
const logs=[],order=[],dispatch=make(line=>logs.push(line));
dispatch('input',()=>{
  order.push('begin');
  dispatch('frame',()=>{order.push('frame');dispatch('input',()=>order.push('end'));});
  dispatch('audioStatus',()=>order.push('audio'));
  order.push('return');
});
assert.deepEqual(order,['begin','return','frame','audio','end']);
let immediate=false;dispatch('input',()=>immediate=true);assert.equal(immediate,true);
assert.equal(logs.length,3);
assert.throws(()=>dispatch('error',()=>{throw Error('expected')}),/expected/);
dispatch('input',()=>order.push('recovered'));assert.equal(order.at(-1),'recovered');
const brokenLog=make(()=>{throw Error('diagnostics must not drop input')});
brokenLog('input',()=>brokenLog('input',()=>order.push('still delivered')));
assert.equal(order.at(-1),'still delivered');

// Execute the actual worker callback wiring, not a parallel implementation.
const start=source.indexOf('const nativeDispatch=crossroadSerialNativeDispatch($);');
const end=source.indexOf('),v(y)}catch(e){n&&$',start)+'),v(y)'.length;
assert.ok(start>0&&end>start);
const frames=[],calls=[],messages=[],trace=[];let inTouch=false,inject=true;
const Z={requestAnimationFrame:cb=>frames.push(cb)};
const n={ioStats:{reads:0,bytes:0},
  deliverObbCallbacks(){},deliverVideoCallbacks(){},deliverWebViewCallbacks(){},
  advanceClock(){},saveLocked:()=>false,tickSound(){},runThread(){},
  render(){assert.equal(inTouch,false,'render re-entered native touch');calls.push('render')},
  saveReady:()=>false,flush(){},
  touch(kind,x,y){
    assert.equal(inTouch,false);inTouch=true;calls.push('touch'+kind+' begin');
    if(inject){inject=false;frames.shift()();
      Z.onmessage({data:{type:'audioStatus',queued:.24,measuredAt:100,epoch:4,request:8}});
      Z.onmessage({data:{type:'input',kind:3,x,y,inputSequence:1,inputTrace:true}});
    }
    calls.push('touch'+kind+' return');inTouch=false;
  },
  refillAudio(queued){assert.equal(inTouch,false);assert.equal(queued,.24);calls.push('audio')}
};
const context={Z,n,t:{speed:1,steps:1},f:0,r:null,i:[],a:[],o:null,s:0,
  pt:x=>x,mt:x=>x,performance:{now:()=>100,timeOrigin:0},
  crossroadSerialNativeDispatch:make,crossroadCloseProbe:()=>()=>{},
  $:line=>trace.push(line),Q:m=>messages.push(m),ft:e=>{throw e},
  crossroadAudioEpoch:0,crossroadAudioRequest:0};
vm.runInNewContext(source.slice(start,end),context);
Z.onmessage({data:{type:'input',kind:1,x:.73,y:.05,inputSequence:1,inputTrace:true}});
assert.deepEqual(calls,['touch1 begin','touch1 return','render','audio','touch3 begin','touch3 return']);
assert.ok(trace.some(line=>line.includes('native returned kind=1; frame=1;')));
assert.ok(trace.some(line=>line.includes('native returned kind=3; frame=2;')));
assert.equal(messages.filter(m=>m.kind==='queueAck').length,1);
assert.equal(frames.length,1,'exactly one subsequent frame scheduled');
Z.onmessage({data:{type:'input',kind:1,x:.2,y:.3,inputSequence:2,inputTrace:true}});
assert.equal(calls.at(-1),'touch1 return','normal input remains synchronous');
console.log('PASS: native callbacks serialize reentrant frames/messages, preserve FIFO input and audio acknowledgment, and leave ordinary synchronous delivery unchanged.');
