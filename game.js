'use strict';
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
// ---- display scaling: game logic always works in a fixed 960x640 logical space; the canvas
// backing store is sized to the chosen render resolution and the CSS box fills the window (letterboxed). ----
const LW=960,LH=640,RES_OPTS=['auto','720','1080','1440'],RES_LABEL={auto:'自動',720:'720p',1080:'1080p',1440:'1440p'};
let resMode=(()=>{try{const q=new URLSearchParams(location.search).get('res');if(RES_OPTS.includes(q))return q;const v=localStorage.getItem('bvs_res');return RES_OPTS.includes(v)?v:'auto';}catch(e){return'auto';}})();
let RS=1; // backing pixels per logical pixel
const stageEl=document.getElementById('stage');
function fitCanvas(){const vw=stageEl?stageEl.clientWidth:innerWidth,vh=stageEl?stageEl.clientHeight:innerHeight,fit=Math.max(0.1,Math.min(vw/LW,vh/LH));const cw=Math.floor(LW*fit),ch=Math.floor(LH*fit);
 cv.style.width=cw+'px';cv.style.height=ch+'px';
 let bh=resMode==='auto'?Math.round(ch*(window.devicePixelRatio||1)):+resMode;bh=Math.max(320,Math.min(2160,bh));const bw=Math.round(bh*LW/LH);
 if(cv.width!==bw||cv.height!==bh){cv.width=bw;cv.height=bh;}RS=bh/LH;}
function setRes(m){resMode=m;try{localStorage.setItem('bvs_res',m);}catch(e){}fitCanvas();}
function isFull(){return!!(document.fullscreenElement||document.webkitFullscreenElement);}
function toggleFull(){try{const d=document,el=d.documentElement;if(isFull()){(d.exitFullscreen||d.webkitExitFullscreen).call(d);}else{const rq=el.requestFullscreen||el.webkitRequestFullscreen;if(!rq)return;const pr=rq.call(el,{navigationUI:'hide'});const lock=()=>{try{const o=screen.orientation;if(o&&o.lock&&IS_TOUCH){const q=o.lock('landscape');if(q&&q.catch)q.catch(()=>{});}}catch(e){}};if(pr&&pr.then)pr.then(lock,()=>{});else lock();}}catch(e){}}
const IS_TOUCH=/[?&]touch=1/.test(location.search)||(window.matchMedia&&matchMedia('(pointer: coarse)').matches)||('ontouchstart' in window&&navigator.maxTouchPoints>0);
if(IS_TOUCH)document.documentElement.classList.add('touch');
addEventListener('resize',fitCanvas);addEventListener('orientationchange',()=>setTimeout(fitCanvas,250));if(window.visualViewport)visualViewport.addEventListener('resize',fitCanvas);document.addEventListener('fullscreenchange',fitCanvas);document.addEventListener('webkitfullscreenchange',fitCanvas);
if(window.matchMedia){try{matchMedia('(resolution: '+(window.devicePixelRatio||1)+'dppx)').addEventListener('change',fitCanvas);}catch(e){}}
fitCanvas();
let overlay=null,ovSel=0; // null | 'pause' | 'settings'
let settingsFrom=null;
const PAUSE_MENU=['繼續','設定','回標題'],SET_MENU=['解析度','全螢幕','返回'];
const Q=new URLSearchParams(location.search);
const R=26,COLS=8,RH=R*Math.sqrt(3),FW=COLS*2*R,FH=540,LOSE_ROWS=12;
const TOPBAR_H=54,PILLAR_W=26,CENTER_W=44,ARROW_LEN=46,BOARD_OX=34;
const COLORS=['#2ecc40','#2f7cff','#ff4136','#ffdc00','#b10dc9','#ff8a1e'];
const GREEN=0,BLUE=1;
const P_INFO=[{name:'沈柏楊',fc:GREEN,col:'#2ecc40',dark:'#0d5c1d'},{name:'蔣萬安',fc:BLUE,col:'#2f7cff',dark:'#0c2f78'}];
let muted=!!Q.get('mute');
const SFX={},SFX_NAMES=['shoot','bounce','stick','pop','combo','drop','skill','garbage','danger','ceiling','win','lose','select','confirm'];
for(const n of SFX_NAMES){const a=new Audio();a.preload='auto';a.addEventListener('canplaythrough',()=>{SFX[n].ok=true},{once:true});a.addEventListener('error',()=>{SFX[n].ok=false},{once:true});a.src='audio/'+n+'.ogg';SFX[n]={a,ok:false,pool:[],i:0};}
const VOICE={};['ready','go','round1','round2','win','lose'].forEach(n=>{const a=new Audio();a.preload='auto';const r={a,ok:false};a.addEventListener('canplaythrough',()=>{r.ok=true},{once:true});a.addEventListener('error',()=>{r.ok=false},{once:true});a.src='audio/voice/'+n+'.ogg';VOICE[n]=r;});
function voice(n){if(muted)return;const r=VOICE[n];if(!r||!r.ok)return;try{r.a.volume=.95;r.a.currentTime=0;const pr=r.a.play();if(pr&&pr.catch)pr.catch(()=>{});}catch(e){}}
const SFX_VOL={shoot:.5,bounce:.45,stick:.5,pop:.7,combo:.7,drop:.6,skill:.85,garbage:.7,danger:.6,ceiling:.7,win:.8,lose:.8,select:.5,confirm:.6};
function sfx(n,fb){if(muted)return;const S=SFX[n];if(S&&S.ok){try{if(S.pool.length<4)S.pool.push(S.a.cloneNode());const a=S.pool[S.i++%S.pool.length];a.volume=SFX_VOL[n]||.6;a.currentTime=0;const pr=a.play();if(pr&&pr.catch)pr.catch(()=>{});return;}catch(e){}}if(fb)fb();}
let bgmEl=null;function bgmSync(){try{if(!bgmEl){bgmEl=new Audio('audio/bgm.ogg');bgmEl.loop=true;bgmEl.volume=.28;bgmEl.addEventListener('error',()=>{bgmEl.dead=true});}if(bgmEl.dead)return;const want=!muted&&(state==='play'||state==='roundover'||state==='skill');if(want&&bgmEl.paused){const pr=bgmEl.play();if(pr&&pr.catch)pr.catch(()=>{});}else if(!want&&!bgmEl.paused)bgmEl.pause();}catch(e){}}
let ac=null;function beep(f,d=0.08,t='square',v=0.05){if(muted)return;try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.type=t;o.frequency.value=f;g.gain.value=v;g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+d);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d);}catch(e){}}
// iOS/Android: media elements and WebAudio may only start inside a user gesture -> unlock everything on first touch/click/key
let audioUnlocked=false;function unlockAudio(){if(audioUnlocked)return;audioUnlocked=true;
 const els=[];for(const n of SFX_NAMES){const S=SFX[n];while(S.pool.length<4)S.pool.push(S.a.cloneNode());els.push(S.a,...S.pool);}for(const k in VOICE)els.push(VOICE[k].a);
 try{if(!bgmEl){bgmEl=new Audio('audio/bgm.ogg');bgmEl.loop=true;bgmEl.volume=.28;bgmEl.addEventListener('error',()=>{bgmEl.dead=true});}els.push(bgmEl);}catch(e){}
 for(const a of els){try{a.muted=true;const pr=a.play();const done=()=>{try{if(a!==bgmEl||!(state==='play'||state==='roundover'||state==='skill')){a.pause();a.currentTime=0;}}catch(e){}a.muted=false;};if(pr&&pr.then)pr.then(done,()=>{a.muted=false;});else done();}catch(e){}}
 try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.resume)ac.resume();const b=ac.createBuffer(1,1,22050),src=ac.createBufferSource();src.buffer=b;src.connect(ac.destination);src.start(0);}catch(e){}}
['pointerdown','touchend','keydown','click'].forEach(ev=>addEventListener(ev,unlockAudio,{capture:true,passive:true}));
const rnd=n=>Math.floor(Math.random()*n);

// ---- optional art: drop PNGs into art/gpt/ (see art/README.md). Everything here has a
// procedural canvas fallback, so the game looks/works identically with zero image files. ----
const ART={};
const ART_USER=/[?&]art=user/.test(location.search);
function loadArt(key,path){if(ART_USER&&/char|portrait|cutin/.test(path))path=path.replace('art/gpt/','art/user/');const im=new Image();const rec={el:im,ok:false};im.onload=()=>{rec.ok=true;};im.onerror=()=>{};im.src=path;ART[key]=rec;}
function artReady(key){const r=ART[key];return!!(r&&r.ok&&r.el.naturalWidth>0);}
function drawImgRect(key,x,y,w,h){ctx.drawImage(ART[key].el,x,y,w,h);}
function drawImgCentered(key,x,y,w,h){ctx.drawImage(ART[key].el,x-w/2,y-h/2,w,h);}
// aspect-preserving contain-fit inside box (bx,by,bw,bh); ax: 0=left .5=center 1=right, ay: 0=top .5=middle 1=bottom. Never stretches.
function drawImgContain(key,bx,by,bw,bh,ax=.5,ay=1){const im=ART[key].el,iw=im.naturalWidth,ih=im.naturalHeight,s=Math.min(bw/iw,bh/ih),w=iw*s,h=ih*s;
 ctx.drawImage(im,bx+(bw-w)*ax,by+(bh-h)*ay,w,h);return{x:bx+(bw-w)*ax,y:by+(bh-h)*ay,w,h};}
[['title_logo','art/gpt/title_logo.png'],['title_keyart','art/gpt/title_keyart.png'],
 ['bg_center','art/gpt/bg_center.png'],['bg_0','art/gpt/bg_green.png'],['bg_1','art/gpt/bg_blue.png'],
 ['bg_pattern','art/gpt/v4_bg_pattern.png'],
 ['bubble_0','art/gpt/bubble_0.png'],['bubble_1','art/gpt/bubble_1.png'],['bubble_2','art/gpt/bubble_2.png'],
 ['bubble_3','art/gpt/bubble_3.png'],['bubble_4','art/gpt/bubble_4.png'],['bubble_5','art/gpt/bubble_5.png'],
 ['ceilingbar','art/gpt/ceiling_bar.png'],
 ['pillar_side','art/gpt/v4_pillar_side.png'],['pillar_center','art/gpt/v4_pillar_center.png'],
 ['topbar','art/gpt/v4_topbar.png'],
 ['launcher_base','art/gpt/v4_launcher_base.png'],['launcher_arrow','art/gpt/v4_launcher_arrow.png'],
 ['next_box','art/gpt/v4_next_box.png'],
 ['button_normal','art/gpt/button_normal.png'],['button_hover','art/gpt/button_hover.png'],
 ['meterframe_0','art/gpt/meterframe_green.png'],['meterframe_1','art/gpt/meterframe_blue.png'],
 ['emblem_0','art/gpt/emblem_green.png'],['emblem_1','art/gpt/emblem_blue.png'],
 ['ui_panel_wide','art/gpt/ui_panel_wide.png'],['ui_panel_dialog','art/gpt/ui_panel_dialog.png'],
 ['char_full_0','art/gpt/char_green_full.png'],['char_full_1','art/gpt/char_blue_full.png'],
 ['stand_0_normal','art/gpt/v4_char_green_stand_normal.png'],['stand_0_happy','art/gpt/v4_char_green_stand_happy.png'],['stand_0_sad','art/gpt/v4_char_green_stand_sad.png'],
 ['stand_1_normal','art/gpt/v4_char_blue_stand_normal.png'],['stand_1_happy','art/gpt/v4_char_blue_stand_happy.png'],['stand_1_sad','art/gpt/v4_char_blue_stand_sad.png'],
 ['cutin_0','art/gpt/cutin_shen.png'],['cutin_1','art/gpt/cutin_chiang.png'],
 ['cutin4_0','art/gpt/v4_cutin_shen.png'],['cutin4_1','art/gpt/v4_cutin_chiang.png'],
].forEach(([k,p])=>loadArt(k,p));
// frame-animation sprite sheets (horizontal strips, 12 frames, from image-to-video of the user's stand art)
const ANIM_FRAMES=12,ANIM_FPS=11;
['green','blue'].forEach((c,i)=>['normal','happy','sad'].forEach(e=>loadArt('anim_'+i+'_'+e,'art/anim/'+c+'_'+e+'.png')));

let state='title',mode='ai',difficulty=1,players=[],particles=[],winner=-1,menuSel=0,timeT=0;
let matchScore=[0,0],round=1,roundT=0,updFlip=false,overT=0,introT=0;
const INTRO_DUR=2.8; // ROUND N -> READY -> GO!, gameplay locked (state stays 'intro') until it elapses
// ---- juice globals: capped particle pool, global screen-shake (small + decaying so HUD
// never visibly rattles), menu-state fade transition, title-screen idle decorations. ----
const PARTICLE_CAP=400;
function pushParticle(p){if(particles.length>=PARTICLE_CAP)particles.shift();particles.push(p);}
let shakeMag=0;function addShake(m){shakeMag=Math.min(10,Math.max(shakeMag,m));}
let transT=0;function setState(s){state=s;transT=1;}
let titleBubbles=null;function ensureTitleBubbles(){if(titleBubbles)return;titleBubbles=[];for(let k=0;k<14;k++)titleBubbles.push({x:Math.random()*960,y:Math.random()*640,c:rnd(6),r:8+Math.random()*10,sp:6+Math.random()*10,ph:Math.random()*6.28});}
let charSel=0,oppType='ai',humanSide=0; // character-select / opponent-select state
const BO=2; // round wins needed to take the match
const MENU=['開始遊戲','遊戲說明','設定'];const OPP_MENU=['單人：電腦對戰','雙人：本機雙打','難度','開戰'];const DIFF=['簡單','普通','困難'];

