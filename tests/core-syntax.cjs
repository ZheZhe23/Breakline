const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{assemble}=require('../tools/core-build-lib.cjs');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const name of ['fighters','sprites','audio','rules','lessons','game'])new vm.Script(read('core/src/'+name+'.js'),{filename:name+'.js'});
assert.equal(read('core/index.html'),assemble(),'illustrated build current');new vm.Script(read('core/index.html').match(/<script>([\s\S]*)<\/script>/)[1]);assert(!read('core/index.html').includes('window.__core'));assert(!read('core/index.html').includes('const CoreRig'));console.log('Illustrated build, syntax and release isolation OK');
