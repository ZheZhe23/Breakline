const fs=require('node:fs'),path=require('node:path'),{assemble}=require('./core-build-lib.cjs');
const html=assemble();fs.writeFileSync(path.resolve(__dirname,'../core/index.html'),html);console.log('Built illustrated standalone CORE: '+Math.round(Buffer.byteLength(html)/1024)+' KiB');