class Board{
 constructor(i){this.i=i;this.ox=i===0?BOARD_OX:960-BOARD_OX-FW;this.oy=TOPBAR_H+8;this.grid=[];this.par=0;this.ceil=0;
  for(let r=0;r<5;r++)this.grid.push(this.newRow(r,()=>rnd(5)<4?rnd(6):-1,true));
  this.angle=0;this.cur=this.pick();this.next=this.pick();this.shot=null;this.meter=0;this.shots=0;this.timer=0;
  this.pending=0;this.pendSkill=false;this.dead=false;this.score=0;this.ai=null;this.aiT=0;this.aiTarget=null;this.flash=0;this.fall=[];this.pops=[];this.exprT=0;
  // ---- juice state: visual-only, never read by game logic (AI/placement/collision stay untouched) ----
  this.scoreDisp=0;this.popAnim=[];this.wobble={};this.garb=new Set();this.dropAnim=null;
  this.comboCount=0;this.lastPopT=-10;this.meterPrev=0;this.gearRot=0;this.prevAngle=0;this.recoil=0;this.curAnim=null;
  this.shotTrail=[];this.standBobPh=Math.random()*6.28;this.standBlinkT=1.6+Math.random()*2;this.blinkAnimT=0;this.hopT=0;this.inDanger=false;}
 nc(r){return ((r+this.par)%2)?COLS-1:COLS}
 newRow(r,f,init){const n=((r+(init?0:this.par))%2)?COLS-1:COLS;const a=[];for(let c=0;c<COLS;c++)a.push(c<n?f(c):-1);return a;}
 pos(r,c){const off=((r+this.par)%2)?R:0;return[this.ox+R+c*2*R+off,this.oy+this.ceil+R+r*RH];}
 get(r,c){return r>=0&&r<this.grid.length&&c>=0&&c<this.nc(r)?this.grid[r][c]:-2}
 ensure(r){while(this.grid.length<=r)this.grid.push(new Array(COLS).fill(-1));}
 nb(r,c){const o=((r+this.par)%2);const d=o?[[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]]:[[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]];return d.map(([a,b])=>[r+a,c+b]);}
 colorsPresent(){const s=new Set();this.grid.forEach(row=>row.forEach(v=>{if(v>=0)s.add(v)}));return[...s];}
 pick(){const s=this.colorsPresent();return s.length?s[rnd(s.length)]:rnd(6);}
 insertRow(fn){this.grid.unshift(new Array(COLS).fill(-1));this.par^=1;for(let c=0;c<this.nc(0);c++)this.grid[0][c]=fn(c);this.trim();
  if(this.garb.size){const ng=new Set();this.garb.forEach(k=>{const p=k.split(',');ng.add((+p[0]+1)+','+p[1]);});this.garb=ng;}
  if(this.dropAnim&&this.dropAnim.t<this.dropAnim.dur){this.dropAnim.n++;this.dropAnim.t=0;}else this.dropAnim={t:0,dur:0.3,n:1};}
 trim(){while(this.grid.length&&this.grid[this.grid.length-1].every(v=>v<0))this.grid.pop();}
 lowestY(){let m=-1;this.grid.forEach((row,r)=>row.forEach((v,c)=>{if(v>=0&&c<this.nc(r))m=Math.max(m,r)}));return m<0?0:this.pos(m,0)[1];}
 lineY(){return this.oy+FH-96}
 launcher(){return[this.ox+FW/2,this.oy+FH-40]}
 // trajectory simulation -> cell
 trace(angle,cb){let [x,y]=this.launcher();let vx=Math.sin(angle),vy=-Math.cos(angle);for(let k=0;k<4000;k++){x+=vx*4;y+=vy*4;
   if(x<this.ox+R){x=2*(this.ox+R)-x;vx=-vx}if(x>this.ox+FW-R){x=2*(this.ox+FW-R)-x;vx=-vx}
   if(cb)cb(x,y);if(y<=this.oy+this.ceil+R)return this.snap(x,y);
   const hit=this.collide(x,y);if(hit)return this.snap(x,y);}return null;}
 collide(x,y){const r0=Math.floor((y-this.oy-this.ceil-R)/RH);for(let r=r0-1;r<=r0+1;r++){if(r<0||r>=this.grid.length)continue;for(let c=0;c<this.nc(r);c++){if(this.grid[r][c]<0)continue;const[px,py]=this.pos(r,c);if((px-x)**2+(py-y)**2<(2*R*0.85)**2)return true;}}return false;}
 snap(x,y){let best=null,bd=1e9;const r0=Math.round((y-this.oy-this.ceil-R)/RH);for(let r=Math.max(0,r0-1);r<=r0+1;r++){const n=((r+this.par)%2)?COLS-1:COLS;for(let c=0;c<n;c++){if(this.get(r,c)>=0)continue;
   if(r>0){const ok=this.nb(r,c).some(([a,b])=>this.get(a,b)>=0);if(!ok&&r>0)continue;}const[px,py]=this.pos(r,c);const d=(px-x)**2+(py-y)**2;if(d<bd){bd=d;best=[r,c]}}}
  if(!best){best=[0,Math.max(0,Math.min(this.nc(0)-1,Math.round((x-this.ox-R)/(2*R))))];}return best;}
 cluster(r,c,col){const seen=new Set([r+','+c]),st=[[r,c]],out=[];while(st.length){const[a,b]=st.pop();out.push([a,b]);for(const[x,y]of this.nb(a,b)){const k=x+','+y;if(!seen.has(k)&&this.get(x,y)===col&&(col!==undefined)){seen.add(k);st.push([x,y])}}}return out;}
 floating(){const seen=new Set(),st=[];for(let c=0;c<this.nc(0);c++)if(this.get(0,c)>=0){seen.add('0,'+c);st.push([0,c])}
  while(st.length){const[a,b]=st.pop();for(const[x,y]of this.nb(a,b)){const k=x+','+y;if(!seen.has(k)&&this.get(x,y)>=0){seen.add(k);st.push([x,y])}}}
  const f=[];this.grid.forEach((row,r)=>row.forEach((v,c)=>{if(v>=0&&c<this.nc(r)&&!seen.has(r+','+c))f.push([r,c])}));return f;}
 place(r,c,col){this.ensure(r);this.grid[r][c]=col;let popped=0,dropped=0;const cl=this.cluster(r,c,col);const[px,py]=this.pos(r,c);
  if(cl.length>=3){for(const[a,b]of cl){const[bx,by]=this.pos(a,b);burst(bx,by,COLORS[this.grid[a][b]]);
    this.popAnim.push({x:bx,y:by,c:this.grid[a][b],age:0,dur:0.22});this.garb.delete(a+','+b);this.grid[a][b]=-1;}popped=cl.length;
   const fl=this.floating();for(const[a,b]of fl){const[fx,fy]=this.pos(a,b);this.fall.push({x:fx,y:fy,vy:-1-Math.random()*2,vx:Math.random()*2-1,c:this.grid[a][b],rot:0,rotV:(Math.random()*2-1)*7,bounced:false,alpha:1});this.garb.delete(a+','+b);this.grid[a][b]=-1;}dropped=fl.length;
   sfx(popped>=6||dropped>=4?'combo':'pop',()=>beep(520+popped*40,0.12,'triangle'));if(dropped)sfx('drop',()=>beep(300,0.2,'sawtooth',0.04));
   const pts=popped*10+dropped*dropped*20;const tier=dropped>=4?3:popped>=6?2:popped>=4?1:0;const label=['','漂亮！','超棒！','連鎖！'][tier];
   if(label)this.exprT=1.1;
   this.comboCount=(timeT-this.lastPopT<1.6)?this.comboCount+1:1;this.lastPopT=timeT;
   const cx=Math.max(this.ox+70,Math.min(this.ox+FW-70,px));
   this.pops.push({x:cx,y:py,label,tier,pts,life:1.1,vy:-26,combo:this.comboCount>=2?this.comboCount:0});
   if(dropped>=4||popped>=6)addShake(4);}
  else{sfx('stick',()=>beep(220,0.04));
   for(const[a,b]of this.nb(r,c)){if(this.get(a,b)>=0){const[nx,ny]=this.pos(a,b);const dx=nx-px,dy=ny-py,d=Math.hypot(dx,dy)||1;
    this.wobble[a+','+b]={t0:timeT,dx:dx/d*2.6,dy:dy/d*2.6};}}}
  this.trim();this.score+=popped*10+dropped*dropped*20;
  this.meter=Math.min(100,this.meter+popped*4+dropped*7);return{popped,dropped};}
 fire(){if(this.shot||this.dead||skillAnim)return;const a=this.angle;const[x,y]=this.launcher();this.shot={x,y,vx:Math.sin(a)*9,vy:-Math.cos(a)*9,c:this.cur};this.cur=this.next;this.next=this.pick();
  this.recoil=1;this.hopT=1;this.curAnim={t:0,dur:0.22};this.shotTrail.length=0;sfx('shoot',()=>beep(660,0.05,'square',0.03));}
 update(dt,opp){const meterStart=this.meter;this.timer+=dt;this.flash=Math.max(0,this.flash-dt);this.exprT=Math.max(0,this.exprT-dt);
  if(this.garbT>0)this.garbT=Math.max(0,this.garbT-dt);this.scoreDisp+=(this.score-this.scoreDisp)*Math.min(1,dt*8);if(Math.abs(this.score-this.scoreDisp)<0.5)this.scoreDisp=this.score;
  this.recoil=Math.max(0,this.recoil-dt*7);this.hopT=Math.max(0,this.hopT-dt*4.5);
  if(this.curAnim){this.curAnim.t+=dt;if(this.curAnim.t>=this.curAnim.dur)this.curAnim=null;}
  if(this.dropAnim){this.dropAnim.t+=dt;if(this.dropAnim.t>=this.dropAnim.dur)this.dropAnim=null;}
  {const dAngle=this.angle-this.prevAngle;this.prevAngle=this.angle;this.gearRot+=dt*(1.1+Math.abs(dAngle)*9);}
  this.standBlinkT-=dt;if(this.standBlinkT<=0){this.standBlinkT=2.4+Math.random()*2.4;this.blinkAnimT=0.14;}this.blinkAnimT=Math.max(0,this.blinkAnimT-dt);
  for(const k in this.wobble){if(timeT-this.wobble[k].t0>0.4)delete this.wobble[k];}
  for(const a of this.popAnim){a.age+=dt;}this.popAnim=this.popAnim.filter(a=>a.age<a.dur);
  for(let i=this.shotTrail.length-1;i>=0;i--){this.shotTrail[i].a-=dt*4;if(this.shotTrail[i].a<=0)this.shotTrail.splice(i,1);}
  for(const f of this.fall){if(!f.bounced){f.vy+=0.35;f.y+=f.vy;f.x+=f.vx;f.rot+=f.rotV*dt;
    if(f.y>this.oy+FH-R){f.y=this.oy+FH-R;f.vy*=-0.42;f.bounced=true;}}
   else{f.vy+=0.35;f.y+=f.vy;f.x+=f.vx*0.6;f.rot+=f.rotV*0.6*dt;f.alpha-=dt*1.8;}}
  this.fall=this.fall.filter(f=>f.y<this.oy+FH+60&&f.alpha>0);
  for(const t of this.pops){t.life-=dt;t.y=Math.max(this.oy+34,t.y+t.vy*dt);}this.pops=this.pops.filter(t=>t.life>0);
  if(this.dead)return;
  if(this.shot){const s=this.shot;this.shotTrail.push({x:s.x,y:s.y,c:s.c,a:0.55});if(this.shotTrail.length>6)this.shotTrail.shift();
   for(let k=0;k<3;k++){s.x+=s.vx/3;s.y+=s.vy/3;
    if(s.x<this.ox+R){s.x=2*(this.ox+R)-s.x;s.vx=-s.vx;sfx('bounce');}if(s.x>this.ox+FW-R){s.x=2*(this.ox+FW-R)-s.x;s.vx=-s.vx;sfx('bounce');}
    if(s.y<=this.oy+this.ceil+R||this.collide(s.x,s.y)){const[r,c]=this.snap(s.x,s.y);this.shot=null;this.shotTrail.length=0;const res=this.place(r,c,s.c);this.shots++;
     if(res.dropped>=3){opp.pending+=Math.min(8,res.dropped-1);}
     this.afterShot();break;}}}
  if(this.timer>18){this.timer=0;this.ceil+=RH;this.flash=0.4;sfx('ceiling',()=>beep(120,0.3,'sawtooth',0.05));
   for(let dx=10;dx<FW;dx+=44)dustPuff(this.ox+dx,this.oy+this.ceil);addShake(5);}
  if(!this.colorsPresent().length&&!this.shot){this.insertRow(()=>rnd(6));}
  if(this.lowestY()+R>this.lineY())this.dead=true;const dg=!this.dead&&this.lowestY()+R>this.lineY()-RH*1.6;if(dg&&!this.inDanger)sfx('danger',()=>beep(990,0.12,'square',0.04));this.inDanger=dg;
  if(this.meter>meterStart){const my=this.oy+FH+14;meterSpark(this.ox+FW*Math.min(100,this.meter)/100,my+8,P_INFO[this.i].col);}}
 afterShot(){if(this.pending>0){const n=this.pending;this.pending=0;const n0=((this.par^1)%2)?COLS-1:COLS;const cols=[...Array(n0).keys()].sort(()=>Math.random()-0.5).slice(0,Math.min(n,COLS-1));this.insertRow(c=>cols.includes(c)?rnd(6):-1);
   for(const c of cols)this.garb.add('0,'+c);this.garbT=0.5;
   this.flash=0.3;addShake(3);sfx('garbage',()=>beep(150,0.2,'square',0.04));}
  if(this.pendSkill){this.pendSkill=false;const fc=P_INFO[1-this.i].fc;this.insertRow(()=>fc);this.insertRow(c=>c%2?fc:-1);this.flash=0.5;addShake(4);}
  if(this.cur>=0&&!this.colorsPresent().includes(this.cur)&&this.colorsPresent().length)this.cur=this.pick();}
 useSkill(opp){if(this.meter<100||this.dead||skillAnim)return;this.meter=0;startSkillAnim(this,opp);}
}
function burst(x,y,c){for(let k=0;k<8;k++){const a=Math.random()*6.28,s=1+Math.random()*3;pushParticle({ty:'spark',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:1,c})}
 for(let k=0;k<5;k++){const a=Math.random()*6.28,s=1.5+Math.random()*3.5;pushParticle({ty:'shard',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,l:1,c,rot:Math.random()*6.28,rotV:(Math.random()*2-1)*10,sz:2+Math.random()*2.5})}
 for(let k=0;k<4;k++){const a=Math.random()*6.28,s=0.4+Math.random()*1.2;pushParticle({ty:'glint',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-0.6,l:0.7,c:'#fff'})}}
