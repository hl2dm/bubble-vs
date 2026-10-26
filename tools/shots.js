// usage: NODE_PATH=/tmp/pw/node_modules node tools/shots.js
const {chromium}=require('playwright-core');const F='file:///workspace/bubble-vs/index.html';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:960,height:640}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const S=n=>p.screenshot({path:'/workspace/bubble-vs/shots/'+n+'.png'});
await p.goto(F+'?mute=1');await p.waitForTimeout(600);await S('01_title');await S('v4_title');await S('v5_title');
await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(400);await S('02_guide');
await p.goto(F+'?mode=aivai&mute=1');await p.evaluate(()=>{for(let i=0;i<60*25;i++)window.__game.step(1/60)});await p.waitForTimeout(300);await S('03_midmatch');await S('v4_midmatch');await S('v5_midmatch');
await p.evaluate(()=>{const G=window.__game,[L,R]=G.players;L.meter=100;L.useSkill(R);for(let i=0;i<14;i++)G.step(1/60);G.render()});await S('04_skill_cutin');await S('v4_skill_cutin');await S('v5_skill_cutin');
await p.evaluate(()=>{const G=window.__game;let n=0;while(G.state!=='over'&&n<60*1200){G.step(1/60);n++}for(let i=0;i<40;i++)G.step(1/60)});await p.waitForTimeout(300);await S('05_result');await S('v4_result');await S('v5_result');
await p.goto(F+'?mute=1');await p.waitForTimeout(300);await p.keyboard.press('Enter');await p.waitForTimeout(300);await S('06_charselect');await S('v4_charselect');await S('v5_charselect');
console.log('errors:',JSON.stringify(errs));await b.close();})();
