// usage: NODE_PATH=/tmp/pw/node_modules node tools/fontshots.js PREFIX   -> shots/PREFIX_*.png
const {chromium}=require('playwright-core');const F='file:///workspace/bubble-vs/index.html';const P=process.argv[2]||'font_after';const Q=process.argv[3]?'&'+process.argv[3]:'';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:960,height:640}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const S=n=>p.screenshot({path:`/workspace/bubble-vs/shots/${P}_${n}.png`});const k=async c=>{await p.keyboard.press(c);await p.waitForTimeout(250)};
await p.goto(F+'?mute=1'+Q);await p.waitForTimeout(900);await S('01_title');
await k('ArrowDown');await S('02_menu');await k('Enter');await S('03_guide');await k('Escape');
await p.goto(F+'?mute=1'+Q);await p.waitForTimeout(600);await k('Enter');await S('04_charselect');await k('Enter');await S('05_oppselect');
await p.goto(F+'?mode=aivai&mute=1'+Q);await p.waitForTimeout(600);
// combo wait: AI-vs-AI matches often finish well inside the search budget (balance.js
// shows ~120-155s avg at default difficulty), which previously let the match run to
// 'over' out from under this loop -- restart the match in place whenever that happens
// so the loop always ends on a live 'play'-state combo, not a stale result screen.
await p.evaluate(()=>{const G=window.__game;for(let i=0;i<60*6;i++)G.step(1/60);let n=0;
 while(n<60*180){if(G.state==='over')G.start('aivai');G.step(1/60);n++;if(G.players.some(b=>b.pops.some(q=>q.label&&q.life>0.8)))break;}
 G.render();});await S('06_hud_combo');
await p.evaluate(()=>{const G=window.__game,[L,R]=G.players;L.meter=100;L.useSkill(R);for(let i=0;i<14;i++)G.step(1/60);G.render()});await S('07_skill_shout');
// roundover/result: force-end rounds directly instead of waiting on organic AI play, so
// these are deterministic captures of the actual roundover/over screens every run.
await p.evaluate(()=>{const G=window.__game;skillAnim=null;G.start('aivai');G.players[1].dead=true;G.step(1/60);G.render();});await S('08_roundover');
await p.evaluate(()=>{const G=window.__game;skillAnim=null;G.start('aivai');G.players[1].dead=true;G.step(1/60);
 for(let i=0;i<120;i++)G.step(1/60);G.players[1].dead=true;G.step(1/60);G.render();});await S('09_result');
console.log('errors:',JSON.stringify(errs));await b.close();})();