function dustPuff(x,y){for(let k=0;k<6;k++)pushParticle({ty:'dust',x:x+Math.random()*30-15,y,vx:(Math.random()*2-1)*0.8,vy:-0.3-Math.random()*0.5,l:1,sz:3+Math.random()*4});}
function meterSpark(x,y,col){pushParticle({ty:'mspark',x,y,vx:(Math.random()*2-1)*0.5,vy:-0.8-Math.random()*0.6,l:1,c:col});}
function drawParticles(){for(const p of particles){ctx.globalAlpha=Math.max(0,p.l);
  if(p.ty==='shard'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.c;ctx.fillRect(-p.sz/2,-p.sz/2,p.sz,p.sz*0.6);ctx.restore();}
  else if(p.ty==='dust'){ctx.fillStyle=`rgba(200,200,215,${Math.max(0,p.l)*0.5})`;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*(1.6-p.l*0.6),0,7);ctx.fill();}
  else if(p.ty==='glint'){ctx.fillStyle='#fff';ctx.fillRect(p.x-1,p.y-4,2,8);ctx.fillRect(p.x-4,p.y-1,8,2);}
  else if(p.ty==='mspark'){ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,1.6,0,7);ctx.fill();}
  else{ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,3,0,7);ctx.fill();}}
 ctx.globalAlpha=1;}

// ---- N64 Puzzle-Bobble style skill cut-in: pauses play, slides caster art across
// with speed lines + shout text + flash, then flies faction bubbles into the
// opponent board before the actual rows are inserted. Driven entirely by step(dt)
// so it works headless (tools/shots.js, tools/balance.js) and for AI/human/2P alike. ----
let skillAnim=null;
const SK_DUR=1.3,SK_FLASH=0.1,SK_SLIDE_IN=0.22,SK_HOLD=0.72,SK_SLIDE_OUT=0.9,SK_FLY_START=0.8,SK_APPLY=1.15;
const SKILL_LINE=['沈柏楊「綠色浪潮！」','蔣萬安「藍色風暴！」'];
const easeOutCubic=p=>1-Math.pow(1-p,3),easeInCubic=p=>p*p*p;
const easeOutBack=p=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2);};
const POP_IN_DUR=0.2;
function popScale(age){return age>=POP_IN_DUR?1:Math.max(0,easeOutBack(age/POP_IN_DUR));}
function startSkillAnim(caster,opp){skillAnim={caster,opp,t:0,flying:false,applied:false,bubbles:[]};sfx('skill',()=>{beep(200,0.15,'sawtooth',0.05);beep(880,0.3,'triangle',0.08)});}
function spawnSkillBubbles(a){const cb=a.caster,ob=a.opp;const[lx,ly]=cb.launcher();
 for(let k=0;k<16;k++){const tx=ob.ox+R+Math.random()*(FW-2*R);const ty=ob.oy+ob.ceil+R+Math.random()*RH*1.5;
  a.bubbles.push({sx:lx+Math.random()*40-20,sy:ly-20-Math.random()*30,tx,ty,delay:Math.random()*0.3,dur:0.3+Math.random()*0.25,c:cb.i});}}
function applySkillEffect(cb,ob){ob.pendSkill=true;if(!ob.shot)ob.afterShot();sfx('garbage',()=>beep(150,0.2,'square',0.04));}
function updateSkillAnim(dt){const a=skillAnim;a.t+=dt;
 if(!a.flying&&a.t>=SK_FLY_START){a.flying=true;spawnSkillBubbles(a);}
 if(!a.applied&&a.t>=SK_APPLY){a.applied=true;applySkillEffect(a.caster,a.opp);}
 if(a.t>=SK_DUR)skillAnim=null;}

// AI
function aiThink(b){let best=null,bs=-1e9;for(let a=-1.35;a<=1.35;a+=0.025){const cell=b.trace(a);if(!cell)continue;const[r,c]=cell;
  b.ensure(r);const old=b.grid[r][c];b.grid[r][c]=b.cur;const cl=b.cluster(r,c,b.cur);let s;
  if(cl.length>=3){cl.forEach(([x,y])=>b.grid[x][y]=-1);const fl=b.floating().length;cl.forEach(([x,y])=>b.grid[x][y]=b.cur);s=100+cl.length*10+fl*25;}
  else s=(cl.length-1)*20-r*3;
  b.grid[r][c]=old;b.trim();s+=Math.random()*5;if(s>bs){bs=s;best=a}}
 const noise=[0.18,0.07,0.015][difficulty];return (best??0)+(Math.random()*2-1)*noise;}
function aiUpdate(b,opp,dt){if(b.dead||b.shot)return;b.aiT-=dt;if(b.aiTarget===null){b.aiTarget=aiThink(b);}
 const sp=[1.2,2,3.5][difficulty]*dt;const d=b.aiTarget-b.angle;b.angle+=Math.max(-sp,Math.min(sp,d));
 if(Math.abs(d)<0.01&&b.aiT<=0){b.fire();b.aiTarget=null;b.aiT=[0.9,0.55,0.3][difficulty]*(Q.get('fast')?0.3:1);}
 if(b.meter>=100&&Math.random()<dt*0.5)b.useSkill(opp);}

const keys={};
function start(m){mode=m;matchScore=[0,0];round=1;players=[new Board(0),new Board(1)];particles=[];winner=-1;setState('intro');introT=0;timeT=0;}
function toCharSelect(){charSel=humanSide;setState('charselect');}
function toOppSelect(){humanSide=charSel;menuSel=0;setState('oppselect');}
function titleAct(){if(menuSel===0)toCharSelect();else if(menuSel===2){openSettings(null);}else setState('help');sfx('confirm',()=>beep(500));}
function oppAct(){if(menuSel===0)oppType='ai';else if(menuSel===1)oppType='2p';else if(menuSel===2)difficulty=(difficulty+1)%3;else if(menuSel===3)start(oppType);sfx('confirm',()=>beep(500));}
function openSettings(from){settingsFrom=from;overlay='settings';ovSel=0;}
function closeOverlay(){overlay=settingsFrom;settingsFrom=null;ovSel=overlay==='pause'?1:0;}
function ovAct(i){sfx('confirm',()=>beep(500));
 if(overlay==='pause'){if(i===0)overlay=null;else if(i===1)openSettings('pause');else{overlay=null;setState('title');menuSel=0;}return;}
 if(overlay==='settings'){if(i===0)setRes(RES_OPTS[(RES_OPTS.indexOf(resMode)+1)%RES_OPTS.length]);else if(i===1)toggleFull();else closeOverlay();}}
function ovKey(e){const M=overlay==='pause'?PAUSE_MENU:SET_MENU;
 if(e.code==='ArrowUp'||e.code==='KeyW'){ovSel=(ovSel+M.length-1)%M.length;sfx('select');}
 else if(e.code==='ArrowDown'||e.code==='KeyS'){ovSel=(ovSel+1)%M.length;sfx('select');}
 else if(overlay==='settings'&&ovSel===0&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){setRes(RES_OPTS[(RES_OPTS.indexOf(resMode)+(e.code==='ArrowLeft'?RES_OPTS.length-1:1))%RES_OPTS.length]);sfx('select');}
 else if(e.code==='Enter'||e.code==='Space')ovAct(ovSel);
 else if(e.code==='Escape'){if(overlay==='pause')overlay=null;else closeOverlay();}}
addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 if(e.code==='KeyM'){muted=!muted;return;}
 if(e.code==='KeyF'){toggleFull();return;}
 if(overlay){ovKey(e);return;}
 if(state==='title'){if(e.code==='ArrowUp'||e.code==='KeyW'){menuSel=(menuSel+MENU.length-1)%MENU.length;sfx('select');}if(e.code==='ArrowDown'||e.code==='KeyS'){menuSel=(menuSel+1)%MENU.length;sfx('select');}
  if(e.code==='Enter'||e.code==='Space')titleAct();return;}
 if(state==='charselect'){if(e.code==='ArrowLeft'||e.code==='KeyA'){charSel=0;sfx('select');}if(e.code==='ArrowRight'||e.code==='KeyD'){charSel=1;sfx('select');}
  if(e.code==='Enter'||e.code==='Space'){toOppSelect();sfx('confirm',()=>beep(500));}if(e.code==='Escape')setState('title');return;}
 if(state==='oppselect'){if(e.code==='ArrowUp'||e.code==='KeyW'){menuSel=(menuSel+OPP_MENU.length-1)%OPP_MENU.length;sfx('select');}if(e.code==='ArrowDown'||e.code==='KeyS'){menuSel=(menuSel+1)%OPP_MENU.length;sfx('select');}
  if(menuSel===2&&(e.code==='ArrowLeft'||e.code==='ArrowRight'))difficulty=(difficulty+(e.code==='ArrowLeft'?2:1))%3;
  if(e.code==='Enter'||e.code==='Space')oppAct();if(e.code==='Escape')setState('charselect');return;}
 if(state==='help'){setState('title');return;}
 if(state==='roundover'){if(e.code==='Enter'||e.code==='Space')nextRound();if(e.code==='Escape')setState('title');return;}
 if(state==='over'){if(e.code==='Enter'||e.code==='Space'||e.code==='KeyR')start(mode);if(e.code==='KeyC')toCharSelect();if(e.code==='Escape')setState('title');return;}
 if(state==='play'||state==='skill'){if(e.code==='Escape'){overlay='pause';ovSel=0;return;}if(state!=='play')return;
  if(mode==='2p'){const[L,Rb]=players;if(e.code==='KeyW')L.fire();if(e.code==='ArrowUp')Rb.fire();if(e.code==='KeyE'||e.code==='ShiftLeft')L.useSkill(Rb);if(e.code==='Enter'||e.code==='ShiftRight')Rb.useSkill(L);}
  else{const human=players[humanSide],ai=players[1-humanSide];if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')human.fire();if(e.code.startsWith('Shift')||e.code==='KeyE')human.useSkill(ai);}}});
addEventListener('keyup',e=>keys[e.code]=false);
function mpos(e){const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*LW/r.width,(e.clientY-r.top)*LH/r.height]}
const touchAim={}; // pointerId -> player index, for drag-to-aim / release-to-fire
function aimAt(b,x,y){const[lx,ly]=b.launcher();if(y<ly-5)b.angle=Math.max(-1.4,Math.min(1.4,Math.atan2(x-lx,ly-y)));else b.angle=Math.max(-1.4,Math.min(1.4,(x-lx)/120));}
function touchPlayer(x){if(state!=='play'||skillAnim||overlay)return -1;if(mode==='ai')return humanSide;if(mode==='2p')return x<480?0:1;return -1;}
cv.addEventListener('pointermove',e=>{const[x,y]=mpos(e);
 if(e.pointerType!=='mouse'){const pi=touchAim[e.pointerId];if(pi!=null&&state==='play'&&!skillAnim)aimAt(players[pi],x,y);if(pi!=null||!e.buttons)return;}
 if(overlay){const M=overlay==='pause'?PAUSE_MENU:SET_MENU;for(let i=0;i<M.length;i++)if(Math.abs(y-ovY(i,M.length))<22&&Math.abs(x-480)<190)ovSel=i;return;}
 if(state==='title'){for(let i=0;i<MENU.length;i++)if(Math.abs(y-(330+i*52))<22&&Math.abs(x-480)<190)menuSel=i;return;}
 if(state==='oppselect'){for(let i=0;i<OPP_MENU.length;i++)if(Math.abs(y-(300+i*52))<22&&Math.abs(x-480)<190)menuSel=i;return;}
 if(state==='charselect'){if(Math.abs(y-370)<170){if(Math.abs(x-260)<150)charSel=0;else if(Math.abs(x-700)<150)charSel=1;}return;}
 if(state!=='play'||mode!=='ai'||skillAnim)return;
 const b=players[humanSide];const[lx,ly]=b.launcher();if(y<ly-5)b.angle=Math.max(-1.4,Math.min(1.4,Math.atan2(x-lx,ly-y)));});
const MUTE_XY=[944,620];
function ovY(i,n){return 320-(n-1)*26+i*52;}
const FS_XY=[944,582],GEAR_XY=[944,544];
cv.addEventListener('pointerdown',e=>{const[x,y]=mpos(e);if(e.pointerType==='mouse'&&e.button!==0)return;
 if((x-MUTE_XY[0])**2+(y-MUTE_XY[1])**2<18*18){muted=!muted;return;}
 if((x-FS_XY[0])**2+(y-FS_XY[1])**2<16*16){toggleFull();return;}
 if((x-GEAR_XY[0])**2+(y-GEAR_XY[1])**2<16*16){if(!overlay){if(state==='play'||state==='skill'){overlay='pause';ovSel=0;}else openSettings(null);}return;}
 if(overlay){const M=overlay==='pause'?PAUSE_MENU:SET_MENU;for(let i=0;i<M.length;i++)if(Math.abs(y-ovY(i,M.length))<22&&Math.abs(x-480)<190){ovSel=i;ovAct(i);}return;}
 if(state==='title'){for(let i=0;i<MENU.length;i++)if(Math.abs(y-(330+i*52))<22&&Math.abs(x-480)<190){menuSel=i;titleAct();}return;}
 if(state==='charselect'){if(Math.abs(y-370)<170){if(Math.abs(x-260)<150){charSel=0;toOppSelect();sfx('confirm',()=>beep(500));return;}if(Math.abs(x-700)<150){charSel=1;toOppSelect();sfx('confirm',()=>beep(500));return;}}return;}
 if(state==='oppselect'){for(let i=0;i<OPP_MENU.length;i++)if(Math.abs(y-(300+i*52))<22&&Math.abs(x-480)<190){menuSel=i;oppAct();}return;}
 if(state==='help'){setState('title');return;}
 if(state==='roundover'){nextRound();return;}
 if(state==='over'){if(Math.abs(y-340)<16){if(x<340)start(mode);else if(x<620)toCharSelect();else setState('title');}return;}
 if(e.pointerType!=='mouse'){const pi=touchPlayer(x);if(pi>=0){touchAim[e.pointerId]=pi;try{cv.setPointerCapture(e.pointerId);}catch(_){}aimAt(players[pi],x,y);}return;}
 if(state==='play'&&mode==='ai')players[humanSide].fire();});
function touchEnd(e,fire){const pi=touchAim[e.pointerId];if(pi==null)return;delete touchAim[e.pointerId];if(fire&&state==='play'&&!skillAnim&&!overlay&&players[pi])players[pi].fire();}
cv.addEventListener('pointerup',e=>touchEnd(e,true));cv.addEventListener('pointercancel',e=>touchEnd(e,false));
// ---- on-screen touch pad (HTML, outside/around the canvas): hold arrows to aim, tap fire / skill ----
const tcEl=document.getElementById('tc');
function tcPress(act,down){const[L,Rb]=players;if(!L)return;
 if(act.startsWith('k:')){keys[act.slice(2)]=down;return;}if(!down||state!=='play'||overlay)return;
 const me=mode==='2p'?(act.endsWith('L')?L:Rb):players[humanSide],op=me===L?Rb:L;
 if(act.startsWith('fire'))me.fire();else if(act.startsWith('skill'))me.useSkill(op);}
if(tcEl){tcEl.querySelectorAll('button').forEach(bt=>{const a=()=>bt.dataset[mode==='2p'?'p2':'p1'];
  bt.addEventListener('pointerdown',e=>{e.preventDefault();bt.classList.add('on');try{bt.setPointerCapture(e.pointerId);}catch(_){}tcPress(a(),true);});
  const up=e=>{bt.classList.remove('on');const v=a();if(v&&v.startsWith('k:'))tcPress(v,false);};bt.addEventListener('pointerup',up);bt.addEventListener('pointercancel',up);bt.addEventListener('contextmenu',e=>e.preventDefault());});
 setInterval(()=>{const show=IS_TOUCH&&(state==='play'||state==='skill'||state==='intro')&&!overlay&&(mode==='ai'||mode==='2p');tcEl.classList.toggle('show',show);tcEl.classList.toggle('two',mode==='2p');
  const h=players[mode==='2p'?0:humanSide];const sk=tcEl.querySelectorAll('.sk');sk.forEach((b,i)=>{const p=mode==='2p'?players[i]:h;b.classList.toggle('ready',!!(p&&p.meter>=100));});},120);}
['gesturestart','gesturechange','dblclick'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
document.addEventListener('touchmove',e=>{if(e.touches.length>1||e.target===cv||(tcEl&&tcEl.contains(e.target)))e.preventDefault();},{passive:false});

function endRound(w){winner=w;{const youWin=w>=0&&(mode!=='ai'||w===humanSide);setTimeout(()=>{if(state==='roundover'||state==='over')voice(youWin?'win':'lose');},700);}if(w>=0){matchScore[w]++;sfx((w===0||mode!=='ai')?'win':'lose',()=>beep(w===0?880:200,0.5,'triangle'));}else sfx('lose',()=>beep(300,0.4,'triangle'));
 if(w>=0&&matchScore[w]>=BO){state='over';overT=0;}else{state='roundover';roundT=1.8;}}
function nextRound(){round++;players=[new Board(0),new Board(1)];particles=[];winner=-1;setState('intro');introT=0;}
function step(dt){timeT+=dt;shakeMag=Math.max(0,shakeMag-dt*14);transT=Math.max(0,transT-dt*3.2);
 for(const p of particles){p.x+=p.vx;p.y+=p.vy;
  if(p.ty==='dust'){p.vy-=0.01;p.l-=dt*0.9;}
  else if(p.ty==='shard'){p.vy+=0.14;p.rot+=p.rotV*dt;p.l-=dt*1.1;}
  else if(p.ty==='glint'){p.vy+=0.05;p.l-=dt*2.2;}
  else if(p.ty==='mspark'){p.vy+=0.02;p.l-=dt*1.8;}
  else{p.vy+=0.1;p.l-=dt*1.5;}}
 particles=particles.filter(p=>p.l>0);
 if(skillAnim){updateSkillAnim(dt);return;}
 if(state==='intro'){const t0=introT;introT+=dt;const X=v=>t0<v&&introT>=v;if(X(0.05)&&round<=2)voice('round'+round);if(X(1.5))voice('ready');if(X(2.2))voice('go');if(introT>=INTRO_DUR)state='play';return;}
 if(state==='roundover'){roundT-=dt;if(roundT<=0)nextRound();return;}
 if(state==='over'){overT+=dt;return;}
 if(state!=='play')return;const[L,Rb]=players;const A=1.6*dt;updFlip=!updFlip;
 if(mode==='aivai'){if(updFlip){aiUpdate(L,Rb,dt);aiUpdate(Rb,L,dt);}else{aiUpdate(Rb,L,dt);aiUpdate(L,Rb,dt);}}
 else if(mode==='2p'){if(keys.KeyA)L.angle-=A;if(keys.KeyD)L.angle+=A;if(keys.ArrowLeft)Rb.angle-=A;if(keys.ArrowRight)Rb.angle+=A;}
 else{const human=players[humanSide],ai=players[1-humanSide];if(keys.KeyA||keys.ArrowLeft)human.angle-=A;if(keys.KeyD||keys.ArrowRight)human.angle+=A;aiUpdate(ai,human,dt);}
 for(const b of players)b.angle=Math.max(-1.4,Math.min(1.4,b.angle));
 if(updFlip){L.update(dt,Rb);Rb.update(dt,L);}else{Rb.update(dt,L);L.update(dt,Rb);}
 if(L.dead||Rb.dead)endRound(L.dead&&Rb.dead?-1:(L.dead?1:0));}

// rendering
function bubble(x,y,c,r=R){if(artReady('bubble_'+c)){ctx.drawImage(ART['bubble_'+c].el,x-r,y-r,r*2,r*2);return;}
 const g=ctx.createRadialGradient(x-r*0.35,y-r*0.4,r*0.1,x,y,r);g.addColorStop(0,'#fff');g.addColorStop(0.25,COLORS[c]);g.addColorStop(1,shade(COLORS[c]));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r-1,0,7);ctx.fill();
 ctx.strokeStyle='rgba(0,0,0,0.25)';ctx.lineWidth=1;ctx.stroke();
 bubbleSymbol(x,y,c,r);
 ctx.fillStyle='rgba(255,255,255,0.85)';ctx.beginPath();ctx.arc(x-r*0.38,y-r*0.42,r*0.22,0,7);ctx.fill();}
function bubbleSymbol(x,y,c,r){const s=r*0.42;ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(255,255,255,0.92)';ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1;
 switch(c){
  case 0: for(let k=0;k<3;k++){const a=k/3*Math.PI*2-Math.PI/2;ctx.beginPath();ctx.arc(Math.cos(a)*s*0.55,Math.sin(a)*s*0.55,s*0.42,0,7);ctx.fill();ctx.stroke();} break;
  case 1: ctx.beginPath();ctx.moveTo(0,-s);ctx.quadraticCurveTo(s*0.9,s*0.3,0,s);ctx.quadraticCurveTo(-s*0.9,s*0.3,0,-s);ctx.fill();ctx.stroke(); break;
  case 2: ctx.beginPath();ctx.moveTo(0,s*0.7);ctx.bezierCurveTo(-s,0,-s*0.5,-s,0,-s*0.35);ctx.bezierCurveTo(s*0.5,-s,s,0,0,s*0.7);ctx.fill();ctx.stroke(); break;
  case 3: ctx.beginPath();for(let k=0;k<10;k++){const a=k/10*Math.PI*2-Math.PI/2,rr=k%2?s*0.4:s;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.stroke(); break;
  case 4: ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(s*0.8,0);ctx.lineTo(0,s);ctx.lineTo(-s*0.8,0);ctx.closePath();ctx.fill();ctx.stroke(); break;
  case 5: ctx.beginPath();ctx.moveTo(-s,-s*0.28);ctx.lineTo(s,-s*0.28);ctx.lineTo(s,s*0.28);ctx.lineTo(-s,s*0.28);ctx.closePath();
   ctx.moveTo(-s*0.28,-s);ctx.lineTo(s*0.28,-s);ctx.lineTo(s*0.28,s);ctx.lineTo(-s*0.28,s);ctx.closePath();ctx.fill();ctx.stroke(); break;
 }
 ctx.restore();}
// draws a bubble with optional rotation/alpha/non-uniform squash, used for falling/trail/pop fx
function bubbleFX(x,y,c,r,o={}){ctx.save();ctx.globalAlpha=o.alpha===undefined?1:Math.max(0,o.alpha);ctx.translate(x,y);
 if(o.rot)ctx.rotate(o.rot);if(o.sx!==undefined||o.sy!==undefined)ctx.scale(o.sx??1,o.sy??1);bubble(0,0,c,r);ctx.restore();}
// stone/metal rim overlay drawn on top of a normal bubble so garbage bubbles read as distinct
function garbageOverlay(x,y,r){ctx.save();ctx.translate(x,y);
 ctx.fillStyle='rgba(60,64,80,0.22)';ctx.beginPath();ctx.arc(0,0,r-1,0,7);ctx.fill();
 const g=ctx.createLinearGradient(0,-r,0,r);g.addColorStop(0,'#f2f4fa');g.addColorStop(0.45,'#8a90a4');g.addColorStop(1,'#3a3e4e');
 ctx.strokeStyle=g;ctx.lineWidth=4.5;ctx.beginPath();ctx.arc(0,0,r-3,0,7);ctx.stroke();
 ctx.strokeStyle='rgba(20,22,30,0.8)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r-0.8,0,7);ctx.stroke();ctx.beginPath();ctx.arc(0,0,r-5.4,0,7);ctx.stroke();
 for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;const rx=Math.cos(a)*(r-3),ry=Math.sin(a)*(r-3);ctx.fillStyle='#d8dce8';ctx.beginPath();ctx.arc(rx,ry,2.4,0,7);ctx.fill();ctx.fillStyle='#2a2d38';ctx.beginPath();ctx.arc(rx+0.6,ry+0.6,1,0,7);ctx.fill();}
 ctx.strokeStyle='rgba(30,32,40,0.7)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-r*0.35,-r*0.5);ctx.lineTo(-r*0.1,-r*0.15);ctx.lineTo(-r*0.3,r*0.15);ctx.stroke();
 ctx.restore();}
// grid bubble position incl. decaying neighbour-stick wobble spring + whole-board drop-in offset
function bubblePos(b,r,c,dropOffsetY){let[px,py]=b.pos(r,c);py+=dropOffsetY;const w=b.wobble[r+','+c];
 if(w){const age=timeT-w.t0;if(age<0.4){const decay=Math.exp(-age*9)*Math.cos(age*30);px+=w.dx*decay;py+=w.dy*decay;}}
 return[px,py];}
function shade(h){const n=parseInt(h.slice(1),16);return`rgb(${(n>>16)*0.45|0},${((n>>8)&255)*0.45|0},${(n&255)*0.45|0})`}
function tint(h,amt){const n=parseInt(h.slice(1),16),L=c=>Math.min(255,Math.round(c+(255-c)*amt));return`rgb(${L(n>>16)},${L((n>>8)&255)},${L(n&255)})`}
function factionFill(i){return[tint(P_INFO[i].col,0.6),P_INFO[i].col]}
function roundRect(x,y,w,h,r){ctx.beginPath();if(ctx.roundRect){ctx.roundRect(x,y,w,h,r);}else{ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}}
function emblem(x,y,i,s){if(artReady('emblem_'+i)){ctx.drawImage(ART['emblem_'+i].el,x-s,y-s,s*2,s*2);return;}
 ctx.save();ctx.translate(x,y);ctx.fillStyle=P_INFO[i].col;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();
 if(i===0){for(let k=0;k<6;k++){const a=k*Math.PI/3;ctx.lineTo(Math.cos(a)*s,Math.sin(a)*s)}}else{for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,rr=k%2?s*0.45:s;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}}
 ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
// ---- typography: N64-arcade display type. GenSenRounded2TW (Heavy/Bold) carries all
// Traditional Chinese + mixed UI text; Bungee is the chunky arcade word-mark face for
// bare Latin headline words (VS/ROUND/NEXT); Press Start 2P is the pixel-readout face
// for HUD score digits. All four are subset+bundled locally (see tools/subset_fonts.py,
// fonts/*.woff2) -- no system font is ever the primary choice, only the final fallback. ----
const FONT_FAMILY={heavy:'"GenSenHeavyTW",sans-serif',bold:'"GenSenBoldTW",sans-serif',arcade:'"Bungee",sans-serif',pixel:'"PressStart2P",monospace'};
const FONT_WEIGHT={heavy:'900',bold:'700',arcade:'400',pixel:'400'};
function setFont(size,key){ctx.font=`${FONT_WEIGHT[key]} ${size}px ${FONT_FAMILY[key]}`;}
function textWidth(t,size,key){setFont(size,key);return ctx.measureText(t).width;}
// size/weight hierarchy tokens so every screen draws from the same scale
const TX={
 title:{font:'heavy',size:72,fill:['#ffffff','#bfe0ff'],stroke:'rgba(10,30,60,0.85)',strokeW:7},
 h1:{font:'heavy',size:34,fill:['#fff9d2','#ffd93c'],stroke:'rgba(45,20,0,0.88)',strokeW:6},
 button:{font:'heavy',size:21,fill:['#ffffff','#d8e2ff'],stroke:'rgba(8,10,30,0.88)',strokeW:5},
 buttonSel:{font:'heavy',size:21,fill:['#fff7b0','#ffc93c'],stroke:'rgba(60,28,0,0.9)',strokeW:5},
 body:{font:'bold',size:17,fill:'#eef2ff',stroke:'rgba(0,0,0,0.55)',strokeW:2.5,shadow:0.3},
 h2:{font:'heavy',size:19,fill:['#fff5b0','#ffce3c'],stroke:'rgba(42,16,0,0.88)',strokeW:3.5,shadow:0.3},
 hudName:{font:'heavy',size:16,fill:['#ffffff','#e4ebff'],stroke:'rgba(0,0,0,0.85)',strokeW:3.5},
 hudLabel:{font:'bold',size:11,fill:'#ffffff',stroke:'rgba(0,0,0,0.75)',strokeW:2.5},
 hint:{font:'bold',size:13,fill:'#c8cfed',stroke:'rgba(0,0,0,0.75)',strokeW:2.5},
 cta:{font:'heavy',size:17,fill:['#fff7c0','#ffe066'],stroke:'rgba(40,16,0,0.88)',strokeW:4},
 subBody:{font:'bold',size:16,fill:'#eaefff',stroke:'rgba(0,0,0,0.65)',strokeW:3,shadow:0.3},
 popupLabel:{font:'heavy',size:27,fill:['#fff9c4','#ffb400'],stroke:'rgba(60,18,0,0.9)',strokeW:5},
 popupScore:{font:'heavy',size:18,fill:['#ffffff','#ffe07a'],stroke:'rgba(0,0,0,0.85)',strokeW:3.5},
 shout:{font:'heavy',size:34,fill:['#ffffff','#dfe9ff'],stroke:'rgba(0,0,0,0.9)',strokeW:7},
 hudNum:{font:'pixel',size:19,fill:['#fff6c0','#ffd84d'],stroke:'#3a2500',strokeW:4.5},
 roundLabel:{font:'arcade',size:20,fill:['#baffc0','#1fae35'],stroke:'#0c3d14',strokeW:4},
};
const POP_TIER_FILL=[null,['#fff6b0','#ffd93c'],['#ffe3b0','#ff8a1e'],['#ffd0d0','#ff4136']];
function drawText(t,x,y,o={}){
 const size=o.size??16,font=o.font??'bold',align=o.align??'center',baseline=o.baseline??'alphabetic';
 const stroke=o.stroke===undefined?'rgba(0,0,0,0.82)':o.stroke;
 const shadow=o.shadow===undefined?0.38:o.shadow;
 const fill=o.fill===undefined?'#fff':o.fill;
 let fs=size;ctx.textAlign=align;ctx.textBaseline=baseline;ctx.lineJoin='round';ctx.miterLimit=2;
 setFont(fs,font);
 if(o.maxW){let w=ctx.measureText(t).width;while(w>o.maxW&&fs>8){fs-=1;setFont(fs,font);w=ctx.measureText(t).width;}}
 if(shadow){ctx.save();ctx.globalAlpha=ctx.globalAlpha*shadow;ctx.fillStyle='#000';ctx.fillText(t,x+Math.max(1,fs*0.045),y+Math.max(2,fs*0.08));ctx.restore();}
 if(stroke){ctx.lineWidth=o.strokeW??Math.max(2,fs*0.16);ctx.strokeStyle=stroke;ctx.strokeText(t,x,y);}
 if(Array.isArray(fill)){const g=ctx.createLinearGradient(0,y-fs*0.84,0,y+fs*0.2);fill.forEach((c,i)=>g.addColorStop(fill.length>1?i/(fill.length-1):0,c));ctx.fillStyle=g;}
 else ctx.fillStyle=fill;
 ctx.fillText(t,x,y);
 return fs;}
function bg(){if(artReady('bg_pattern')){ctx.drawImage(ART['bg_pattern'].el,0,0,960,640);}
 else if(artReady('bg_center')){ctx.drawImage(ART['bg_center'].el,0,0,960,640);ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(0,0,960,640);}
 else{const g=ctx.createLinearGradient(0,0,0,640);g.addColorStop(0,'#0e1030');g.addColorStop(1,'#030410');ctx.fillStyle=g;ctx.fillRect(0,0,960,640);}
 // slow scrolling diagonal light sweep -- subtle parallax so the backdrop never feels frozen
 ctx.save();ctx.beginPath();ctx.rect(0,0,960,640);ctx.clip();ctx.globalAlpha=0.065;ctx.fillStyle='#9fd0ff';
 const off=(timeT*18)%72;for(let x=-800+off;x<960+800;x+=72){ctx.save();ctx.translate(x,0);ctx.rotate(0.3);ctx.fillRect(0,-300,16,1300);ctx.restore();}
 ctx.restore();
 for(let k=0;k<40;k++){ctx.fillStyle=`rgba(255,255,255,${0.04+0.04*Math.sin(timeT*1.3+k)})`;const tw=0.5+0.5*Math.sin(timeT*2+k*1.7);
  ctx.beginPath();ctx.arc((k*137)%960,(k*251+timeT*10)%640,(2+k%3)*(0.7+tw*0.6),0,7);ctx.fill();}}
function ornatePillar(x,y,w,h,bands){ctx.save();
 const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'#5a6180');g.addColorStop(0.18,'#c9d0e6');g.addColorStop(0.5,'#8891ae');g.addColorStop(0.82,'#c9d0e6');g.addColorStop(1,'#4a5170');
 ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
 const n=Math.round(h/40),bandH=h/n;
 for(let k=0;k<n;k++){const by=y+k*bandH;const col=bands[k%bands.length];
  const bg2=ctx.createLinearGradient(x,0,x+w,0);bg2.addColorStop(0,shade(col));bg2.addColorStop(0.5,col);bg2.addColorStop(1,shade(col));
  ctx.fillStyle=bg2;ctx.fillRect(x,by+bandH*0.15,w,bandH*0.3);}
 ctx.fillStyle='rgba(0,0,0,0.3)';
 for(let k=0;k<h;k+=24){ctx.beginPath();ctx.arc(x+4,y+k,2,0,7);ctx.fill();ctx.beginPath();ctx.arc(x+w-4,y+k,2,0,7);ctx.fill();}
 ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,h);ctx.restore();}
