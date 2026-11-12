const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=['rig','audio','rules','game'].map(n=>read(`core/src/${n}.js`)).join('\n');
if(source.includes('</script'))throw Error('Unsafe inline script');
fs.writeFileSync(path.join(root,'core/index.html'),read('core/template.html').replace('/* CORE_SCRIPT */',source));
console.log('Built standalone core/index.html');
