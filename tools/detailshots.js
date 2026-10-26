const {chromium}=require('playwright-core');const F='file:///workspace/bubble-vs/index.html';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome'});const p=await b.newPage({viewport:{width:960,height:640}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const S=async n=>{await p.evaluate(()=>window.__game.render());await p.screenshot({path:'shots/detail_'+n+'.png'});};
const st=(n)=>p.evaluate(n=>{for(let i=0;i<n;i++)window.__game.step(1/60)},n);
await p.goto(F+'?mute=1&manual=1');await p.waitForTimeout(1200);await st(90);await S('01_title');
await p.mouse.move(480,382);await st(20);await S('02_menu_hover');
await p.goto(F+'?mode=aivai&mute=1&manual=1');await p.waitForTimeout(1000);
await st(100);await S('03_intro_ready');await st(50);await S('04_intro_go');
// gameplay until a pop happens
await p.evaluate(()=>{const g=window.__game;for(let i=0;i<6000;i++){g.step(1/60);if(g.players.some(b=>b.popAnim.length&&b.fall.length))break;}});await S('05_pop_and_fall');
await p.evaluate(()=>{const g=window.__game;for(let i=0;i<6000;i++){g.step(1/60);if(g.players.some(b=>b.pops.some(t=>t.combo>=2||t.label)))break;}});await S('06_combo_chain');
await p.evaluate(()=>{const b=window.__game.players[1];b.pending=5;b.afterShot();});await st(10);await S('07_garbage_arrive');await st(30);await S('08_garbage_landed');
await p.evaluate(()=>{const b=window.__game.players[0];
 // compute the exact row count that lands inside the danger band without crossing into death,
 // instead of an iterative insert+step loop -- stepping between inserts with meter already full
 // let the opponent AI fire an attack skill that could tip this already-near-death board over.
 const start=b.lineY()-b.lowestY();let n=0;while(start-n*RH>=RH*1.6&&n<20)n++;
 if(n>0&&(start-n*RH)<R)n--;
 for(let i=0;i<n;i++)b.insertRow(c=>Math.floor(Math.random()*6));});
// settle the ceiling-drop slide-in animation (dur 0.3s) by calling this board's own update()
// directly (bypassing window.__game.step()/aiUpdate entirely) -- that way neither AI ever gets a
// chance to fire a shot or land an attack while meters are maxed below, so the round can't end.
await p.evaluate(()=>{const g=window.__game,b=g.players[0],opp=g.players[1];for(let i=0;i<30&&b.dropAnim;i++)b.update(1/60,opp);});
await p.evaluate(()=>{window.__game.players.forEach(b=>b.meter=100);});
await S('09_danger_skillready');
await p.evaluate(()=>{const g=window.__game;g.players[1].dead=true;});await st(25);await S('10_round_stamp');
await p.evaluate(()=>{const g=window.__game;for(let k=0;k<3&&g.state!=='over';k++){for(let i=0;i<600&&g.state!=='play';i++)g.step(1/60);g.players[1].dead=true;g.step(1/60);}});await st(40);await S('11_result');
console.log('errors:',JSON.stringify(errs));await b.close();})();
