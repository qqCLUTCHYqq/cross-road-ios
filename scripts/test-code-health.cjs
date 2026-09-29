// Dependency-free installer regression. Run: node scripts/test-code-health.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../CrossRoad/Web');
let elements=0,intervals=0,observers=0,observations=0,backgroundCalls=0,exportsInstalled=0;
class Target {
 constructor(){this.listeners=[];this.children=[];this.style={};this.classList={add(){},remove(){}};this.textContent='';this.nodes=new Map();}
 addEventListener(...args){this.listeners.push(args);}
 append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}
 setAttribute(){} querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Target());return this.nodes.get(selector);}
 querySelectorAll(){return [];}focus(){} close(){} showModal(){}
}
const app=new Target(),play=new Target(),doc=new Target(),win=new Target();doc.head=new Target();doc.body=new Target();doc.hidden=false;win.visualViewport=new Target();
doc.querySelector=s=>s==='#app'?app:s==='#play-area'?play:null;doc.createElement=()=>{elements++;return new Target();};
const sandbox={document:doc,window:win,URL,console,Symbol,navigator:{},setInterval(){return ++intervals;},MutationObserver:class{constructor(){observers++;}observe(){observations++;}},installDiagnosticExport(){exportsInstalled++;},requestAnimationFrame(){},queueMicrotask(){}};
vm.createContext(sandbox);
const menu=fs.readFileSync(path.join(root,'mobile-menu.js'),'utf8').replace(/^import .*\n/,'').replace('export function installGameMenu','function installGameMenu');
const mobile=fs.readFileSync(path.join(root,'mobile-runtime.js'),'utf8').replace(/^import .*\n/,'').replaceAll('export ','').replaceAll('import.meta.url',"'https://example.test/mobile-runtime.js'");
function load(){sandbox.installGameMenu=vm.runInContext('(function(){'+menu+';return installGameMenu;})()',sandbox);return vm.runInContext('(function(){'+mobile+';return installMobileInterface;})()',sandbox);}
const audio={setBackground(){backgroundCalls++;}};
const install=load();install(audio);const api=sandbox.installGameMenu();
const counts=()=>[elements,intervals,observers,observations,exportsInstalled,doc.listeners.length,win.listeners.length,win.visualViewport.listeners.length,doc.head.children.length,play.children.length,backgroundCalls];
const first=counts();assert.equal(intervals,1);assert.equal(observers,2);assert.equal(exportsInstalled,1);assert.equal(doc.head.children.length,1);assert.equal(play.children.length,2);
install({setBackground(){throw Error('duplicate audio owner');}});assert.equal(sandbox.installGameMenu(),api);assert.deepEqual(counts(),first);
// A second module evaluation in the same document must not duplicate ownership.
const again=load();again(audio);assert.equal(sandbox.installGameMenu(),api);assert.deepEqual(counts(),first);
assert.equal(doc.listeners.filter(x=>x[0]==='visibilitychange').length,1);
assert.equal(win.listeners.filter(x=>x[0]==='pagehide').length,1);
console.log('PASS: repeated installers/module evaluation preserve one UI, log wrapper, export install, observer pair and original lifecycle listener set.');
