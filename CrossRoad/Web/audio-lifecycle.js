// Lifecycle only: the PCM scheduler, sample rates and refill target are unchanged.
export class AudioLifecycle {
  constructor(owner) {
    this.owner=owner; this.hidden=false; this.active=false; this.epoch=0;
    this.waiting=false; this.recovering=false; this.serial=0; this.timer=null;
    this.lastSuspend='none'; this.lastResume='none'; this.result='not started';
    this.replacements=0; this.gestureRefresh=false;
  }
  log(message) { globalThis.safariLog?.('[audio lifecycle] '+message); }
  invalidate() {
    this.serial++; clearTimeout(this.timer); this.timer=null; this.active=false;
    this.owner.queueReporter.stop(); this.owner.queueReporter.epoch=++this.epoch;
    this.owner.graph.resetPcm();
  }
  watch(ctx) {
    if(this.watched===ctx)return;
    this.watched=ctx;
    const original=this.owner.graph.onStateChange;
    ctx.onstatechange=()=>{
      if(this.owner.graph.ctx!==ctx)return;
      original();
      if(ctx.state!=='running' && this.active) {
        this.invalidate(); this.recovering=true; this.waiting=!this.hidden;
        this.result='context '+ctx.state+'; waiting for foreground gesture';
        this.log(this.result);
      }
    };
  }
  setBackground(hidden,reason='visibility') {
    if(hidden===this.hidden)return;
    this.hidden=hidden;
    this.invalidate(); this.recovering=true; this.waiting=!hidden;
    const ctx=this.owner.graph.ctx;
    if(hidden) {
      this.gestureRefresh=!!ctx;
      this.lastSuspend=reason+' @ '+new Date().toISOString();
      this.result='background'; this.log('paused: '+reason);
      // Never await this promise on return: WebKit can leave it unresolved.
      try { Promise.resolve(ctx?.suspend()).catch(()=>{}); } catch {}
    } else if(ctx) this.open(false,reason);
  }
  replace() {
    const owner=this.owner, graph=owner.graph, old=graph.ctx;
    this.invalidate();
    // Silence/disconnect the old graph before creating another one, even when
    // WebKit never resolves close(). The native mixer/save state stays alive.
    if(old)old.onstatechange=null;
    graph.stop(); graph.ctx=null; graph.lastAudioReport=0;
    try { Promise.resolve(old?.close()).catch(()=>{}); } catch {}
    this.savedFiles=[];
    const preserve=(node,key)=>{if(!node?.buffer)return;
      const offset=Math.max(0,(old?.currentTime??0)-(node._crossroadStarted??0));
      if(node.loop || offset<node.buffer.duration)this.savedFiles.push({buffer:node.buffer,loop:node.loop,offset,key});
      try{node.stop();node.disconnect();}catch{}
    };
    preserve(owner.musicNode,null);for(const [key,node] of owner.effects)preserve(node,key);
    owner.musicNode=null;owner.effects.clear();owner.generation++;
    this.watched=null; this.replacements++;this.gestureRefresh=false;this.recovering=false;
    this.log('recreated stale browser AudioContext');
  }
  open(gesture=false,reason='open') {
    const owner=this.owner;
    if(this.hidden)return owner.graph.ctx;
    if(this.active && owner.graph.running && !(gesture && this.gestureRefresh))return owner.graph.ctx;
    // A trusted tap must not queue resume behind an old pending suspend/resume.
    // Even a running clock can hide a stale iOS output route after app switching.
    // Renew the browser sink on the first return tap; subsequent taps reuse it.
    if(gesture && (this.recovering || this.gestureRefresh) && owner.graph.ctx)this.replace();
    const ctx=owner.graph.open(); this.watch(ctx);
    for(const item of this.savedFiles??[]) {
      const source=ctx.createBufferSource();source.buffer=item.buffer;source.loop=item.loop;
      const offset=item.loop?item.offset%item.buffer.duration:item.offset;
      source._crossroadStarted=ctx.currentTime-offset;source.connect(owner.graph.gain);source.start(0,offset);
      if(item.key===null)owner.musicNode=source;else owner.effects.set(item.key,source);
    }
    this.savedFiles=[];
    const serial=++this.serial; clearTimeout(this.timer);
    this.lastResume=reason+' @ '+new Date().toISOString();
    this.result='resume requested'; this.waiting=ctx.state!=='running';
    const finish=()=>{
      if(serial!==this.serial || this.hidden || owner.graph.ctx!==ctx)return;
      if(ctx.state!=='running') {this.waiting=true;this.result='waiting for user gesture ('+ctx.state+')';return;}
      this.active=true;this.waiting=false;this.result='running';
      owner.queueReporter.start();
      const clock=ctx.currentTime;
      this.timer=setTimeout(()=>{
        if(serial!==this.serial || this.hidden)return;
        if(ctx.state==='running' && ctx.currentTime>clock) {
          this.recovering=false;this.result='running; audio clock advancing';this.log(this.result);
        }else{
          this.invalidate();this.recovering=true;this.waiting=true;
          this.result='audio clock stalled; waiting for user gesture';this.log(this.result);
        }
      },350);
    };
    this.timer=setTimeout(()=>{
      if(serial!==this.serial || this.hidden)return;
      this.waiting=true;this.recovering=true;this.result='resume timed out; waiting for user gesture';this.log(this.result);
    },1200);
    try {
      if(ctx.state==='running'){clearTimeout(this.timer);finish();}
      else Promise.resolve(ctx.resume()).then(()=>{if(serial!==this.serial)return;clearTimeout(this.timer);finish();},()=>{
        if(serial!==this.serial)return;
        clearTimeout(this.timer);this.waiting=true;this.recovering=true;
        this.result='resume rejected; waiting for user gesture';this.log(this.result);
      });
    }catch{this.waiting=true;this.recovering=true;this.result='resume failed; waiting for user gesture';}
    return ctx;
  }
  reset() {
    this.replace(); this.recovering=false;this.waiting=false;this.result='stopped; next start uses fresh context';
  }
  snapshot() {
    const g=this.owner.graph, q=this.owner.queueReporter;
    return {context:g.ctx?.state??'not created',visibility:document.visibilityState,
      background:this.hidden,active:this.active,waitingForGesture:this.waiting,
      lastSuspend:this.lastSuspend,lastResume:this.lastResume,resumeResult:this.result,
      queuedMs:Math.round(g.queuedAhead()*1000),sources:g.pcmSources.size,
      underruns:g.underruns,epoch:this.epoch,refillPending:q.busy,
      refillRequest:q.request,refillTimeouts:q.timeouts,reporterRunning:!!q.timer,
      gestureRefreshPending:this.gestureRefresh,contextReplacements:this.replacements};
  }
}
