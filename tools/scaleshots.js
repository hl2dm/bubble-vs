const {chromium}=require('playwright-core');const F='file:///workspace/bubble-vs/index.html';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--autoplay-policy=no-user-gesture-required']});const errs=[];const out={};
const sizes=[['1280x720',1280,720,1],['1920x1080',1920,1080,1],['2560x1440',2560,1440,1],['narrow',600,900,2]];
for(const [n,w,h,dpr] of sizes){const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr});const p=await c.newPage();
 p.on('pageerror',e=>errs.push(n+':'+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(n+':'+m.text())});
 await p.goto(F+'?mode=ai&mute=1');await p.waitForTimeout(3200);// past INTRO_DUR so input isn't still locked
 const r=await p.evaluate(()=>{const c=document.getElementById('c').getBoundingClientRect();return{l:c.left,t:c.top,w:c.width,h:c.height,bw:c.width&&document.getElementById('c').width,bh:document.getElementById('c').height,iw:innerWidth,ih:innerHeight}});
 // mouse mapping: aim at a logical point and check angle points there
 const G='window.__game';const tgt=[150,200];
 await p.mouse.move(r.l+tgt[0]*r.w/960,r.t+tgt[1]*r.h/640);await p.waitForTimeout(50);
 const m=await p.evaluate(([x,y])=>{const g=window.__game,b=g.players[0];const[lx,ly]=b.launcher();return{angle:b.angle,expect:Math.atan2(x-lx,ly-y)}},tgt);
 out[n]={rect:r,clip:!(r.l>=0&&r.t>=0&&r.l+r.w<=r.iw+0.5&&r.t+r.h<=r.ih+0.5),mouse:m,mouseOK:Math.abs(m.angle-Math.max(-1.4,Math.min(1.4,m.expect)))<0.01};
 await p.screenshot({path:'shots/scale_'+n+'_play.png'});
 await p.keyboard.press('Escape');await p.waitForTimeout(100);await p.screenshot({path:'shots/scale_'+n+'_pause.png'});
 await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await p.waitForTimeout(100);await p.screenshot({path:'shots/scale_'+n+'_settings.png'});
 await p.goto(F+'?mute=1');await p.waitForTimeout(1200);await p.screenshot({path:'shots/scale_'+n+'_title.png'});
 // click the settings item on title via mouse
 const r2=await p.evaluate(()=>{const c=document.getElementById('c').getBoundingClientRect();return{l:c.left,t:c.top,w:c.width,h:c.height}});
 await p.mouse.click(r2.l+480*r2.w/960,r2.t+(330+2*52)*r2.h/640);await p.waitForTimeout(100);
 out[n].titleClickSettings=await p.evaluate(()=>window.__game.overlay);
 await p.keyboard.press('Enter');await p.waitForTimeout(100);out[n].resAfterCycle=await p.evaluate(()=>[window.__game.resMode,localStorage.getItem('bvs_res'),document.getElementById('c').width]);
 await p.evaluate(()=>window.__game.setRes('auto'));
 await c.close();}
console.log(JSON.stringify(out,null,1));console.log('errors:',JSON.stringify(errs));await b.close();})();