function marqueeLights(x,w,y,h,speed){const spacing=22,n=Math.round(h/spacing);
 for(let k=0;k<n;k++){const ly=y+k*spacing+11;const phase=((k/n-timeT*speed)%1+1)%1;const on=phase<0.3;
  const g=ctx.createRadialGradient(x,ly,0,x,ly,on?6:3);g.addColorStop(0,on?'#fff6c0':'rgba(255,220,100,0.25)');g.addColorStop(1,'rgba(255,200,60,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,ly,on?6:3,0,7);ctx.fill();
  ctx.fillStyle=on?'#fff3a0':'rgba(140,110,40,0.7)';ctx.beginPath();ctx.arc(x,ly,2,0,7);ctx.fill();}}
function drawPillars(){const y=TOPBAR_H,h=640-TOPBAR_H;
 if(artReady('pillar_side')){ctx.drawImage(ART['pillar_side'].el,0,y,PILLAR_W,h);ctx.save();ctx.translate(960,0);ctx.scale(-1,1);ctx.drawImage(ART['pillar_side'].el,0,y,PILLAR_W,h);ctx.restore();}
 else{ornatePillar(0,y,PILLAR_W,h,['#e8c23a','#2f7cff']);ornatePillar(960-PILLAR_W,y,PILLAR_W,h,['#e8c23a','#2f7cff']);}
 marqueeLights(PILLAR_W/2,PILLAR_W,y+6,h-12,0.35);marqueeLights(960-PILLAR_W/2,PILLAR_W,y+6,h-12,0.35);
 const cx=480-CENTER_W/2;
 if(artReady('pillar_center')){ctx.drawImage(ART['pillar_center'].el,cx,y,CENTER_W,h);}
 else{ornatePillar(cx,y,CENTER_W,h,['#ff4136','#ffdc00','#2f7cff']);}
 marqueeLights(cx+4,8,y+6,h-12,-0.4);marqueeLights(cx+CENTER_W-4,8,y+6,h-12,0.4);}
function drawTopBar(){
 if(artReady('topbar')){ctx.drawImage(ART['topbar'].el,0,0,960,TOPBAR_H);}
 else{const g=ctx.createLinearGradient(0,0,0,TOPBAR_H);g.addColorStop(0,'#fff3b0');g.addColorStop(0.45,'#e8b93a');g.addColorStop(0.55,'#c6901a');g.addColorStop(1,'#8a5f0e');
  ctx.fillStyle=g;ctx.fillRect(0,0,960,TOPBAR_H);
  ctx.fillStyle='#2f7cff';for(let x=0;x<960;x+=58)ctx.fillRect(x,TOPBAR_H*0.3,14,TOPBAR_H*0.4);
  ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=2;ctx.strokeRect(1,1,958,TOPBAR_H-2);}
 emblem(26,TOPBAR_H/2,0,13);emblem(934,TOPBAR_H/2,1,13);
 drawText(P_INFO[0].name,46,19,{...TX.hudName,align:'left',maxW:150});drawText(String(Math.round(players[0].scoreDisp)),46,49,{...TX.hudNum,align:'left',maxW:150});
 drawText(P_INFO[1].name,914,19,{...TX.hudName,align:'right',maxW:150});drawText(String(Math.round(players[1].scoreDisp)),914,49,{...TX.hudNum,align:'right',maxW:150});
 drawText('ROUND '+round,480,37,{...TX.roundLabel,maxW:220});
 for(let s=0;s<2;s++)for(let k=0;k<BO;k++){const won=k<matchScore[s];const base=s===0?430:530;const px=s===0?base-k*14:base+k*14;
  ctx.beginPath();ctx.arc(px,48,4,0,7);ctx.fillStyle=won?P_INFO[s].col:'rgba(255,255,255,0.25)';ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1;ctx.stroke();}}
function gearBase(x,y,r,teethN,baseCol,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);
 ctx.fillStyle=shade(baseCol);
 for(let k=0;k<teethN;k++){const a=k/teethN*Math.PI*2;ctx.save();ctx.rotate(a);ctx.fillRect(-3,-r-7,6,10);ctx.restore();}
 const g=ctx.createRadialGradient(-r*0.3,-r*0.3,2,0,0,r);g.addColorStop(0,'#eef2fb');g.addColorStop(0.55,baseCol);g.addColorStop(1,shade(baseCol));
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=2;ctx.stroke();
 for(let k=0;k<6;k++){const a=k/6*Math.PI*2;ctx.beginPath();ctx.arc(Math.cos(a)*r*0.6,Math.sin(a)*r*0.6,2.4,0,7);ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fill();}
 ctx.beginPath();ctx.arc(0,0,r*0.28,0,7);ctx.fillStyle='rgba(255,255,255,0.5)';ctx.fill();ctx.restore();}
function arrowPointer(len,metalColor){const w=9;
 const g=ctx.createLinearGradient(-w,0,w,0);g.addColorStop(0,shade(metalColor));g.addColorStop(0.5,'#fff');g.addColorStop(1,shade(metalColor));
 ctx.fillStyle=g;ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1.5;
 ctx.beginPath();ctx.moveTo(-w*0.5,0);ctx.lineTo(-w*0.5,-len+16);ctx.lineTo(-w*1.6,-len+16);ctx.lineTo(0,-len);ctx.lineTo(w*1.6,-len+16);ctx.lineTo(w*0.5,-len+16);ctx.lineTo(w*0.5,0);ctx.closePath();ctx.fill();ctx.stroke();}
function launcherTip(b){const[lx,ly]=b.launcher();return[lx+Math.sin(b.angle)*ARROW_LEN,ly-Math.cos(b.angle)*ARROW_LEN];}
function drawLauncherMachine(b){const[lx,ly]=b.launcher();const P=P_INFO[b.i];
 const rec=b.recoil*b.recoil,pull=rec*6; // quadratic decay -> snappy recoil kick that eases back to rest
 if(artReady('launcher_base')){drawImgCentered('launcher_base',lx,ly+14,84,50);}else{gearBase(lx,ly+14,18,12,'#9099b8',b.gearRot);}
 ctx.save();ctx.fillStyle='#7d85a0';ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=1;ctx.fillRect(lx-6,ly-8+pull,12,24);ctx.strokeRect(lx-6,ly-8+pull,12,24);ctx.restore();
 ctx.save();ctx.translate(lx,ly+pull);ctx.rotate(b.angle);
 if(artReady('launcher_arrow')){ctx.drawImage(ART['launcher_arrow'].el,-18,-ARROW_LEN-16+pull*1.6,36,ARROW_LEN+16);}else{arrowPointer(ARROW_LEN-pull*1.6,P.col);}
 ctx.restore();}
