// RWD + touch test: tap menus, play a 1P match by touch (drag-aim/release + on-screen buttons), check layout at several viewports
const {chromium}=require('playwright-core');
const SIZES=[[390,844,'phone_portrait'],[844,390,'phone_landscape'],[768,1024,'tablet_portrait'],[1920,1080,'desktop']];
const URL=process.argv[2]||'file:///workspace/bubble-vs/index.html';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome'});const out=[];
for(const[w,h,name]of SIZES){const touch=name!=='desktop';
 const ctxo=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:touch?3:1,hasTouch:touch,isMobile:touch});const p=await ctxo.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto(URL+'?mute=1');await p.waitForTimeout(1500);
 const cdp=touch?await ctxo.newCDPSession(p):null;
 const L2C=async(x,y)=>p.evaluate(([x,y])=>{const r=document.getElementById('c').getBoundingClientRect();return[r.left+x*r.width/960,r.top+y*r.height/640]},[x,y]);
 const tap=async(x,y)=>{const[cx,cy]=await L2C(x,y);if(touch)await p.touchscreen.tap(cx,cy);else await p.mouse.click(cx,cy);await p.waitForTimeout(400);};
 const st=()=>p.evaluate(()=>window.__game.state);
 const lay=await p.evaluate(()=>{const r=document.getElementById('c').getBoundingClientRect();return{l:r.left,t:r.top,w:r.width,h:r.height,bw:document.getElementById('c').width,sx:document.documentElement.scrollWidth>innerWidth,sy:document.documentElement.scrollHeight>innerHeight}});
 const seq=[];await tap(480,330);seq.push(await st());await tap(260,370);seq.push(await st());await tap(480,300);await tap(480,456);seq.push(await st());
 await p.waitForTimeout(4500);seq.push(await st());
 let shots=0;const pl=()=>p.evaluate(()=>{const G=window.__game,b=G.players[0];return{a:b.angle,st:G.state}});
 if(touch){ // drag on canvas to aim, release to fire
  for(let i=0;i<2;i++){const[sx,sy]=await L2C(220,300),[ex,ey]=await L2C(120+i*40,250);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:ex,y:ey}]});
   const a=(await pl()).a;await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});shots++;await p.waitForTimeout(700);if(i===0)seq.push('aim'+a+(await pl()).st);}
  const fb=await p.$('#tc .gr button.fire');const vis=await fb.isVisible();seq.push('pad:'+vis+(await pl()).st+(await p.evaluate(()=>document.getElementById('tc').className)));
  if(vis){const lb=await p.$('#tc .gl button');const bb=await lb.boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bb.x+20,y:bb.y+20}]});await p.waitForTimeout(300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});seq.push('angL'+(await pl()).a);
   await fb.tap();await p.waitForTimeout(300);}
 } else {for(let i=0;i<2;i++){await tap(150+i*30,250);await p.waitForTimeout(600);}}
 await p.screenshot({path:`/workspace/bubble-vs/shots/rwd_${name}.png`});
 // finish the match quickly by fast-stepping (AI controls opponent; human idle) to check game over reachable
 const fin=await p.evaluate(()=>{const G=window.__game;let n=0;while(G.state!=='over'&&n<60*900){if(G.state==='roundover'||G.state==='intro'){} G.step(1/60);n++;if(G.state==='roundover'){/*advance*/}}return G.state});
 seq.push('end:'+fin);out.push({name,lay,seq,errs});await ctxo.close();}
console.log(JSON.stringify(out,null,1));await b.close();})();
