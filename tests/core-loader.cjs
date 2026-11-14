'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../core/src/sprites.js'),'utf8').replace('/* CORE_ASSET_DATA */{}',JSON.stringify({hero:{url:'data:test'}}));
const images=[],timers=new Map();let clock=0,checks=0;class FakeImage{constructor(){images.push(this)}set src(v){this.value=v;if(v==='throw')throw Error('decode error')}}
const env={Image:FakeImage,setTimeout:f=>{const id=++clock;timers.set(id,f);return id},clearTimeout:id=>timers.delete(id)};vm.createContext(env);vm.runInContext(source+';this.S=CoreSprites',env);const {S}=env;const ok=(v,m)=>{checks++;assert.ok(v,m)};
(async()=>{
 await assert.rejects(S.load('missing'));checks++;ok(S.diagnostics().pending===0,'unknown resource does not poison pending cache');
 const pending=S.load('hero'),oldLoad=images[0].onload;const timeout=[...timers.values()][0];timeout();await assert.rejects(pending);checks++;ok(S.diagnostics().pending===0&&!S.ready('hero'),'timeout evicts pending and leaves retry possible');
 const retry=S.load('hero');const image=images[1];image.onload();await retry;oldLoad();ok(S.image('hero')===image,'late callback cannot overwrite successful retry');ok(timers.size===0,'decode timers cleaned');S.retain([]);ok(!S.ready('hero'),'retention releases decoded image');
 S.assets.hero.url='throw';await assert.rejects(S.load('hero'));checks++;ok(S.diagnostics().pending===0&&timers.size===0,'synchronous decode errors cleaned');S.assets.hero.url='data:test';const fail=S.load('hero');images.at(-1).onerror();await assert.rejects(fail);checks++;ok(S.diagnostics().pending===0,'ordinary errors allow retry');
 const root=require('node:path').resolve(__dirname,'..'),out=root+'/test-artifacts/roster';fs.mkdirSync(out,{recursive:true});const report={coreSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(root+'/core/index.html')).digest('hex'),checks,kind:'fake Image/timer boundary tests, not real timeout waiting'};fs.writeFileSync(out+'/loader.json',JSON.stringify(report,null,2));console.log('Loader recovery checks:',checks);
})().catch(e=>{console.error(e);process.exitCode=1});
