const fs=require('fs'),vm=require('vm'),assert=require('assert');
const bytes=Uint8Array.from({length:10*1024*1024+17},(_,i)=>(i*13+7)%256);let requests=0,fail=false;
class XHR {open(method,url,sync){assert.equal(method,'GET');assert.equal(sync,false);this.url=new URL(url)}send(){requests++;this.status=fail?500:200;const start=Number(this.url.searchParams.get('offset')),count=Number(this.url.searchParams.get('length'));this.response=bytes.slice(start,start+count).buffer;}}
const context={URL,XMLHttpRequest:XHR,Uint8Array,ArrayBuffer,self:{location:{href:'http://127.0.0.1:18761/token/runtime-worker.js'}}};vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../CrossRoad/Web/native-files.js'),'utf8'),context);
const source=vm.runInContext(`nativeFileSource({id:'0',name:'main.obb',webkitRelativePath:'Content/main.obb',size:${bytes.length}})`,context);
for(const [start,count] of [[0,1],[262140,20],[bytes.length-5,50],[bytes.length,5],[1,0],[100,100]])assert.deepEqual(source.read(start,count),bytes.slice(start,count>0?Math.min(bytes.length,start+count):bytes.length));
const before=requests;source.read(100,100);assert.equal(requests,before,'cached read should avoid a request');
assert(vm.runInContext('nativeBlockCache.size',context)<=32,'cache is bounded');
assert.throws(()=>source.read(-1,10));fail=true;vm.runInContext('nativeBlockCache.clear()',context);assert.throws(()=>source.read(9*1024*1024,10),/Native file read failed/);
console.log('Native ranged adapter passed: block boundaries, EOF, full remainder, caching, eviction bound, bad offset, HTTP failure.');


