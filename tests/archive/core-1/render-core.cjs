'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=root+'/test-artifacts/core',frames=out+'/frames';fs.mkdirSync(frames,{recursive:true});
const html=fs.readFileSync(root+'/core/index.html','utf8').replace('// CORE_TEST_HOOK — tests inject access into an in-memory copy, never this release.','window.__core=code=>eval(code);');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});await page.addInitScript('window.requestAnimationFrame=()=>0');await page.route('http://localhost/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));await page.goto('http://localhost/core');
 const run=code=>page.evaluate(code=>window.__core(code),code);
 await run("$('start-overlay').hidden=true;game.reset(0);s.start=0;s.end=60000;s.nextEnemy=1e9;resize()");
 const inputs=[[0,'L'],[500,'L'],[1000,'L'],[2500,'L'],[3000,'L'],[3500,'H'],[5000,'L'],[5500,'H'],[6000,'L'],[6500,'H'],[8000,'S']];let cursor=0;
 for(let frame=0;frame<=285;frame++){const t=frame*1000/30;while(cursor<inputs.length&&inputs[cursor][0]<=t){const [at,key]=inputs[cursor++];await run(`game.step(${at});game.input('${key}',${at})`)}await run(`game.step(${t});render(${t});hud(${t})`);await page.screenshot({path:frames+'/'+String(frame).padStart(4,'0')+'.png'});}
 // A seven-frame contact sheet for every technique, not just terminal key poses.
 const sheet=await run(`(()=>{const sheet=document.createElement('canvas');sheet.width=7*240;sheet.height=8*220;const c=sheet.getContext('2d');let row=0;for(const [name,m]of Object.entries(CoreRig.moves)){const times=[0,m.impact*.48,m.impact,m.impact+65,m.impact+160,m.duration*.76,m.duration];for(let col=0;col<times.length;col++){const t=times[col];s.player.action={id:1,move:name,start:0,from:CoreRig.idle(0)};s.player.hit=null;s.enemy.hit=null;s.enemy.action=null;s.freeze=null;s.flash=0;s.player.dodge=null;s.particles=[];s.trails=[];s.level=1;render(t);c.drawImage(canvas,65,ground-215,265,220,col*240,row*220,240,200);c.fillStyle='#081416';c.fillRect(col*240,row*220+200,240,20);c.fillStyle='#bce6cd';c.font='11px monospace';c.fillText(name+' / '+Math.round(t)+'ms',col*240+8,row*220+214)}row++}return sheet.toDataURL('image/png').split(',')[1]})()`);
 fs.writeFileSync(out+'/contact-sheet.png',Buffer.from(sheet,'base64'));
 }finally{await browser.close()}
 for(const [name,filter]of [['combo-reel.mp4','setpts=PTS'],['combo-reel-slow.mp4','setpts=2*PTS']]){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','30','-i',frames+'/%04d.png','-vf',filter,'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',out+'/'+name],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr)}
 console.log('Saved 286-frame control reel (1x and 0.5x) and seven-frame sheets for eight techniques. Video is silent.');
})().catch(e=>{console.error(e);process.exitCode=1});