function nextBubblePos(b){const[lx,ly]=b.launcher();const nx=b.i===0?lx+72:lx-72;return[nx,ly-6+11];}
function drawNextBox(b){const[lx,ly]=b.launcher();const nx=b.i===0?lx+72:lx-72;const ny=ly-6;const w=54,h=48;
 if(artReady('next_box')){drawImgCentered('next_box',nx,ny,w,h);}
 else{ctx.save();const g=ctx.createLinearGradient(0,ny-h/2,0,ny+h/2);g.addColorStop(0,'#fff');g.addColorStop(1,'#dfe3ef');ctx.fillStyle=g;
  roundRect(nx-w/2,ny-h/2,w,h,8);ctx.fill();ctx.strokeStyle='#223';ctx.lineWidth=2;ctx.stroke();ctx.restore();}
 drawText('NEXT',nx,ny-h/2+13,{...TX.hudLabel,size:10,fill:'#d8242c',stroke:null,shadow:0,maxW:w-6});
 if(!(b.curAnim&&b.curAnim.t<b.curAnim.dur*0.6))bubble(nx,ny+11,b.next,12);}
function drawRail(ox,y,w){ctx.save();
 const g=ctx.createLinearGradient(0,y-4,0,y+4);g.addColorStop(0,'#eef1f8');g.addColorStop(0.5,'#8991ab');g.addColorStop(1,'#444a60');
 ctx.fillStyle=g;ctx.fillRect(ox,y-4,w,8);ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=1;ctx.strokeRect(ox,y-4,w,8);
 ctx.save();ctx.beginPath();ctx.rect(ox,y-4,w,3);ctx.clip();ctx.fillStyle='#ffdc00';ctx.fillRect(ox,y-4,w,3);ctx.fillStyle='#ff4136';
 for(let x=ox-8;x<ox+w;x+=16){ctx.save();ctx.translate(x,y-4);ctx.rotate(-0.6);ctx.fillRect(0,-4,8,12);ctx.restore();}ctx.restore();ctx.restore();}
function badge(x,y,n,col,arrow){ctx.save();ctx.beginPath();ctx.arc(x,y,13,0,7);ctx.fillStyle='rgba(10,12,24,0.75)';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.stroke();
 drawText(arrow+n,x,y+4,{...TX.hudLabel,size:12,fill:'#ffd84d',maxW:22});ctx.restore();}
function drawCenterOverlay(){const cx=480,midY=(TOPBAR_H+8+FH/2);const L=players[0],Rb=players[1];
 if(L.pending>0)badge(cx,midY-34,L.pending,P_INFO[0].col,'◀');
 if(Rb.pending>0)badge(cx,midY+34,Rb.pending,P_INFO[1].col,'▶');
 const label=mode==='2p'?'雙人對戰':mode==='ai'?'電腦：'+DIFF[difficulty]:'AI 對 AI';
 const lw=textWidth(label,11,'bold');
 ctx.fillStyle='rgba(8,10,22,0.72)';roundRect(cx-lw/2-10,560-12,lw+20,20,9);ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;roundRect(cx-lw/2-10,560-12,lw+20,20,9);ctx.stroke();
 drawText(label,cx,560,{...TX.hudLabel,maxW:200});}
function drawChibiFallback(cx,by,i,expr){const P=P_INFO[i];ctx.save();ctx.translate(cx,by);
 ctx.fillStyle=P.col;roundRect(-22,-66,44,58,13);ctx.fill();ctx.strokeStyle=P.dark;ctx.lineWidth=2;ctx.stroke();
 const hg=ctx.createRadialGradient(-6,-100,2,0,-94,22);hg.addColorStop(0,'#ffe3c2');hg.addColorStop(1,'#e8b98a');
 ctx.fillStyle=hg;ctx.beginPath();ctx.arc(0,-94,22,0,7);ctx.fill();ctx.strokeStyle='#8a5a30';ctx.lineWidth=1.5;ctx.stroke();
 ctx.fillStyle='#222';ctx.beginPath();ctx.arc(-7,-94,2.6,0,7);ctx.arc(7,-94,2.6,0,7);ctx.fill();
 ctx.strokeStyle='#5a2d1a';ctx.lineWidth=2;ctx.beginPath();
 if(expr==='happy')ctx.arc(0,-87,7,0.15*Math.PI,0.85*Math.PI);
 else if(expr==='sad')ctx.arc(0,-80,7,1.15*Math.PI,1.85*Math.PI);
 else{ctx.moveTo(-5,-85);ctx.lineTo(5,-85);}
 ctx.stroke();
 ctx.fillStyle='rgba(0,0,0,0.55)';roundRect(-26,-12,52,17,4);ctx.fill();
 drawText(P.name.slice(0,2),0,1,{...TX.hudLabel,maxW:48});ctx.restore();}
// idle bob + blink-squash + fire hop/lean + combo bounce + danger shake, all driven by timeT/board
// timers (never by wall-clock) so headless step()-driven tools render identical frames every run.
// All offsets are a few px / a few % scale -- drawImgContain still never stretches non-uniformly beyond that.
function drawCharacterStand(b){const i=b.i,expr=b._expr||'normal';
 const bottomY=b.oy+FH-2,w=110,h=165,bx=i===0?b.ox+6:b.ox+FW-6-w;const ak='anim_'+i+'_'+expr;
 // idle bob + quick hop/lean kick on fire + tiny shake while in danger -- all a few px / a few
 // degrees so drawImgContain's aspect-preserving scale underneath is never visibly stretched.
 const bob=Math.sin(timeT*1.6+b.standBobPh)*1.6;
 const hop=-b.hopT*b.hopT*8;
 const lean=(i===0?1:-1)*b.hopT*0.05;
 const shakeX=b.inDanger?Math.sin(timeT*27)*1.2:0;
 ctx.save();ctx.translate(bx+w/2+shakeX,bottomY);ctx.rotate(lean);ctx.translate(-(bx+w/2),bob+hop-bottomY);
 if(artReady(ak)){const im=ART[ak].el,fw=im.naturalWidth/ANIM_FRAMES,fh=im.naturalHeight,s=Math.min(w/fw,h/fh),dw=fw*s,dh=fh*s;
  const f=Math.floor(timeT*ANIM_FPS+i*5)%ANIM_FRAMES;ctx.drawImage(im,f*fw,0,fw,fh,bx+(w-dw)/2,bottomY-dh,dw,dh);}
 else{const key='stand_'+i+'_'+expr;const k2=artReady(key)?key:artReady('char_full_'+i)?'char_full_'+i:null;
  if(k2){drawImgContain(k2,bx,bottomY-h,w,h,.5,1);}else{ctx.save();ctx.translate(bx+w/2,bottomY);drawChibiFallback(0,0,i,expr);ctx.restore();}}
 ctx.restore();}
function menuItemBg(x,y,w,h,hover){const key=hover?'button_hover':'button_normal';if(artReady(key)){ctx.drawImage(ART[key].el,x,y,w,h);}else{ctx.fillStyle=hover?'rgba(255,255,255,0.18)':'rgba(255,255,255,0.05)';ctx.fillRect(x,y,w,h);}
 if(hover)shineSweep(x,y,w,h,150);}
// Snapshots the just-painted region into a scratch canvas and composites the sweep there with
// source-atop, so the highlight only lights up pixels already opaque (the button pill / logo
// glyphs) instead of bleeding a visible rectangle over the transparent art corners/background.
let shineCv=null;
function shineSweep(x,y,w,h,speed=120){const t=ctx.getTransform();
 const dx=Math.round(x*t.a+t.e),dy=Math.round(y*t.d+t.f),dw=Math.round(w*t.a),dh=Math.round(h*t.d);
 if(dw<=0||dh<=0)return;
 if(!shineCv)shineCv=document.createElement('canvas');
 shineCv.width=dw;shineCv.height=dh;const sctx=shineCv.getContext('2d');
 sctx.drawImage(cv,dx,dy,dw,dh,0,0,dw,dh);
 sctx.globalCompositeOperation='source-atop';const off=(timeT*speed)%(w+100)-50;
 const g=sctx.createLinearGradient((off-30)*t.a,0,(off+30)*t.a,dh);
 g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(0.5,'rgba(255,255,255,0.4)');g.addColorStop(1,'rgba(255,255,255,0)');
 sctx.fillStyle=g;sctx.fillRect(0,0,dw,dh);
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(shineCv,dx,dy);ctx.restore();}
function dangerBeacon(x,y,col){ctx.save();ctx.translate(x,y);const a=timeT*4;
 ctx.fillStyle='#2a2a38';ctx.beginPath();ctx.ellipse(0,3,12,5,0,0,7);ctx.fill();
 ctx.save();ctx.rotate(a);const g=ctx.createLinearGradient(0,0,34,0);g.addColorStop(0,'rgba(255,50,40,0.85)');g.addColorStop(0.5,'rgba(255,50,40,0.3)');g.addColorStop(1,'rgba(255,50,40,0)');
 ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,34,-0.3,0.3);ctx.closePath();ctx.fill();
 ctx.save();ctx.rotate(Math.PI);ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,34,-0.3,0.3);ctx.closePath();ctx.fill();ctx.restore();
 ctx.restore();
 const pulse=0.6+0.4*Math.sin(timeT*10);
 const gl=ctx.createRadialGradient(0,0,0,0,0,13);gl.addColorStop(0,`rgba(255,80,60,${0.55*pulse})`);gl.addColorStop(1,'rgba(255,80,60,0)');
 ctx.fillStyle=gl;ctx.beginPath();ctx.arc(0,0,13,0,7);ctx.fill();
 ctx.fillStyle=`rgba(255,${40+pulse*50|0},40,0.95)`;ctx.beginPath();ctx.arc(0,0,7,0,7);ctx.fill();
 ctx.fillStyle=`rgba(255,220,210,${0.5+0.4*pulse})`;ctx.beginPath();ctx.arc(-2,-2,2.4,0,7);ctx.fill();
 ctx.restore();}
function drawStamp(b,win){const age=state==='over'?overT:1.8-roundT;const p=Math.min(1,age/0.35);const sc=easeOutBack(p);
 ctx.save();ctx.translate(b.ox+FW/2,b.oy+FH*0.75);ctx.rotate(-0.18*(b.i===0?1:-1));ctx.scale(Math.max(0.01,sc),Math.max(0.01,sc));ctx.globalAlpha=Math.min(1,p*1.6);
 const col=win?'#2ecc40':'#ff4136';ctx.strokeStyle=col;ctx.lineWidth=6;roundRect(-110,-34,220,68,10);ctx.stroke();
 drawText(win?'WIN':'LOSE',0,16,{font:'arcade',size:48,fill:[win?'#baffc0':'#ffc9c6',col],stroke:'rgba(10,2,2,0.9)',strokeW:6,maxW:200});
 ctx.restore();}
function drawIntro(){const t=introT;ctx.save();
 const dim=t<2.5?0.35:0.35*(1-(t-2.5)/0.3);ctx.fillStyle=`rgba(0,0,10,${Math.max(0,dim)})`;ctx.fillRect(0,TOPBAR_H,960,640-TOPBAR_H);
 const pop=(t0,dur)=>{const q=(t-t0)/dur;return q<0||q>1?null:q;};
 let q=pop(0,1.55);if(q!==null){const sc=easeOutBack(Math.min(1,q/0.3)),al=q>0.8?1-(q-0.8)/0.2:1;ctx.save();ctx.globalAlpha=al;ctx.translate(480,300);ctx.scale(sc,sc);
  drawText('ROUND '+round,0,0,{font:'arcade',size:64,fill:['#fff6b0','#ffb400'],stroke:'rgba(55,25,0,0.9)',strokeW:9,maxW:700});ctx.restore();}
 q=pop(1.5,0.75);if(q!==null){const y=300-Math.abs(Math.sin(q*Math.PI*2.2))*30*(1-q),al=q>0.8?1-(q-0.8)/0.2:1;ctx.save();ctx.globalAlpha=al;ctx.translate(480,y);
  drawText('READY',0,0,{font:'arcade',size:60,fill:['#bff4ff','#27a6ff'],stroke:'rgba(0,20,50,0.9)',strokeW:9,maxW:700});ctx.restore();}
 q=pop(2.2,0.6);if(q!==null){const sc=q<0.25?easeOutBack(q/0.25)*1.3:1.3+q*0.4,al=q>0.6?1-(q-0.6)/0.4:1;ctx.save();ctx.globalAlpha=al;ctx.translate(480,300);ctx.scale(sc,sc);
  drawText('GO!',0,0,{font:'arcade',size:72,fill:['#d8ffb0','#3fd84a'],stroke:'rgba(0,40,0,0.9)',strokeW:10,maxW:700});ctx.restore();}
 ctx.restore();}
