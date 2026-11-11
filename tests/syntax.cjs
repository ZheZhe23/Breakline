const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8');
new vm.Script(source.match(/<script>([\s\S]*)<\/script>/)[1],{filename:'index.html'});
const scripts=fs.readdirSync(__dirname).filter(name=>name.endsWith('.cjs'));
for(const name of scripts)new vm.Script(fs.readFileSync(path.join(__dirname,name),'utf8'),{filename:name});
console.log('Syntax OK: game and '+scripts.length+' verification scripts');
