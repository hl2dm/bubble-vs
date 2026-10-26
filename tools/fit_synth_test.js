// usage: NODE_PATH=/tmp/pw/node_modules node tools/fit_synth_test.js
// Stress-tests drawImgContain/cutin aspect-preservation with synthetic extreme-aspect
// images (very wide, very tall) swapped in for the real art at runtime (no files
// written to art/) -- a perfect circle stays a circle if contain-fit is correct,
// an ellipse if the code ever stretches instead.
const {chromium}=require('playwright-core');const F='file:///workspace/bubble-vs/index.html';
function mkImg(w,h){
 return `(()=>{const c=document.createElement('canvas');c.width=${w};c.height=${h};const x=c.getContext('2d');
  x.fillStyle='#222';x.fillRect(0,0,${w},${h});
  x.strokeStyle='#0f0';x.lineWidth=4;x.strokeRect(2,2,${w}-4,${h}-4);
  const r=Math.min(${w},${h})*0.42;x.beginPath();x.arc(${w}/2,${h}/2,r,0,7);x.fillStyle='#f0f';x.fill();x.strokeStyle='#fff';x.lineWidth=3;x.stroke();
  x.strokeStyle='#ff0';x.lineWidth=2;x.beginPath();x.moveTo(${w}/2,0);x.lineTo(${w}/2,${h});x.moveTo(0,${h}/2);x.lineTo(${w},${h}/2);x.stroke();
  return c.toDataURL();})()`;
}
const WIDE=mkImg(900,90),TALL=mkImg(90,900);
async function swap(p,key,dataUrlExpr){
 await p.evaluate(({key,dataUrlExpr})=>{const url=eval(dataUrlExpr);return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{try{ART[key]={el:im,ok:true};res();}catch(e){rej(e);}};im.onerror=rej;im.src=url;});},{key,dataUrlExpr});
}
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:960,height:640}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const S=n=>p.screenshot({path:`/workspace/bubble-vs/shots/synth_${n}.png`});

// 1) title screen char_full portraits -> wide + tall
await p.goto(F+'?mute=1');await p.waitForTimeout(500);
await swap(p,'char_full_0',WIDE);await swap(p,'char_full_1',TALL);
await p.evaluate(()=>window.__game.render());await S('01_title');

// 2) char select -> wide + tall
await p.keyboard.press('Enter');await p.waitForTimeout(150);
await p.evaluate(()=>window.__game.render());await S('02_charselect');

// 3) in-board stand -> wide + tall (swap stand_*_normal for both sides)
await p.goto(F+'?mode=aivai&mute=1');await p.waitForTimeout(400);
await swap(p,'stand_0_normal',WIDE);await swap(p,'stand_1_normal',TALL);
await p.evaluate(()=>{window.__game.step(1/60);window.__game.render();});await S('03_stand');

// 4) skill cut-in (v4 path) -> wide + tall
await swap(p,'cutin4_0',WIDE);await swap(p,'cutin4_1',TALL);
await p.evaluate(()=>{const G=window.__game,[L,R]=G.players;L.meter=100;L.useSkill(R);for(let i=0;i<14;i++)G.step(1/60);G.render();});await S('04_cutin_left_wide');
await p.evaluate(()=>{const G=window.__game;for(let i=0;i<100;i++)G.step(1/60);const[L,R]=G.players;R.meter=100;R.useSkill(L);for(let i=0;i<14;i++)G.step(1/60);G.render();});await S('05_cutin_right_tall');

console.log('errors:',JSON.stringify(errs));await b.close();})();