function drawBoard(b){const P=P_INFO[b.i];
 const lostRound=winner>=0&&(state==='roundover'||state==='over')&&winner!==b.i;
 const nearDanger=!b.dead&&b.lowestY()+R>b.lineY()-RH*1.6;
 b._expr=(b.dead||lostRound)?'sad':b.exprT>0?'happy':nearDanger?'sad':'normal';
 const dropOffsetY=b.dropAnim?-RH*b.dropAnim.n*(1-easeOutBack(Math.min(1,b.dropAnim.t/b.dropAnim.dur))):0;
 ctx.save();ctx.beginPath();ctx.rect(b.ox,b.oy,FW,FH);ctx.clip();
 if(artReady('bg_'+b.i)){drawImgRect('bg_'+b.i,b.ox,b.oy,FW,FH);}else{const fg=ctx.createLinearGradient(0,b.oy,0,b.oy+FH);fg.addColorStop(0,'rgba(255,255,255,0.10)');fg.addColorStop(1,P.dark+'99');ctx.fillStyle=fg;ctx.fillRect(b.ox,b.oy,FW,FH);}
 if(b.ceil>0){if(artReady('ceilingbar')){drawImgRect('ceilingbar',b.ox,b.oy,FW,b.ceil);}else{ctx.fillStyle='#555a7a';ctx.fillRect(b.ox,b.oy,FW,b.ceil);}ctx.fillStyle='#8890b8';ctx.fillRect(b.ox,b.oy+b.ceil-4,FW,4);}
 if(b.flash>0){ctx.fillStyle=`rgba(255,255,255,${b.flash*0.5})`;ctx.fillRect(b.ox,b.oy,FW,FH)}
 b.grid.forEach((row,r)=>row.forEach((v,c)=>{if(v>=0&&c<b.nc(r)){let[px,py]=bubblePos(b,r,c,dropOffsetY);const isG=b.garb.has(r+','+c);if(isG&&b.garbT>0){const q=1-b.garbT/0.5;py-=(1-easeOutBack(q))*(RH*2+py-b.oy);}bubble(px,py,v);if(isG)garbageOverlay(px,py,R);}}));
 for(const f of b.fall)bubbleFX(f.x,f.y,f.c,R,{rot:f.rot,alpha:f.alpha});
 for(const a of b.popAnim){const p=a.age/a.dur;let sx,sy,al;
  if(p<0.6){const q=p/0.6;sy=1-0.45*q;sx=1+0.25*q;al=1;}else{const q=(p-0.6)/0.4;sy=0.55*(1-q);sx=1.25*(1-q);al=1-q;}
  bubbleFX(a.x,a.y+dropOffsetY,a.c,R,{sx,sy,alpha:al});}
 if(nearDanger&&!b.dead){const pulse=0.08+0.1*(0.5+0.5*Math.sin(timeT*6));ctx.fillStyle=`rgba(255,20,20,${pulse})`;ctx.fillRect(b.ox,b.oy,FW,FH);}
 for(const t of b.pops){const age=1.1-t.life,sc=popScale(age);
  ctx.save();ctx.globalAlpha=Math.min(1,t.life*2);ctx.translate(t.x,t.y);ctx.scale(sc,sc);
  if(t.label){drawText(t.label,0,0,{...TX.popupLabel,fill:POP_TIER_FILL[t.tier]||TX.popupLabel.fill,maxW:FW-40});
   drawText('+'+t.pts,0,23,{...TX.popupScore,maxW:FW-40});}
  else{drawText('+'+t.pts,0,6,{...TX.popupScore,maxW:FW-40});}
  if(t.combo>=2)drawText(t.combo+' COMBO',0,(t.label?45:24),{font:'arcade',size:15,fill:['#fff3b0','#ff8a1e'],stroke:'rgba(50,16,0,0.9)',strokeW:3.5,maxW:FW-30});
  ctx.restore();}
 drawRail(b.ox,b.lineY(),FW);
 const[lx,ly]=b.launcher();
 if(!b.dead){ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=2;ctx.setLineDash([3,9]);ctx.beginPath();ctx.moveTo(lx,ly);
  let x=lx,y=ly,vx=Math.sin(b.angle),vy=-Math.cos(b.angle);for(let k=0;k<45;k++){x+=vx*4;y+=vy*4;if(x<b.ox+R||x>b.ox+FW-R){vx=-vx}}ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);}
 drawLauncherMachine(b);
 const tip=launcherTip(b);
 if(b.curAnim){const p=Math.min(1,b.curAnim.t/b.curAnim.dur),e=easeOutCubic(p);const[bx0,by0]=nextBubblePos(b);
  const x=bx0+(tip[0]-bx0)*e,y=by0+(tip[1]-by0)*e-Math.sin(e*Math.PI)*16;bubble(x,y,b.cur);}
 else if(!b.shot&&!b.dead)bubble(tip[0],tip[1],b.cur);
 drawNextBox(b);
 for(const t of b.shotTrail)bubbleFX(t.x,t.y,t.c,R*0.92,{alpha:Math.max(0,t.a)*0.45});
 if(b.shot)bubble(b.shot.x,b.shot.y,b.shot.c);
 if(b.dead){ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(b.ox,b.oy,FW,FH);}
 if((state==='roundover'||state==='over')&&winner>=0)drawStamp(b,winner===b.i);
 ctx.restore();ctx.strokeStyle=P.col;ctx.lineWidth=3;ctx.strokeRect(b.ox,b.oy,FW,FH);
 if(nearDanger&&!b.dead)dangerBeacon(b.ox+FW/2,b.oy-7,P.col);
 // meter
 const my=b.oy+FH+14,ready=b.meter>=100;ctx.fillStyle='#222844';ctx.fillRect(b.ox,my,FW,16);const mg=ctx.createLinearGradient(b.ox,0,b.ox+FW,0);mg.addColorStop(0,P.dark);mg.addColorStop(1,ready?'#fff':P.col);
 ctx.fillStyle=mg;ctx.fillRect(b.ox,my,FW*b.meter/100,16);
 if(ready){const glow=0.35+0.3*Math.sin(timeT*6);ctx.save();ctx.globalAlpha=glow;ctx.fillStyle='#fff';ctx.fillRect(b.ox,my,FW,16);ctx.restore();}
 drawText(ready?'技能就緒！'+skillKey(b.i):'技能 '+Math.floor(b.meter)+'%',b.ox+FW/2,my+13,{...TX.hudLabel,size:12,fill:ready&&Math.sin(timeT*10)>0?'#ff0':'#fff',maxW:FW-10});
 if(artReady('meterframe_'+b.i))drawImgRect('meterframe_'+b.i,b.ox-4,my-4,FW+8,24);
 if(ready){ctx.save();ctx.strokeStyle=`rgba(255,255,160,${0.4+0.4*Math.sin(timeT*6)})`;ctx.lineWidth=2;ctx.strokeRect(b.ox-3,my-3,FW+6,22);ctx.restore();}}
function skillKey(i){if(mode==='aivai'||(mode==='ai'&&i!==humanSide))return'';if(mode==='2p')return i?'(Enter)':'(E)';return'(Shift/E)'}
function renderSkillAnim(){const a=skillAnim;if(!a)return;const t=a.t,cb=a.caster;
 const dimIn=Math.min(1,t/SK_FLASH),dimOut=t>SK_APPLY?Math.max(0,1-(t-SK_APPLY)/(SK_DUR-SK_APPLY)):1,dim=Math.min(dimIn,dimOut);
 ctx.fillStyle=`rgba(5,6,18,${0.62*dim})`;ctx.fillRect(0,0,960,640);
 if(t<SK_FLASH*1.6){const f=1-Math.min(1,t/(SK_FLASH*1.6));ctx.fillStyle=`rgba(255,255,255,${f*0.85})`;ctx.fillRect(0,0,960,640);}
 const BW=560,BH=200,cy=320,fromLeft=cb.i===0;
 const startX=fromLeft?-BW/2:960+BW/2,endX=fromLeft?960+BW/2:-BW/2;let bx;
 if(t<SK_SLIDE_IN){bx=startX+(480-startX)*easeOutCubic(Math.max(0,Math.min(1,t/SK_SLIDE_IN)));}
 else if(t<SK_HOLD){bx=480;}
 else if(t<SK_SLIDE_OUT){bx=480+(endX-480)*easeInCubic(Math.max(0,Math.min(1,(t-SK_HOLD)/(SK_SLIDE_OUT-SK_HOLD))));}
 else bx=endX;
 if(t<SK_SLIDE_OUT){ctx.save();ctx.globalAlpha=0.45*dim;ctx.strokeStyle=P_INFO[cb.i].col;ctx.lineWidth=4;
  for(let k=0;k<10;k++){const yy=cy-BH/2+16+k*(BH-32)/9;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(960,yy+(fromLeft?-14:14));ctx.stroke();}
  ctx.restore();
  const ckey=artReady('cutin4_'+cb.i)?'cutin4_'+cb.i:artReady('cutin_'+cb.i)?'cutin_'+cb.i:null;
  if(ckey&&ckey.startsWith('cutin4')){const im=ART[ckey].el,_s=Math.min(960/im.naturalWidth,300/im.naturalHeight),dh=im.naturalHeight*_s,dw=im.naturalWidth*_s;
   const gb=ctx.createLinearGradient(0,cy-BH/2,0,cy+BH/2);gb.addColorStop(0,'rgba(0,0,0,0)');gb.addColorStop(0.5,P_INFO[cb.i].col+'88');gb.addColorStop(1,'rgba(0,0,0,0)');
   ctx.fillStyle=gb;ctx.fillRect(0,cy-BH/2,960,BH);ctx.drawImage(im,bx-dw/2,cy-dh/2-20,dw,dh);}
  else{
  ctx.save();ctx.beginPath();ctx.rect(bx-BW/2,cy-BH/2,BW,BH);ctx.clip();
  if(ckey){drawImgContain(ckey,bx-BW/2,cy-BH/2,BW,BH,.5,1);}
  else{ctx.fillStyle=P_INFO[cb.i].dark;ctx.fillRect(bx-BW/2,cy-BH/2,BW,BH);emblem(bx,cy,cb.i,60);}
  ctx.restore();ctx.strokeStyle=P_INFO[cb.i].col;ctx.lineWidth=5;ctx.strokeRect(bx-BW/2,cy-BH/2,BW,BH);}
  const textAlpha=t<SK_SLIDE_IN?Math.min(1,(t-SK_FLASH)/(SK_SLIDE_IN-SK_FLASH)):t>SK_HOLD?Math.max(0,1-(t-SK_HOLD)/(SK_SLIDE_OUT-SK_HOLD)):1;
  ctx.save();ctx.globalAlpha=Math.max(0,textAlpha);
  drawText(SKILL_LINE[cb.i],480,cy+BH/2+54,{...TX.shout,fill:['#fffdf0',P_INFO[cb.i].col],maxW:880});ctx.restore();}
 if(a.flying)for(const p of a.bubbles){const lt=(t-SK_FLY_START-p.delay)/p.dur;if(lt<0||lt>1)continue;const e=easeOutCubic(Math.min(1,lt));
  const x=p.sx+(p.tx-p.sx)*e,y=p.sy+(p.ty-p.sy)*e-Math.sin(e*Math.PI)*70;bubble(x,y,p.c,13);}}
function menuLabel(m,i,sel,x,y,color){const sc=sel?1+0.035*Math.sin(timeT*8):1;ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);
 drawText((sel?'▶　':'')+m,0,0,{...(sel?TX.buttonSel:TX.button),fill:color??(sel?TX.buttonSel.fill:TX.button.fill),maxW:340});ctx.restore();}
