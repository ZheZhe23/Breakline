const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const f of ['core/src/rig.js','core/src/audio.js','core/src/game.js','core/src/rules.js','tools/build-core.cjs','tests/core-rules.cjs','tests/core-browser.cjs','tests/render-core.cjs'])new vm.Script(read(f),{filename:f});
const src=['rig','audio','rules','game'].map(n=>read(`core/src/${n}.js`)).join('\n');
assert.equal(read('core/index.html'),read('core/template.html').replace('/* CORE_SCRIPT */',src),'CORE build is current');
new vm.Script(read('core/index.html').match(/<script>([\s\S]*)<\/script>/)[1]);
assert(!read('core/index.html').includes('window.__core'),'test-only hook absent from release');
console.log('CORE syntax, deterministic build and release isolation: OK');
