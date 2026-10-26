# ACE-Step raw clips (audio/raw/<name>/*.wav) -> crisp one-shots audio/<name>.ogg
import numpy as np,glob,os,subprocess,scipy.io.wavfile as W,scipy.signal as S
R='audio/raw';SR=48000
SPEC={ # name:(len_s, decay_tau_s, highpass_hz, transient)
'shoot':(.28,.08,250,'zap'),'bounce':(.16,.05,400,'click'),'stick':(.2,.06,200,'thock'),
'pop':(.38,.10,600,'glass'),'combo':(.9,.35,300,None),'drop':(.75,.3,250,None),
'skill':(1.5,.7,80,'boom'),'garbage':(.7,.3,60,'thud'),'danger':(.6,.4,300,None),
'ceiling':(.6,.22,60,'thud'),'win':(2.6,1.4,120,None),'lose':(2.0,1.0,120,None),
'select':(.12,.04,800,'click'),'confirm':(.4,.15,500,'glass')}
def load(f):
  sr,x=W.read(f);x=x.astype(np.float32);x=x.mean(1) if x.ndim>1 else x
  return x/(np.abs(x).max()+1e-9)
def onsets(x):
  h=480;e=np.array([np.sqrt((x[k:k+h]**2).mean()) for k in range(0,len(x)-h,h)])+1e-5
  db=20*np.log10(e);fl=np.r_[0,np.maximum(0,db[1:]-np.minimum.accumulate(db)[:-1]*0-np.maximum(db[:-1],-60))]
  return db,fl,h
def best(x,L):
  db,fl,h=onsets(x);n=int(L*SR/h);best=(-1e9,0)
  for i in range(1,len(db)-n):
    pre=db[max(0,i-4):i].mean();post=db[i:i+2].max();sc=(post-pre)*1.0+post*0.3-0.4*max(0,db[i+n//2:i+n].mean()-post+6)
    if post>-25 and sc>best[0]:best=(sc,i)
  i=best[1];s=i*h
  seg=x[max(0,s-480):s+480];k=int(np.argmax(np.abs(seg)>0.3*np.abs(seg).max()))  # tighten to attack
  return best[0],max(0,s-480)+max(0,k-48)
def trans(kind,n):
  t=np.arange(n)/SR;r=np.random.default_rng(1)
  if kind=='click':return np.sin(2*np.pi*3200*t)*np.exp(-t/.006)+.4*r.normal(size=n)*np.exp(-t/.002)
  if kind=='glass':return sum(np.sin(2*np.pi*f*t)*np.exp(-t/d)*a for f,d,a in((2400,.12,.6),(3610,.08,.4),(5200,.05,.3)))+.3*r.normal(size=n)*np.exp(-t/.003)
  if kind=='zap':return np.sin(2*np.pi*np.cumsum(1800*np.exp(-t/.05)+300)/SR)*np.exp(-t/.06)
  if kind=='thock':return np.sin(2*np.pi*np.cumsum(900*np.exp(-t/.02)+200)/SR)*np.exp(-t/.03)
  if kind=='thud':return np.sin(2*np.pi*np.cumsum(160*np.exp(-t/.08)+50)/SR)*np.exp(-t/.15)
  if kind=='boom':return np.sin(2*np.pi*np.cumsum(120*np.exp(-t/.2)+40)/SR)*np.exp(-t/.4)+.5*r.normal(size=n)*np.exp(-t/.02)
def make(name):
  L,tau,hp,tr=SPEC[name];cands=[]
  for f in sorted(glob.glob(f'{R}/{name}/*.wav')):
    x=load(f);sc,s=best(x,L);cands.append((sc,f,s,x))
  sc,f,s,x=max(cands,key=lambda c:c[0]);n=int(L*SR);y=x[s:s+n].copy();y=np.pad(y,(0,n-len(y)))
  t=np.arange(n)/SR;env=np.exp(-t/tau);a=int(.002*SR);env[:a]*=np.linspace(0,1,a);f2=int(.02*SR);env[-f2:]*=np.linspace(1,0,f2)
  y*=env;b,a2=S.butter(4,hp/(SR/2),'high');y=S.lfilter(b,a2,y)
  if tr: z=trans(tr,n);z[-f2:]*=np.linspace(1,0,f2);y=y/(np.abs(y).max()+1e-9)+.45*z
  y=y/(np.abs(y).max()+1e-9)*0.89
  W.write('/tmp/_s.wav',SR,(y*32767).astype(np.int16))
  subprocess.run(['ffmpeg','-y','-loglevel','error','-i','/tmp/_s.wav','-ar','44100','-c:a','libvorbis','-q:a','5',f'audio/{name}.ogg'],check=True)
  print(f'{name:8} from {os.path.basename(f)[:8]} @{s/SR:.2f}s score {sc:.1f}')
def bgm():
  fs=sorted(glob.glob(f'{R}/bgm/*.wav'))
  def score(f):x=load(f);return np.sqrt((x**2).mean())  # densest/most energetic
  f=max(fs,key=score);sr,x=W.read(f);x=x.astype(np.float32)/32768
  bar=60/140*4;L=int(16*bar*SR);s0=int(2*bar*SR)  # 16 bars starting at bar 2 (~27.4s)
  y=x[s0:s0+L].copy();c=int(.08*SR);y[:c]=y[:c]*np.linspace(0,1,c)[:,None]+x[s0+L:s0+L+c]*np.linspace(1,0,c)[:,None] if len(x)>=s0+L+c else y[:c]
  y=y/np.abs(y).max()*0.7;W.write('/tmp/_b.wav',SR,(y*32767).astype(np.int16))
  subprocess.run(['ffmpeg','-y','-loglevel','error','-i','/tmp/_b.wav','-ar','44100','-c:a','libvorbis','-q:a','4','audio/bgm.ogg'],check=True);print('bgm from',os.path.basename(f)[:8],len(y)/SR)
if __name__=='__main__':
  for k in SPEC:make(k)
  bgm()