// ---- guide screen: section headers + inline colour-coded key/segment runs on top
// of the plain body style, drawn left-to-right from a shared x cursor. ----
const GK_KEY={fill:'#8fe8ff',stroke:'rgba(0,28,36,0.85)',strokeW:2.6};
const GK_TAG={fill:['#fff6c0','#ffd23c'],stroke:'rgba(45,18,0,0.9)',strokeW:3};
const GK_GREEN={fill:'#7bed8f',stroke:'rgba(0,22,4,0.85)',strokeW:2.6};
const GK_BLUE={fill:'#7ab8ff',stroke:'rgba(0,12,32,0.85)',strokeW:2.6};
function seg(t,style){return{t,style};}
function drawRich(parts,x,y){let cx=x;for(const p of parts){const o={...TX.body,...(p.style||{}),align:'left'};setFont(o.size,o.font);const w=ctx.measureText(p.t).width;drawText(p.t,cx,y,o);cx+=w;}}
function render(){ctx.setTransform(RS,0,0,RS,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';renderGame();
 if(transT>0){ctx.fillStyle=`rgba(4,6,16,${Math.min(0.85,transT*0.85)})`;ctx.fillRect(0,0,LW,LH);}
 renderOverlay();renderCornerBtns();}
function renderCornerBtns(){ctx.save();for(const[[x,y],kind]of[[FS_XY,'fs'],[GEAR_XY,'gear']]){ctx.fillStyle='rgba(0,0,0,0.45)';ctx.beginPath();ctx.arc(x,y,13,0,7);ctx.fill();ctx.strokeStyle='#ffe58a';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2.2;ctx.beginPath();
 if(kind==='fs'){const a=6,b=3;for(const[sx,sy]of[[-1,-1],[1,-1],[1,1],[-1,1]]){ctx.moveTo(x+sx*a,y+sy*(a-b));ctx.lineTo(x+sx*a,y+sy*a);ctx.lineTo(x+sx*(a-b),y+sy*a);}ctx.stroke();}
 else{ctx.arc(x,y,4.5,0,7);ctx.stroke();for(let k=0;k<8;k++){const an=k*Math.PI/4;ctx.moveTo(x+Math.cos(an)*6,y+Math.sin(an)*6);ctx.lineTo(x+Math.cos(an)*8.5,y+Math.sin(an)*8.5);}ctx.stroke();}}ctx.restore();}
function renderOverlay(){if(!overlay)return;ctx.save();ctx.fillStyle='rgba(4,8,24,0.72)';ctx.fillRect(0,0,LW,LH);
 const M=overlay==='pause'?PAUSE_MENU:SET_MENU,n=M.length,top=ovY(0,n)-90,h=n*52+130;
 if(artReady('ui_panel_dialog'))ctx.drawImage(ART['ui_panel_dialog'].el,250,top,460,h);else{ctx.fillStyle='rgba(20,30,70,0.95)';roundRect(250,top,460,h,16);ctx.fill();}
 drawText(overlay==='pause'?'暫停':'設定',480,top+52,{...TX.title,size:34,maxW:400});
 M.forEach((m,i)=>{const y=ovY(i,n),sel=i===ovSel;menuItemBg(290,y-22,380,42,sel);let lab=m;
  if(overlay==='settings'&&i===0)lab='解析度：◀ '+RES_LABEL[resMode]+' ▶';if(overlay==='settings'&&i===1)lab='全螢幕：'+(isFull()?'開':'關')+'（F）';
  menuLabel(lab,i,sel,480,y+8);});
 if(overlay==='settings')drawText('目前渲染 '+cv.width+'×'+cv.height,480,top+h-26,{...TX.body,size:14,maxW:400});
 ctx.restore();}
function renderGame(){bg();
 if(state==='title'){ensureTitleBubbles();
  for(const tb of titleBubbles){const y=((tb.y-timeT*tb.sp)%680+680)%680-20,x=tb.x+Math.sin(timeT*0.4+tb.ph)*14;
   ctx.save();ctx.globalAlpha=0.32;bubble(x,y,tb.c,tb.r);ctx.restore();}
  if(artReady('title_keyart'))ctx.drawImage(ART['title_keyart'].el,0,0,960,640);
  if(artReady('title_logo')){drawImgCentered('title_logo',480,130,640,150);}else{drawText('泡泡對決',480,130,{...TX.title,maxW:700});drawText('BUBBLE VERSUS',480,172,{font:'arcade',size:22,fill:['#eaf6ff','#8ec4ff'],stroke:'rgba(5,15,40,0.85)',strokeW:4,maxW:700});}
  shineSweep(480-320,130-75,640,150,90);
  ctx.save();ctx.translate(0,Math.sin(timeT*2)*3);if(artReady('char_full_0')){drawImgContain('char_full_0',45,296,170,247,.5,1);}else{emblem(130,420,0,55);}ctx.restore();
  ctx.save();ctx.translate(0,Math.sin(timeT*2+2.1)*3);if(artReady('char_full_1')){drawImgContain('char_full_1',745,296,170,247,.5,1);}else{emblem(830,420,1,55);}ctx.restore();
  drawText('沈柏楊',130,580,{font:'heavy',size:24,fill:factionFill(0),stroke:'rgba(5,20,10,0.85)',strokeW:5,maxW:220});
  drawText('蔣萬安',830,580,{font:'heavy',size:24,fill:factionFill(1),stroke:'rgba(5,10,25,0.85)',strokeW:5,maxW:220});
  drawText('VS',480,265,{font:'arcade',size:46,fill:['#fff6b0','#ffb400'],stroke:'rgba(55,25,0,0.88)',strokeW:7,maxW:140});
  MENU.forEach((m,i)=>{const y=330+i*52,s=i===menuSel;menuItemBg(290,y-22,380,42,s);menuLabel(m,i,s,480,y+8);});
  drawText('↑↓ 選擇　Enter/空白鍵 確認　（也可滑鼠點選）',480,610,{...TX.hint,maxW:920});}
 else if(state==='charselect'){drawText('選擇你的角色',480,110,{...TX.h1,maxW:860});
  for(let i=0;i<2;i++){const cx=i===0?260:700,sel=charSel===i;
   if(sel){ctx.fillStyle='rgba(255,255,255,0.12)';ctx.fillRect(cx-150,200,300,340);}
   ctx.strokeStyle=sel?P_INFO[i].col:'rgba(255,255,255,0.15)';ctx.lineWidth=sel?4:2;ctx.strokeRect(cx-150,200,300,340);
   if(artReady('char_full_'+i)){drawImgContain('char_full_'+i,cx-110,205,220,320,.5,1);}else{emblem(cx,330,i,74);}
   drawText(P_INFO[i].name,cx,560,{font:'heavy',size:30,fill:factionFill(i),stroke:'rgba(5,10,20,0.85)',strokeW:6,maxW:280});
   drawText(i===0?'（綠營）':'（藍營）',cx,590,{font:'bold',size:15,fill:'#dfe3ff',stroke:'rgba(0,0,0,0.6)',strokeW:2.5,shadow:0.3,maxW:280});}
  drawText('←→ 或 A/D 切換　滑鼠點選亦可　Enter/空白鍵 確認　Esc 返回標題',480,620,{...TX.hint,maxW:920});}
 else if(state==='oppselect'){drawText('選擇對手',480,100,{...TX.h1,maxW:860});
  drawText('你的角色：'+P_INFO[humanSide].name+(humanSide===0?'（綠營）':'（藍營）'),480,140,{font:'bold',size:18,fill:P_INFO[humanSide].col,stroke:'rgba(0,0,0,0.7)',strokeW:3,shadow:0.35,maxW:860});
  OPP_MENU.forEach((m,i)=>{const y=300+i*52,s=i===menuSel;menuItemBg(290,y-22,380,42,s);let label=m;
   if(i===0)label=(oppType==='ai'?'✓　':'')+m;else if(i===1)label=(oppType==='2p'?'✓　':'')+m;else if(i===2)label='難度：◀ '+DIFF[difficulty]+' ▶'+(oppType!=='ai'?'（僅電腦對戰適用）':'');
   menuLabel(label,i,s,480,y+8,s?undefined:(i===2&&oppType!=='ai'?'#778':TX.button.fill));});
  drawText('↑↓ 選擇　←→ 調整難度　Enter/空白鍵 確認　Esc 返回選角',480,610,{...TX.hint,maxW:920});}
 else if(state==='help'){if(artReady('ui_panel_dialog')){drawImgRect('ui_panel_dialog',70,30,820,580);}else{ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(80,40,800,560);}
  drawText('遊戲說明',480,95,{...TX.h1,size:36,maxW:700});
  let gy=132;
  const gHeader=t=>{drawText(t,120,gy,{...TX.h2,align:'left',maxW:720});gy+=27;};
  const gLine=parts=>{drawRich(parts,120,gy);gy+=27;};
  gHeader('玩法規則');
  gLine([seg('發射泡泡，湊滿 '),seg('3',GK_TAG),seg(' 顆以上同色即可消除；失去連結的泡泡會掉落。')]);
  gLine([seg('泡泡碰到左右牆會反彈。天花板每隔一段時間會下降一格。')]);
  gLine([seg('任何泡泡越過'),seg('紅色虛線',{fill:'#ff6b63',stroke:'rgba(40,0,0,0.85)',strokeW:2.6}),seg('就輸了！')]);
  gLine([seg('一次打落 '),seg('3',GK_TAG),seg(' 顆以上泡泡，還會送垃圾泡泡給對手。')]);
  gLine([seg('三戰兩勝制：先拿下 '),seg('2',GK_TAG),seg(' 局勝利，即贏得整場比賽！')]);
  gy+=6;
  gHeader('技能');
  gLine([seg('消除／掉落泡泡會累積'),seg('技能條',GK_TAG),seg('，滿了可發動技能：')]);
  gLine([seg('　在對手版面頂端塞入兩排自己陣營顏色的泡泡（沈柏楊＝'),seg('綠',GK_GREEN),seg('、蔣萬安＝'),seg('藍',GK_BLUE),seg('）。')]);
  gy+=6;
  gHeader('操作方式');
  gLine([seg('【單人】',GK_TAG),seg('你操控的版面：'),seg('←→',GK_KEY),seg('或'),seg('A/D',GK_KEY),seg(' 瞄準，'),seg('空白鍵',GK_KEY),seg('／'),seg('↑',GK_KEY),seg(' 發射，'),seg('Shift/E',GK_KEY),seg(' 技能；滑鼠瞄準＋點擊發射')]);
  gLine([seg('　　　　（角色選擇畫面可自由選擇操控'),seg('綠營',GK_GREEN),seg('或'),seg('藍營',GK_BLUE),seg('，AI 會操控另一方）')]);
  gLine([seg('【雙人】',GK_TAG),seg('左方：'),seg('A/D',GK_KEY),seg(' 瞄準、'),seg('W',GK_KEY),seg(' 發射、'),seg('E',GK_KEY),seg(' 技能')]);
  gLine([seg('　　　　右方：'),seg('←→',GK_KEY),seg(' 瞄準、'),seg('↑',GK_KEY),seg(' 發射、'),seg('Enter',GK_KEY),seg(' 技能')]);
  gLine([seg('Esc',GK_KEY),seg(' 返回標題　／　'),seg('M',GK_KEY),seg(' 鍵或右上角圖示：靜音切換')]);
  drawText('按任意鍵返回',480,561,{...TX.hint,maxW:300});}
 else{ctx.save();if(shakeMag>0.05){ctx.translate((Math.random()*2-1)*shakeMag,(Math.random()*2-1)*shakeMag);}
  drawPillars();drawTopBar();players.forEach(drawBoard);players.forEach(drawCharacterStand);drawCenterOverlay();if(state==='intro')drawIntro();
  if(state==='roundover'){if(artReady('ui_panel_wide')){drawImgRect('ui_panel_wide',0,200,960,200);}else{ctx.fillStyle='rgba(5,6,16,0.8)';ctx.fillRect(0,222,960,155);}const w=winner;
   if(w<0){drawText('平手，重賽本局！',480,292,{font:'heavy',size:28,fill:['#ffffff','#dfe6ff'],stroke:'rgba(0,0,0,0.88)',strokeW:6,maxW:860});}
   else{emblem(480,250,w,16);drawText(P_INFO[w].name+' 贏得第 '+round+' 局！',480,290,{font:'heavy',size:26,fill:factionFill(w),stroke:'rgba(0,0,0,0.88)',strokeW:6,maxW:860});}
   drawText('比分 '+matchScore[0]+' : '+matchScore[1]+'　即將開始下一局…',480,318,{...TX.subBody,maxW:860});
   drawText('Enter／點擊 提前開始',480,348,{...TX.cta,size:16,maxW:860});}
  else if(state==='over'){if(artReady('ui_panel_wide')){drawImgRect('ui_panel_wide',0,200,960,200);}else{ctx.fillStyle='rgba(5,6,16,0.82)';ctx.fillRect(0,208,960,192);}const w=winner;
   if(w>=0)emblem(480,250,w,16);
   drawText(w<0?'平手！':P_INFO[w].name+' 獲勝！',480,290,{font:'heavy',size:28,fill:w<0?['#ffffff','#dfe6ff']:factionFill(w),stroke:'rgba(0,0,0,0.88)',strokeW:6,maxW:860});
   let scoreLine='最終比分 '+matchScore[0]+' : '+matchScore[1];if(mode==='ai')scoreLine+='　'+(winner===humanSide?'你贏了！':'你輸了……');
   drawText(scoreLine,480,316,{...TX.subBody,maxW:860});
   drawText('再來一局 (Enter/R)',200,348,{...TX.cta,size:16,maxW:280});drawText('重新選角 (C)',480,348,{...TX.cta,size:16,maxW:280});drawText('回標題 (Esc)',760,348,{...TX.cta,size:16,maxW:280});}}
 drawParticles();
 if(skillAnim)renderSkillAnim();
 muteIcon();}
function muteIcon(){const[x,y]=MUTE_XY;ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(10,14,34,0.55)';ctx.beginPath();ctx.arc(0,0,15,0,7);ctx.fill();
 ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-7,-4);ctx.lineTo(-3,-4);ctx.lineTo(2,-9);ctx.lineTo(2,9);ctx.lineTo(-3,4);ctx.lineTo(-7,4);ctx.closePath();ctx.fill();
 if(muted){ctx.beginPath();ctx.moveTo(5,-6);ctx.lineTo(11,6);ctx.moveTo(11,-6);ctx.lineTo(5,6);ctx.stroke();}
 else{ctx.beginPath();ctx.arc(2,0,7,-0.6,0.6);ctx.stroke();ctx.beginPath();ctx.arc(2,0,10.5,-0.7,0.7);ctx.stroke();}
 ctx.restore();}
let last=performance.now();
function loop(t){if(Q.get('manual')){render();requestAnimationFrame(loop);return;}bgmSync();const dt=Math.min(0.05,(t-last)/1000);last=t;const n=Q.get('fast')?6:1;if(!overlay)for(let k=0;k<n;k++)step(dt);render();requestAnimationFrame(loop);}
window.__game={get state(){return state},get overlay(){return overlay},get RS(){return RS},get resMode(){return resMode},setRes,mpos,get winner(){return winner},get players(){return players},start,step,render};
if(Q.get('mode')){difficulty=+(Q.get('diff')??1);humanSide=+(Q.get('side')||0);start(Q.get('mode'));}
// load every bundled display face before the first canvas draw so text never
// flashes in a fallback system font; a timeout still lets the game start if a
// font request stalls (offline, blocked request, etc).
function loadFonts(){
 if(!(window.FontFace&&document.fonts&&document.fonts.load))return Promise.resolve();
 const specs=['900 32px "GenSenHeavyTW"','700 32px "GenSenBoldTW"','32px "Bungee"','32px "PressStart2P"'];
 const loaded=Promise.all(specs.map(s=>document.fonts.load(s).catch(()=>{}))).then(()=>document.fonts.ready).catch(()=>{});
 const timeout=new Promise(res=>setTimeout(res,1200));
 return Promise.race([loaded,timeout]);
}
loadFonts().then(()=>requestAnimationFrame(loop));
