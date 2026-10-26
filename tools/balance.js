// usage: NODE_PATH=/tmp/pw/node_modules node tools/balance.js [N] [diff]
const {chromium}=require('playwright-core');const N=+(process.argv[2]||20),D=process.argv[3]||'2';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});const w={0:0,1:0,'-1':0,timeout:0};const lens=[];
for(let g=0;g<N;g++){await p.goto('file:///workspace/bubble-vs/index.html?mode=aivai&mute=1&diff='+D);
 const r=await p.evaluate(()=>{const G=window.__game;let n=0;while(G.state!=='over'&&n<60*1800){G.step(1/60);n++}return{s:G.state,w:G.winner,t:n/60}});
 if(r.s!=='over')w.timeout++;else w[r.w]++;lens.push(r.t);}
console.log(JSON.stringify({games:N,leftWins:w[0],rightWins:w[1],draws:w['-1'],timeouts:w.timeout,avgSec:(lens.reduce((a,b)=>a+b,0)/N).toFixed(1)}),'errors:',JSON.stringify(errs));await b.close();})();
