const {chromium}=require('playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:960,height:640}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const f='file:///workspace/bubble-vs/index.html';
await p.goto(f);await p.waitForTimeout(500);await p.screenshot({path:'/workspace/bubble-vs/shots/title.png'});
let results=[];
for(let g=0;g<3;g++){await p.goto(f+'?mode=aivai&mute=1&diff=2');
 const r=await p.evaluate(()=>{const G=window.__game;let n=0;while(G.state==='play'&&n<60*600){G.step(1/60);n++;}return{state:G.state,winner:G.winner,sec:n/60,scores:G.players.map(b=>b.score)}});results.push(r);}
await p.goto(f+'?mode=aivai&mute=1&fast=1');await p.waitForTimeout(6000);await p.screenshot({path:'/workspace/bubble-vs/shots/match.png'});
console.log(JSON.stringify(results),'errors:',errs);await b.close();})();
