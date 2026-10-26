// 10s 30fps deterministic AI-vs-AI clip -> shots/detail_clip.mp4 (frames via manual stepping)
const {chromium}=require('playwright-core');const fs=require('fs');const {execSync}=require('child_process');
const SKIP=+(process.argv[2]||0);// seconds to fast-forward after intro (0 = include intro)
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome'});const p=await b.newPage({viewport:{width:960,height:640}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('file:///workspace/bubble-vs/index.html?mode=aivai&mute=1&manual=1&res=720');await p.waitForTimeout(1500);
const D='/tmp/clipf';fs.rmSync(D,{recursive:true,force:true});fs.mkdirSync(D);
if(SKIP)await p.evaluate(s=>{for(let i=0;i<s*30;i++)window.__game.step(1/30)},SKIP);
const c=await p.$('#c');
for(let f=0;f<300;f++){await p.evaluate(()=>{window.__game.step(1/30);window.__game.render();});
 await c.screenshot({path:D+'/f'+String(f).padStart(4,'0')+'.jpg',type:'jpeg',quality:90});}
await b.close();
execSync(`ffmpeg -y -loglevel error -framerate 30 -i ${D}/f%04d.jpg -vf scale=960:640 -c:v libx264 -pix_fmt yuv420p -crf 20 /workspace/bubble-vs/shots/detail_clip.mp4`);
console.log('errors:',JSON.stringify(errs));})();
