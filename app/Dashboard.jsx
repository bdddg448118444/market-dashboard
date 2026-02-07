"use client";
import { useState, useEffect, useRef, useMemo } from "react";

const F="'IBM Plex Mono',monospace",FD="'Instrument Sans',sans-serif";
const BG="#060810",CB="rgba(255,255,255,.018)",CBR="rgba(255,255,255,.055)";
const MT="#9ca3af",DM="#6b7280",TX="#e5e7eb";
const GRN="#22c55e",YLW="#eab308",ORG="#f97316",RED="#ef4444",BLU="#3b82f6",PRP="#a855f7";

// ── AUDIO ──
const Snd={c:null,g(){if(!this.c)this.c=new(window.AudioContext||window.webkitAudioContext)();return this.c;},
tier(){try{const c=this.g();[880,1100,1320].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=f;g.gain.setValueAtTime(.25,c.currentTime+i*.1);g.gain.exponentialRampToValueAtTime(.01,c.currentTime+i*.1+.2);o.start(c.currentTime+i*.1);o.stop(c.currentTime+i*.1+.25);});}catch(e){}},
bounce(){try{const c=this.g();[523,659,784].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=f;g.gain.setValueAtTime(.2,c.currentTime+i*.12);g.gain.exponentialRampToValueAtTime(.01,c.currentTime+i*.12+.18);o.start(c.currentTime+i*.12);o.stop(c.currentTime+i*.12+.22);});}catch(e){}},
cross(){try{const c=this.g(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="square";o.frequency.value=660;g.gain.setValueAtTime(.12,c.currentTime);g.gain.exponentialRampToValueAtTime(.01,c.currentTime+.25);o.start(c.currentTime);o.stop(c.currentTime+.3);}catch(e){}},
buried(){try{const c=this.g();[440,330,220].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="sawtooth";o.frequency.value=f;g.gain.setValueAtTime(.15,c.currentTime+i*.15);g.gain.exponentialRampToValueAtTime(.01,c.currentTime+i*.15+.2);o.start(c.currentTime+i*.15);o.stop(c.currentTime+i*.15+.25);});}catch(e){}},
tick(){try{const c=this.g(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=1200;g.gain.setValueAtTime(.06,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.04);o.start(c.currentTime);o.stop(c.currentTime+.05);}catch(e){}}};

// ── ENGINES ──
function calcRisk(d){
  if(!d?.vix?.cur)return{tier:"LOADING",color:MT,desc:"Fetching data...",prob:0,s:0,tr:[],nx:[],next:"—"};
  let s=0,tr=[],nx=[];
  if(d.vix.cur>=28){s+=3;tr.push("VIX extreme ≥28");}else if(d.vix.cur>=22){s+=2;tr.push(`VIX above 22 (${d.vix.cur.toFixed(1)})`);}else if(d.vix.cur>=20){s+=1.5;tr.push(`VIX above 20 (${d.vix.cur.toFixed(1)})`);}else if(d.vix.cur>=18){s+=1;tr.push(`VIX above 18 (${d.vix.cur.toFixed(1)})`);}else nx.push({t:"VIX above 18",c:d.vix.cur?.toFixed(1)});
  const cz=d.credit?.z||0;
  if(cz>=1.5){s+=3;tr.push("Credit z ≥1.5");}else if(cz>=1.0){s+=2;tr.push(`Credit z ≥1.0 (${cz.toFixed(2)}z)`);}else if(cz>=0.5){s+=1;tr.push(`Credit elevated (${cz.toFixed(2)}z)`);}else nx.push({t:"Credit z to 1.0+",c:`${cz.toFixed(2)}z`});
  const vr=d.term?.vratio||1.1;
  if(vr<0.95){s+=3;tr.push("Deep backwardation");}else if(vr<1.00){s+=2;tr.push(`Near backwardation (${vr.toFixed(3)})`);}else if(vr<1.02){s+=1;tr.push(`Term flattening (${vr.toFixed(3)})`);}else nx.push({t:"Term ratio to 0.98+",c:vr.toFixed(3)});
  let tier,color,desc,prob;
  if(s>=7){tier="RED";color=RED;desc="Major stress. 15–25% drawdowns likely.";prob=22.5;}
  else if(s>=4){tier="ELEVATED";color=ORG;desc="Significant stress building. 10–15% corrections possible.";prob=10.7;}
  else if(s>=2){tier="WATCH";color=YLW;desc="Elevated caution. Pullbacks possible.";prob=4.2;}
  else{tier="NORMAL";color=GRN;desc="Normal conditions. 3–5% pullbacks rare.";prob=1.0;}
  const ts=["NORMAL","WATCH","ELEVATED","RED"];
  return{tier,color,desc,prob,s,tr,nx,next:ts[Math.min(ts.indexOf(tier)+1,3)]};
}

function calcBounce(d){
  if(!d?.vix?.cur)return{c:[],mc:0,ac:0,sig:"LOADING",sc:MT};
  const pccVal=d.pcc?.cur,pcceVal=d.pcce?.cur,cpceVal=d.cpce?.cur;
  const vr=d.term?.vratio||1.1,bp=d.bp?.cur;
  const c=[
    {l:"PCC Fear",src:"Mikey",met:pccVal>=0.90,app:pccVal>=0.85,v:pccVal,tgt:"≥1.000",p:pccVal?Math.min(((pccVal-(d.pcc?.lo||0.539))/((d.pcc?.hi||1)-(d.pcc?.lo||0.539)))*100,100):0,live:!!pccVal},
    {l:"PCCE Fear",src:"Mikey",met:pcceVal>=0.96,app:pcceVal>=0.92,v:pcceVal,tgt:"≥1.000",p:pcceVal?Math.min(((pcceVal-(d.pcce?.lo||0.698))/((d.pcce?.hi||1)-(d.pcce?.lo||0.698)))*100,100):0,live:!!pcceVal},
    {l:"VIX 6mo Hi",src:"Mikey",met:d.vix.cur>=(d.vix.mo6hi||30)*0.92,app:d.vix.cur>=(d.vix.mo6hi||30)*0.80,v:d.vix.cur,tgt:`≥${((d.vix.mo6hi||30)*0.92).toFixed(1)}`,p:Math.min(((d.vix.cur-(d.vix.mo6lo||10))/((d.vix.mo6hi||30)-(d.vix.mo6lo||10)))*100,100),live:true},
    {l:"VRatio Bkwd",src:"Marc",met:vr<1.00,app:vr<1.02,v:vr,tgt:"<1.00",p:Math.min(((1.10-vr)/0.15)*100,100),live:vr!==1.1},
    {l:"CPCE Spike",src:"Marc",met:cpceVal>=0.75,app:cpceVal>=0.65,v:cpceVal,tgt:"≥0.75",p:cpceVal?Math.min(((cpceVal-0.45)/(0.75-0.45))*100,100):0,live:!!cpceVal},
    {l:"BPNDX OS",src:"Marc",met:bp<=30,app:bp<=40,v:bp,tgt:"≤30",p:bp?Math.min(((80-bp)/50)*100,100):0,live:!!bp},
  ];
  const mc=c.filter(x=>x.met&&x.v!==null&&x.v!==undefined).length;
  const ac=c.filter(x=>x.app&&!x.met&&x.v!==null&&x.v!==undefined).length;
  let sig,sc;
  if(mc>=4){sig="STRONG BUY ZONE";sc=GRN;}else if(mc>=2){sig="BOUNCE LIKELY";sc="#4ade80";}else if(mc+ac>=3){sig="APPROACHING";sc=YLW;}else{sig="NOT YET";sc=MT;}
  return{c,mc,ac,sig,sc};
}

function checkBuried(d){
  if(!d?.cpce?.h30?.length||d.cpce.h30.length<2||!d.cpce.cur)return{buried:false,warning:false};
  const prev=d.cpce.h30[d.cpce.h30.length-2],cur=d.cpce.cur;
  const roc=((cur-prev)/prev)*100;
  const spxUp=(d.spx?.pct||0)>0.3;
  return{buried:spxUp&&roc<-8,warning:spxUp&&roc<-5,roc:roc.toFixed(1),spxUp};
}

// ── MARC EMAIL PARSER ──
function parseMarcEmail(text){
  const notes=[];
  const lines=text.split('\n').filter(l=>l.trim());
  const pats=[{rx:/CPCE\s*([\d.]+)/i,k:'CPCE'},{rx:/VRatio\s*([\d.]+)/i,k:'VRatio'},{rx:/BPNDX\s*([\d.]+)/i,k:'BPNDX'},{rx:/VIX\s*([\d.]+)/i,k:'VIX'},{rx:/backwardation/i,k:'Backwardation'},{rx:/contango/i,k:'Contango'},{rx:/(bullish|bearish|neutral)/i,k:'Bias'},{rx:/squeeze/i,k:'Squeeze'},{rx:/support[:\s]*([\d,.]+)/i,k:'Support'},{rx:/resistance[:\s]*([\d,.]+)/i,k:'Resistance'},{rx:/target[:\s]*([\d,.]+)/i,k:'Target'},{rx:/range[:\s]*([\d,.]+)\s*[-–to]+\s*([\d,.]+)/i,k:'Range'}];
  for(const line of lines){
    const tags=[];
    for(const p of pats){const m=line.match(p.rx);if(m){if(p.k==='Range')tags.push(`${p.k}:${m[1]}–${m[2]}`);else if(p.k==='Bias')tags.push(m[1].toUpperCase());else if(m[1]&&!isNaN(parseFloat(m[1])))tags.push(`${p.k}:${m[1]}`);else tags.push(p.k);}}
    if(line.trim().length>5)notes.push({text:line.trim(),tags});
  }
  return notes;
}

// ── SVG COMPONENTS ──
function Spark({data,color=ORG,w=120,h=32,area=false,thresh=null,tC=RED}){
  if(!data?.length||data.length<2)return <div style={{width:w,height:h,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:DM,fontFamily:F}}>No data</div>;
  const mn=Math.min(...data)*.97,mx=Math.max(...data)*1.03,rng=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/rng)*h}`).join(" ");
  const ly=h-((data[data.length-1]-mn)/rng)*h;
  const ty=thresh!==null?h-((thresh-mn)/rng)*h:null;
  return(<svg width={w} height={h} style={{display:"block"}}>{area&&<polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity=".07"/>}{ty!==null&&ty>=0&&ty<=h&&<line x1="0" y1={ty} x2={w} y2={ty} stroke={tC} strokeWidth="1" strokeDasharray="3,2" opacity=".4"/>}<polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"/><circle cx={w} cy={ly} r="2" fill={color}/></svg>);
}
function DualSpark({d1,d2,c1=ORG,c2=BLU,w=180,h=32,thresh=null}){
  if(!d1?.length||d1.length<2)return null;
  const all=[...d1,...(d2||[])].filter(v=>v!==null&&v!==undefined);
  if(!all.length)return null;
  const mn=Math.min(...all)*.95,mx=Math.max(...all)*1.05,rng=mx-mn||1;
  const tp=d=>d.filter(v=>v!==null&&v!==undefined).map((v,i,a)=>`${(i/(a.length-1))*w},${h-((v-mn)/rng)*h}`).join(" ");
  const ty=thresh!==null?h-((thresh-mn)/rng)*h:null;
  return(<svg width={w} height={h} style={{display:"block"}}><polygon points={`0,${h} ${tp(d1)} ${w},${h}`} fill={c1} opacity=".05"/>{ty!==null&&ty>=0&&ty<=h&&<line x1="0" y1={ty} x2={w} y2={ty} stroke={RED} strokeWidth="1" strokeDasharray="3,2" opacity=".35"/>}{d2?.length>1&&<polyline points={tp(d2)} fill="none" stroke={c2} strokeWidth="1.2" opacity=".6"/>}<polyline points={tp(d1)} fill="none" stroke={c1} strokeWidth="1.5"/><circle cx={w} cy={h-((d1[d1.length-1]-mn)/rng)*h} r="2" fill={c1}/></svg>);
}
function CurveChart({d1,d2,l1,l2,c1=YLW,c2=PRP,w=220,h=40}){
  if(!d1?.length||d1.length<2)return null;
  const all=[...d1,...(d2||[])];const mn=Math.min(...all)*.97,mx=Math.max(...all)*1.03,rng=mx-mn||1;
  const tp=d=>d.map((v,i)=>`${(i/(d.length-1))*w},${h-((v-mn)/rng)*h}`).join(" ");
  const ty=h-((1.0-mn)/rng)*h;
  return(<div><svg width={w} height={h} style={{display:"block"}}><polygon points={`0,${h} ${tp(d1)} ${w},${h}`} fill={c1} opacity=".04"/>{ty>=0&&ty<=h&&<line x1="0" y1={ty} x2={w} y2={ty} stroke={RED} strokeWidth="1" strokeDasharray="4,3" opacity=".5"/>}{ty>=0&&ty<=h&&<text x={w-2} y={ty-3} fill={RED} fontSize="7" textAnchor="end" fontFamily={F} opacity=".6">1.00</text>}<polyline points={tp(d1)} fill="none" stroke={c1} strokeWidth="1.5"/>{d2?.length>1&&<polyline points={tp(d2)} fill="none" stroke={c2} strokeWidth="1.5"/>}<circle cx={w} cy={h-((d1[d1.length-1]-mn)/rng)*h} r="2.5" fill={c1}/>{d2?.length>0&&<circle cx={w} cy={h-((d2[d2.length-1]-mn)/rng)*h} r="2.5" fill={c2}/>}</svg><div style={{display:"flex",gap:10,marginTop:3}}><span style={{fontSize:8,fontFamily:F,color:c1}}>● {l1}: {d1[d1.length-1]?.toFixed(3)}</span>{d2?.length>0&&<span style={{fontSize:8,fontFamily:F,color:c2}}>● {l2}: {d2[d2.length-1]?.toFixed(3)}</span>}</div></div>);
}
function SpreadChart({hHY,hIG,w=220,h=40}){
  if(!hHY?.length||hHY.length<2||!hIG?.length)return null;
  const diff=hHY.map((v,i)=>v-(hIG[i]||0));const all=[...hHY,...hIG,...diff];
  const mn=Math.min(...all)*.95,mx=Math.max(...all)*1.05,rng=mx-mn||1;
  const tp=d=>d.map((v,i)=>`${(i/(d.length-1))*w},${h-((v-mn)/rng)*h}`).join(" ");
  return(<div><svg width={w} height={h} style={{display:"block"}}><polyline points={tp(hHY)} fill="none" stroke={ORG} strokeWidth="1.3"/><polyline points={tp(hIG)} fill="none" stroke={BLU} strokeWidth="1.3"/><polyline points={tp(diff)} fill="none" stroke={PRP} strokeWidth="1" strokeDasharray="3,2"/><circle cx={w} cy={h-((hHY[hHY.length-1]-mn)/rng)*h} r="2" fill={ORG}/><circle cx={w} cy={h-((hIG[hIG.length-1]-mn)/rng)*h} r="2" fill={BLU}/></svg><div style={{display:"flex",gap:8,marginTop:3}}><span style={{fontSize:8,fontFamily:F,color:ORG}}>● HY:{hHY[hHY.length-1]?.toFixed(2)}z</span><span style={{fontSize:8,fontFamily:F,color:BLU}}>● IG:{hIG[hIG.length-1]?.toFixed(2)}z</span><span style={{fontSize:8,fontFamily:F,color:PRP}}>● Δ{diff[diff.length-1]?.toFixed(2)}</span></div></div>);
}
function SPXChart({data,warns=[],w=700,h=90}){
  if(!data?.length||data.length<2)return <div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center",color:DM,fontSize:10,fontFamily:F}}>Loading S&P history...</div>;
  const mn=Math.min(...data)*.98,mx=Math.max(...data)*1.02,rng=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/rng)*h}`).join(" ");
  return(<svg width={w} height={h+10} style={{display:"block",width:"100%"}} viewBox={`0 0 ${w} ${h+10}`} preserveAspectRatio="none"><polygon points={`0,${h} ${pts} ${w},${h}`} fill={ORG} opacity=".04"/><polyline points={pts} fill="none" stroke={ORG} strokeWidth="2"/>{warns.map((wi,i)=>{const x=(wi/(data.length-1))*w;return <g key={i}><line x1={x} y1={0} x2={x} y2={h} stroke={MT} strokeWidth="1" strokeDasharray="4,3" opacity=".4"/></g>;})}<circle cx={w} cy={h-((data[data.length-1]-mn)/rng)*h} r="3" fill={ORG}/></svg>);
}
function Badge({text,color,sz="sm"}){
  if(!text)return null;
  const s=sz==="lg"?{padding:"3px 12px",fontSize:11}:{padding:"2px 8px",fontSize:9};
  return <span style={{display:"inline-block",...s,borderRadius:4,background:`${color}15`,color,fontWeight:700,letterSpacing:".04em",fontFamily:F,border:`1px solid ${color}22`}}>{text}</span>;
}
function SourceBadge({status}){
  const live=status?.includes?.("LIVE");
  return <span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:live?"rgba(34,197,94,.1)":status==="MANUAL"?"rgba(234,179,8,.1)":"rgba(239,68,68,.1)",color:live?GRN:status==="MANUAL"?YLW:RED,fontFamily:F,fontWeight:600}}>{live?"LIVE":status==="MANUAL"?"MANUAL":"ERR"}</span>;
}

// ── DEFAULTS for null put/call data ──
const DEFAULTS={pcc:{cur:null,hi:1.0,lo:0.539,h30:[],ma10:[]},pcce:{cur:null,hi:1.0,lo:0.698,h30:[],ma10:[]},cpce:{cur:null,ma10:null,roc1:null,h30:[],hMA:[]}};

// ══════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════
export default function Dashboard(){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [cd,setCd]=useState(1800);
  const [ri,setRi]=useState(30);
  const [muted,setMuted]=useState(false);
  const [alerts,setAlerts]=useState([]);
  const [panel,setPanel]=useState(null);
  const [notes,setNotes]=useState([]);
  const [noteInput,setNoteInput]=useState("");
  const [noteDate,setNoteDate]=useState(()=>new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}));
  const [manualPC,setManualPC]=useState({pcc:"",pcce:"",cpce:"",bpndx:""});
  const prevTier=useRef(null);
  const prevBounce=useRef(null);

  // Fetch live data
  const fetchData=async()=>{
    try{
      setLoading(true);
      const res=await fetch("/api/market");
      if(!res.ok)throw new Error(`API error: ${res.status}`);
      const json=await res.json();
      // Merge manual overrides
      if(manualPC.pcc&&!json.pcc.cur)json.pcc.cur=parseFloat(manualPC.pcc);
      if(manualPC.pcce&&!json.pcce.cur)json.pcce.cur=parseFloat(manualPC.pcce);
      if(manualPC.cpce&&!json.cpce.cur)json.cpce.cur=parseFloat(manualPC.cpce);
      if(manualPC.bpndx)json.bp={cur:parseFloat(manualPC.bpndx),prev:null,h30:[]};
      setData(json);
      setError(null);
    }catch(e){setError(e.message);}finally{setLoading(false);}
  };

  useEffect(()=>{fetchData();},[]);

  // Countdown + auto-refresh
  useEffect(()=>{
    const t=setInterval(()=>{
      setCd(p=>{if(p<=1){fetchData();return ri*60;}return p-1;});
    },1000);
    return()=>clearInterval(t);
  },[ri]);

  // Load persisted data
  useEffect(()=>{
    try{const n=localStorage.getItem("mc-notes");if(n)setNotes(JSON.parse(n));}catch(e){}
    try{const a=localStorage.getItem("mc-alerts");if(a)setAlerts(JSON.parse(a));}catch(e){}
    try{const s=localStorage.getItem("mc-settings");if(s){const o=JSON.parse(s);if(o.ri)setRi(o.ri);if(o.muted!==undefined)setMuted(o.muted);}}catch(e){}
    try{const m=localStorage.getItem("mc-manual");if(m)setManualPC(JSON.parse(m));}catch(e){}
  },[]);
  useEffect(()=>{try{localStorage.setItem("mc-notes",JSON.stringify(notes));}catch(e){}},[notes]);
  useEffect(()=>{try{localStorage.setItem("mc-alerts",JSON.stringify(alerts.slice(0,30)));}catch(e){}},[alerts]);
  useEffect(()=>{try{localStorage.setItem("mc-settings",JSON.stringify({ri,muted}));}catch(e){}},[ri,muted]);
  useEffect(()=>{try{localStorage.setItem("mc-manual",JSON.stringify(manualPC));}catch(e){}},[manualPC]);

  const risk=useMemo(()=>calcRisk(data),[data]);
  const bounce=useMemo(()=>calcBounce(data),[data]);
  const buried=useMemo(()=>checkBuried(data),[data]);

  // Alerts
  useEffect(()=>{
    if(!data)return;
    const time=new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true});
    if(prevTier.current&&prevTier.current!==risk.tier){
      setAlerts(p=>[{t:time,ty:"tier",m:`Risk: ${prevTier.current} → ${risk.tier}`,c:risk.color},...p].slice(0,50));
      if(!muted)Snd.tier();
    }
    if(prevBounce.current&&prevBounce.current!==bounce.sig){
      setAlerts(p=>[{t:time,ty:"bounce",m:`Bounce: ${prevBounce.current} → ${bounce.sig}`,c:bounce.sc},...p].slice(0,50));
      if(!muted)Snd.bounce();
    }
    if(buried.buried){
      setAlerts(p=>[{t:time,ty:"buried",m:`⚠ CPCE BURIED on rally (ROC:${buried.roc}%)`,c:RED},...p].slice(0,50));
      if(!muted)Snd.buried();
    }
    prevTier.current=risk.tier;
    prevBounce.current=bounce.sig;
  },[risk.tier,bounce.sig,buried.buried]);

  const addNote=()=>{
    if(!noteInput.trim())return;
    const parsed=parseMarcEmail(noteInput);
    if(parsed.length>0)setNotes(p=>[...parsed.map(n=>({d:noteDate,t:n.text,tags:n.tags})),...p]);
    else setNotes(p=>[{d:noteDate,t:noteInput.trim(),tags:[]},...p]);
    setNoteInput("");if(!muted)Snd.tick();
  };

  // Helper
  const fmt=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const v=(val,dec=1)=>val!==null&&val!==undefined?Number(val).toFixed(dec):"—";

  if(!data&&loading)return(
    <div style={{minHeight:"100vh",background:BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:32,height:32,border:`3px solid ${CBR}`,borderTop:`3px solid ${ORG}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      <div style={{fontFamily:F,color:MT,fontSize:12}}>Fetching live market data...</div>
    </div>
  );

  if(error&&!data)return(
    <div style={{minHeight:"100vh",background:BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:40}}>
      <style>{``}</style>
      <div style={{fontSize:14,color:RED,fontFamily:F}}>⚠ Connection Error</div>
      <div style={{fontSize:11,color:MT,fontFamily:F,textAlign:"center",maxWidth:400}}>{error}</div>
      <button onClick={fetchData} style={{fontFamily:F,background:"rgba(59,130,246,.15)",color:"#60a5fa",border:"1px solid rgba(59,130,246,.25)",borderRadius:6,padding:"8px 20px",fontSize:12,cursor:"pointer",fontWeight:600}}>Retry</button>
    </div>
  );

  if(!data)return null;

  // Computed colors
  const vC=data.vix?.cur>=22?ORG:data.vix?.cur>=18?YLW:GRN;
  const cC=(data.credit?.z||0)>=1.0?ORG:(data.credit?.z||0)>=0.5?YLW:GRN;
  const vr=data.term?.vratio||1.1;
  const tC=vr<1.0?RED:vr<1.02?YLW:GRN;
  const cpC=(data.cpce?.cur||0)>=0.75?RED:(data.cpce?.cur||0)>=0.65?ORG:MT;
  const bpC=(data.bp?.cur||50)<=30?RED:(data.bp?.cur||50)<=40?ORG:(data.bp?.cur||50)<=50?YLW:GRN;
  const tStat=vr<1.0?"BACKWARDATION":vr<1.02?"FLAT":"CONTANGO";

  return(
    <div style={{minHeight:"100vh",background:BG,color:"#e5e7eb",fontFamily:FD}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0a0b10}::-webkit-scrollbar-thumb{background:#1f2937;border-radius:3px}
        @keyframes p{0%,100%{opacity:.55}50%{opacity:1}}@keyframes si{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@keyframes fi{from{opacity:0}to{opacity:1}}
        .hv{transition:border-color .2s,box-shadow .15s,transform .12s}.hv:hover{border-color:rgba(255,255,255,.1)!important;box-shadow:0 2px 16px rgba(0,0,0,.35)!important;transform:translateY(-1px)}
        textarea{font-family:'IBM Plex Mono',monospace;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:#d1d5db;border-radius:6px;padding:8px 10px;font-size:11px;resize:vertical;outline:none;width:100%;min-height:80px}textarea:focus{border-color:rgba(59,130,246,.4)}
        input{font-family:'IBM Plex Mono',monospace;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:#d1d5db;border-radius:4px;padding:4px 8px;font-size:11px;outline:none}input:focus{border-color:rgba(59,130,246,.4)}
        .b{font-family:'IBM Plex Mono',monospace;cursor:pointer;border:none;border-radius:5px;font-size:10px;font-weight:600;padding:5px 12px;transition:all .12s}.b:hover{transform:translateY(-1px)}
        .bp{background:rgba(59,130,246,.12);color:#60a5fa;border:1px solid rgba(59,130,246,.22)}.bp:hover{background:rgba(59,130,246,.2)}
        .bg{background:transparent;color:#9ca3af;border:1px solid rgba(255,255,255,.06)}.bg:hover{background:rgba(255,255,255,.04)}
        .br{background:rgba(239,68,68,.08);color:#f87171;border:1px solid rgba(239,68,68,.18)}
        .pn{position:fixed;top:0;right:0;bottom:0;width:370px;background:#0c0e14;border-left:1px solid rgba(255,255,255,.06);z-index:200;overflow-y:auto;animation:fi .15s;box-shadow:-6px 0 30px rgba(0,0,0,.5)}
      `}</style>

      {/* HEADER */}
      <div style={{background:"linear-gradient(180deg,rgba(10,12,18,1),rgba(6,8,13,.96))",borderBottom:`1px solid ${CBR}`,padding:"9px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(16px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:risk.color,boxShadow:`0 0 7px ${risk.color}70`,animation:"p 2s infinite"}}/>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:".13em",color:TX,fontFamily:F}}>MARKET CONDITIONS</span>
          </div>
          <div style={{height:13,width:1,background:"rgba(255,255,255,.07)"}}/>
          <span style={{fontSize:9,color:DM,fontFamily:F}}>Dover · Mikey · Marc</span>
          {buried.buried&&<Badge text="⚠ CPCE BURIED" color={RED} sz="lg"/>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"2px 9px",borderRadius:4,background:"rgba(255,255,255,.02)",border:`1px solid ${CBR}`}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:cd<=60?RED:GRN,animation:cd<=60?"p 1s infinite":"none"}}/>
            <span style={{fontSize:9,color:MT,fontFamily:F}}>⟳ {fmt(cd)}</span>
          </div>
          {data.fetchTime&&<span style={{fontSize:10,color:DM,fontFamily:F}}>{data.fetchTime}ms</span>}
          <button className="b bg" onClick={()=>setPanel(panel==="alerts"?null:"alerts")} style={{position:"relative",padding:"3px 8px"}}>
            <span style={{fontSize:12}}>{muted?"🔇":"🔔"}</span>
            {alerts.length>0&&<span style={{position:"absolute",top:-3,right:-3,width:13,height:13,borderRadius:"50%",background:RED,fontSize:9,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F}}>{Math.min(alerts.length,9)}</span>}
          </button>
          <button className="b bg" onClick={()=>setPanel(panel==="notes"?null:"notes")} style={{padding:"3px 8px"}}><span style={{fontSize:12}}>📋</span></button>
          <button className="b bg" onClick={()=>setPanel(panel==="settings"?null:"settings")} style={{padding:"3px 8px"}}><span style={{fontSize:12}}>⚙</span></button>
          <button className="b bg" onClick={fetchData} style={{padding:"3px 8px"}}><span style={{fontSize:12}}>🔄</span></button>
        </div>
      </div>

      {/* PANELS */}
      {panel==="alerts"&&(<div className="pn">
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${CBR}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,fontWeight:700,fontFamily:F}}>🔔 Alerts</span>
          <div style={{display:"flex",gap:5}}><button className="b bg" onClick={()=>setMuted(!muted)}>{muted?"Unmute":"Mute"}</button><button className="b bg" onClick={()=>setPanel(null)}>✕</button></div>
        </div>
        <div style={{padding:"8px 10px"}}>
          <div style={{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap"}}>
            {[["Tier",()=>Snd.tier()],["Bounce",()=>Snd.bounce()],["Cross",()=>Snd.cross()],["Buried",()=>Snd.buried()]].map(([l,fn],i)=>(
              <button key={i} className="b bg" onClick={()=>{if(!muted)fn();}} style={{fontSize:9}}>Test {l}</button>
            ))}
            <button className="b br" onClick={()=>setAlerts([])} style={{fontSize:9}}>Clear</button>
          </div>
          {alerts.length===0&&<div style={{textAlign:"center",padding:20,color:DM,fontSize:10,fontFamily:F}}>No alerts yet</div>}
          {alerts.map((a,i)=>(<div key={i} style={{padding:"7px 9px",marginBottom:3,borderRadius:5,background:"rgba(255,255,255,.02)",borderLeft:`3px solid ${a.c}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}><span style={{fontSize:8,color:a.c,fontFamily:F,fontWeight:600,textTransform:"uppercase"}}>{a.ty}</span><span style={{fontSize:10,color:DM,fontFamily:F}}>{a.t}</span></div>
            <div style={{fontSize:10,color:TX,fontFamily:F}}>{a.m}</div>
          </div>))}
        </div>
      </div>)}

      {panel==="notes"&&(<div className="pn">
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${CBR}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,fontWeight:700,fontFamily:F}}>📋 Marc's Notes</span>
          <button className="b bg" onClick={()=>setPanel(null)}>✕</button>
        </div>
        <div style={{padding:"10px 12px"}}>
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",gap:5,marginBottom:5}}>
              <input value={noteDate} onChange={e=>setNoteDate(e.target.value)} style={{width:65}} placeholder="Date"/>
              <span style={{fontSize:9,color:DM,fontFamily:F,alignSelf:"center"}}>Paste email below</span>
            </div>
            <textarea value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder={"Paste Marc's email or notes here.\nAuto-detects: CPCE, VRatio, BPNDX, VIX values\nbullish/bearish/neutral, support/resistance,\nprice ranges, backwardation, squeeze calls.\nMultiple lines = multiple notes."}/>
            <button className="b bp" onClick={addNote} style={{marginTop:5,width:"100%"}}>+ Parse & Add Notes</button>
          </div>
          <div style={{fontSize:10,color:DM,fontFamily:F,marginBottom:8,padding:"5px 7px",background:"rgba(255,255,255,.02)",borderRadius:4}}>💡 Each line becomes a separate tagged note</div>
          {notes.map((n,i)=>(<div key={i} style={{padding:"8px 10px",marginBottom:4,borderRadius:5,background:"rgba(59,130,246,.02)",borderLeft:"3px solid rgba(59,130,246,.25)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:9,color:BLU,fontFamily:F,fontWeight:600}}>MARC</span><span style={{fontSize:10,color:DM,fontFamily:F}}>{n.d}</span></div>
            <div style={{fontSize:10,color:"#9ca3af",fontFamily:F,lineHeight:1.4}}>{n.t}</div>
            {n.tags?.length>0&&<div style={{display:"flex",gap:3,marginTop:3,flexWrap:"wrap"}}>{n.tags.map((tag,j)=>(
              <span key={j} style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:tag.includes("BEARISH")?"rgba(239,68,68,.1)":tag.includes("BULLISH")?"rgba(34,197,94,.1)":"rgba(255,255,255,.04)",color:tag.includes("BEARISH")?RED:tag.includes("BULLISH")?GRN:MT,fontFamily:F}}>{tag}</span>
            ))}</div>}
          </div>))}
        </div>
      </div>)}

      {panel==="settings"&&(<div className="pn">
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${CBR}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,fontWeight:700,fontFamily:F}}>⚙ Settings</span>
          <button className="b bg" onClick={()=>setPanel(null)}>✕</button>
        </div>
        <div style={{padding:"12px 14px"}}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:600,color:TX,fontFamily:F,marginBottom:6}}>Refresh Interval</div>
            <div style={{display:"flex",gap:5}}>{[5,15,30,60].map(m=>(<button key={m} className={`b ${ri===m?"bp":"bg"}`} onClick={()=>{setRi(m);setCd(m*60);}}>{m}m</button>))}</div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:600,color:TX,fontFamily:F,marginBottom:6}}>Sounds</div>
            <div style={{display:"flex",gap:5}}><button className={`b ${!muted?"bp":"bg"}`} onClick={()=>setMuted(false)}>On</button><button className={`b ${muted?"br":"bg"}`} onClick={()=>setMuted(true)}>Muted</button></div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:600,color:TX,fontFamily:F,marginBottom:6}}>Manual Data Entry</div>
            <div style={{fontSize:10,color:DM,fontFamily:F,marginBottom:6}}>Values entered here override API data. BPNDX has no free API — enter it daily from StockCharts or your broker.</div>
            {[["PCC (Total P/C)","pcc"],["PCCE (Eq+Index P/C)","pcce"],["CPCE (Equity P/C)","cpce"],["BPNDX (Nasdaq BP%)","bpndx"]].map(([label,key])=>(
              <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0"}}>
                <span style={{fontSize:10,color:MT,fontFamily:F}}>{label}</span>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <input type="text" value={manualPC[key]} onChange={e=>setManualPC(p=>({...p,[key]:e.target.value}))} style={{width:70,textAlign:"right"}} placeholder={data?.sources?.[key]?.includes("LIVE")?"(live)":key==="bpndx"?"37":"0.000"}/>
                  <SourceBadge status={data?.sources?.[key]}/>
                </div>
              </div>
            ))}
            <button className="b bp" onClick={fetchData} style={{marginTop:6,width:"100%"}}>Apply & Refresh</button>
          </div>
          <div style={{padding:"8px 10px",borderRadius:5,background:"rgba(255,255,255,.02)",border:`1px solid ${CBR}`}}>
            <div style={{fontSize:9,fontWeight:600,color:TX,fontFamily:F,marginBottom:4}}>Data Source Status</div>
            {data.sources&&Object.entries(data.sources).filter(([k])=>k!=="cboeDate").map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}>
                <span style={{fontSize:9,color:MT,fontFamily:F}}>{k.toUpperCase()}</span>
                <span style={{fontSize:9,color:v?.includes?.("LIVE")?GRN:v==="MANUAL"?YLW:RED,fontFamily:F}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>)}

      {/* MAIN CONTENT */}
      <div style={{padding:"18px 22px",maxWidth:1440,margin:"0 auto"}}>

        {/* RISK HERO */}
        <div style={{textAlign:"center",padding:"24px 18px 20px",background:`radial-gradient(ellipse at top,${risk.color}06 0%,transparent 55%)`,borderRadius:12,border:`1px solid ${CBR}`,marginBottom:16,animation:"si .3s"}}>
          <div style={{fontSize:9,letterSpacing:".2em",color:MT,marginBottom:5,fontFamily:F}}>MARKET RISK STATUS</div>
          <div style={{fontSize:52,fontWeight:700,color:risk.color,lineHeight:1,marginBottom:7,fontFamily:F,textShadow:`0 0 25px ${risk.color}20`}}>{risk.tier}</div>
          <div style={{fontSize:13,color:"#9ca3af",marginBottom:14,fontFamily:F,fontWeight:300}}>{risk.desc}</div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 18px",borderRadius:18,background:"rgba(255,255,255,.02)",border:`1px solid ${CBR}`}}>
            <span style={{fontSize:20,fontWeight:700,color:risk.color,fontFamily:F}}>{risk.prob}%</span>
            <span style={{fontSize:10,color:MT,fontFamily:F,textAlign:"left",lineHeight:1.2}}>10%+ decline chance<br/>next 21 trading days</span>
          </div>
          <div style={{marginTop:10,fontSize:9,color:DM,fontFamily:F}}>Live · {data.ts} ET · Fetched in {data.fetchTime}ms</div>
        </div>

        {/* THREE METRICS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
          {[
            {title:"VIX LEVEL",val:v(data.vix?.cur),sub:`Fear (norm: 12–18)`,st:data.vix?.cur>=22?"ELEVATED":data.vix?.cur>=18?"WATCH":"NORMAL",sc:vC,trig:"18",ts:data.vix?.cur>=18?"ABOVE":"BELOW",tc:data.vix?.cur>=18?vC:GRN,sp:data.vix?.h30,th:18,note:data.vix?.cur>=22?"VIX above 22":data.vix?.cur>=20?"VIX above 20":null,src:data.sources?.vix},
            {title:"CREDIT SPREADS",val:`${v(data.credit?.z,2)}z`,sub:`HY:${v(data.credit?.hy,2)}z | IG:${v(data.credit?.ig,2)}z`,st:(data.credit?.z||0)>=1.0?"ELEVATED":(data.credit?.z||0)>=0.5?"WATCH":"NORMAL",sc:cC,trig:"1.0z",ts:(data.credit?.z||0)>=1.0?"ELEVATED":"BELOW",tc:(data.credit?.z||0)>=1.0?cC:GRN,sp:data.credit?.h30,th:1.0,note:null,src:data.sources?.credit},
            {title:"TERM STRUCTURE",val:v(data.term?.vratio,3),sub:`VIX3M:${v(data.vix3m?.cur)} · ${tStat}`,st:tStat==="BACKWARDATION"?"BACKWRDN":tStat,sc:vr<1.0?RED:GRN,trig:"1.00",ts:vr<1.02?"FLAT":"NORMAL",tc:vr<1.02?YLW:GRN,sp:data.term?.h30,th:1.0,note:vr<1.0?"Backwardation active":vr<1.02?"VRatio flattening":null,src:data.sources?.vix3m},
          ].map((m,i)=>(
            <div key={i} className="hv" style={{padding:"14px 16px",borderRadius:10,background:CB,border:`1px solid ${CBR}`,display:"flex",flexDirection:"column",gap:3}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:9,color:MT,letterSpacing:".1em",fontFamily:F}}>{m.title}</span>
                <div style={{display:"flex",gap:4}}><SourceBadge status={m.src}/><Badge text={m.st} color={m.sc}/></div>
              </div>
              <div style={{fontSize:30,fontWeight:700,color:m.sc,fontFamily:F,lineHeight:1.1}}>{m.val}</div>
              <div style={{fontSize:10,color:MT,fontFamily:F}}>{m.sub}</div>
              <Spark data={m.sp} color={m.sc} w={200} h={24} area thresh={m.th}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:4,borderTop:"1px solid rgba(255,255,255,.03)"}}>
                <span style={{fontSize:9,color:MT,fontFamily:F}}>Trigger: <b style={{color:TX}}>{m.trig}</b></span>
                <Badge text={m.ts} color={m.tc}/>
              </div>
              {m.note&&<div style={{fontSize:8,color:m.sc,fontFamily:F}}>✓ {m.note}</div>}
            </div>
          ))}
        </div>

        {/* NEXT LEVEL + BOUNCE */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div className="hv" style={{padding:"13px 15px",borderRadius:10,background:CB,border:`1px solid ${CBR}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:600,fontFamily:F}}><span style={{color:ORG}}>►</span> Next: {risk.next}</span>
              <span style={{fontSize:9,color:MT,fontFamily:F}}>{risk.tr.length} active</span>
            </div>
            {risk.tr.map((t,i)=>(<div key={i} style={{padding:"5px 9px",marginBottom:3,borderRadius:5,background:"rgba(34,197,94,.03)",border:"1px solid rgba(34,197,94,.1)",fontSize:10,fontFamily:F,color:GRN}}>✓ {t}</div>))}
            {risk.nx.map((t,i)=>(<div key={`n${i}`} style={{padding:"5px 9px",marginBottom:3,borderRadius:5,background:"rgba(255,255,255,.01)",border:`1px solid rgba(255,255,255,.04)`,fontSize:10,fontFamily:F,color:MT}}>• {t.t} (now: {t.c})</div>))}
          </div>
          <div className="hv" style={{padding:"13px 15px",borderRadius:10,background:CB,border:`1px solid ${CBR}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:9,letterSpacing:".1em",color:MT,fontFamily:F}}>BOUNCE / DIP-BUY</span>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,fontWeight:700,color:bounce.sc,fontFamily:F}}>{bounce.sig}</span>
                <span style={{padding:"2px 8px",borderRadius:4,background:`${bounce.sc}12`,border:`1px solid ${bounce.sc}22`,color:bounce.sc,fontSize:10,fontWeight:700,fontFamily:F}}>{bounce.mc}/{bounce.c.length}</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>
              {bounce.c.map((c,i)=>(
                <div key={i} style={{padding:"6px 8px",borderRadius:5,background:c.met?"rgba(34,197,94,.04)":c.app?"rgba(234,179,8,.02)":"rgba(255,255,255,.01)",border:`1px solid ${c.met?"rgba(34,197,94,.15)":c.app?"rgba(234,179,8,.08)":"rgba(255,255,255,.04)"}`,opacity:c.live?1:0.5}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:8,fontWeight:600,color:c.met?GRN:c.app?YLW:MT,fontFamily:F}}>{c.met?"✓":c.app?"◐":"○"} {c.l}</span>
                    <span style={{fontSize:9,color:DM,fontFamily:F}}>{c.src}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:3}}>
                    <span style={{fontSize:15,fontWeight:700,color:c.met?GRN:c.app?YLW:"#9ca3af",fontFamily:F}}>{c.v!==null&&c.v!==undefined?Number(c.v).toFixed(c.v<10?3:1):"—"}</span>
                    <span style={{fontSize:9,color:DM,fontFamily:F}}>{c.tgt}</span>
                  </div>
                  <div style={{height:3,background:"rgba(255,255,255,.04)",borderRadius:2}}>
                    <div style={{height:"100%",borderRadius:2,width:`${Math.min(c.p||0,100)}%`,background:c.met?GRN:c.app?YLW:DM}}/>
                  </div>
                  {!c.live&&<div style={{fontSize:8,color:YLW,fontFamily:F,marginTop:2}}>⚠ manual entry needed</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PUT/CALL */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:9,letterSpacing:".13em",color:DM,marginBottom:8,fontFamily:F}}>PUT/CALL POSITIONING</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[
              {label:"PCC",sub:"Equities",val:data.pcc?.cur,lo:data.pcc?.lo||0.539,hi:data.pcc?.hi||1.0,src:"Mikey",h:data.pcc?.h30,ma:data.pcc?.ma10,mn:0.4,mx:1.2,srcStatus:data.sources?.pcc},
              {label:"PCCE",sub:"Eq+Index",val:data.pcce?.cur,lo:data.pcce?.lo||0.698,hi:data.pcce?.hi||1.0,src:"Mikey",h:data.pcce?.h30,ma:data.pcce?.ma10,mn:0.6,mx:1.15,srcStatus:data.sources?.pcce},
            ].map((r,i)=>{
              const hasData=r.val!==null&&r.val!==undefined;
              const pct=hasData?((r.val-r.mn)/(r.mx-r.mn))*100:50;
              const zone=hasData?(r.val>=r.hi*0.96?"FEAR":r.val>=r.hi*0.85?"ELEVATED":r.val<=r.lo*1.05?"COMPLACENT":"NEUTRAL"):"NO DATA";
              const zC=zone==="FEAR"?RED:zone==="ELEVATED"?ORG:zone==="COMPLACENT"?BLU:MT;
              return(
                <div key={i} className="hv" style={{padding:"12px 14px",borderRadius:10,background:CB,border:`1px solid ${CBR}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div><span style={{fontSize:9,color:MT,letterSpacing:".08em",fontFamily:F}}>{r.label}</span><span style={{fontSize:9,color:DM,fontFamily:F,marginLeft:5}}>{r.sub}</span></div>
                    <div style={{display:"flex",gap:3}}><SourceBadge status={r.srcStatus}/><Badge text={zone} color={zC}/></div>
                  </div>
                  <div style={{fontSize:24,fontWeight:700,color:zC,fontFamily:F,marginBottom:4}}>{hasData?r.val.toFixed(3):"—"}</div>
                  {hasData&&r.h?.length>1?<><DualSpark d1={r.h} d2={r.ma} c1={zC} c2="rgba(255,255,255,.25)" w={155} h={22} thresh={r.hi}/><div style={{fontSize:9,color:DM,fontFamily:F,marginTop:2}}>with 10MA</div></>:<div style={{fontSize:9,color:YLW,fontFamily:F,padding:"8px 0"}}>Enter in Settings → Manual Override</div>}
                  {hasData&&<div style={{position:"relative",height:6,background:"rgba(255,255,255,.04)",borderRadius:3,margin:"6px 0 3px"}}>
                    <div style={{position:"absolute",right:0,top:0,bottom:0,width:`${100-((r.hi-r.mn)/(r.mx-r.mn))*100}%`,background:"rgba(239,68,68,.1)",borderRadius:"0 3px 3px 0"}}/>
                    <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${((r.lo-r.mn)/(r.mx-r.mn))*100}%`,background:"rgba(59,130,246,.1)",borderRadius:"3px 0 0 3px"}}/>
                    <div style={{position:"absolute",left:`${pct}%`,top:-1,width:3,height:8,background:zC,borderRadius:2,transform:"translateX(-50%)"}}/>
                  </div>}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:DM,fontFamily:F}}><span>↓{r.lo}</span><span>{r.src}</span><span>↑{r.hi}</span></div>
                </div>
              );
            })}

            {/* CPCE */}
            <div className="hv" style={{padding:"12px 14px",borderRadius:10,background:CB,border:`1px solid ${CBR}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div><span style={{fontSize:9,color:MT,letterSpacing:".08em",fontFamily:F}}>CPCE</span></div>
                <div style={{display:"flex",gap:3}}><SourceBadge status={data.sources?.cpce}/><Badge text={data.cpce?.cur>=0.75?"EXTREME":data.cpce?.cur>=0.65?"ELEVATED":"NEUTRAL"} color={cpC}/></div>
              </div>
              {data.cpce?.cur?<>
                <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                  <span style={{fontSize:24,fontWeight:700,color:cpC,fontFamily:F}}>{data.cpce.cur.toFixed(3)}</span>
                  {data.cpce.ma10&&<span style={{fontSize:9,color:MT,fontFamily:F}}>10MA:<span style={{color:BLU}}>{Number(data.cpce.ma10).toFixed(3)}</span></span>}
                </div>
                <DualSpark d1={data.cpce.h30} d2={data.cpce.hMA} c1={cpC} c2={BLU} w={155} h={22} thresh={0.75}/>
                {data.cpce.roc1!==null&&<div style={{fontSize:10,color:DM,fontFamily:F,marginTop:2}}>ROC(1): <span style={{color:data.cpce.roc1>0?GRN:RED}}>{data.cpce.roc1>0?"+":""}{data.cpce.roc1}%</span><span style={{float:"right"}}>Marc</span></div>}
              </>:<div style={{fontSize:9,color:YLW,fontFamily:F,padding:"8px 0"}}>Enter in Settings → Manual Override</div>}
              <div style={{fontSize:9,color:DM,fontFamily:F,marginTop:3,fontStyle:"italic"}}>"If CPCE buried → not done"</div>
            </div>

            {/* SPX */}
            <div className="hv" style={{padding:"12px 14px",borderRadius:10,background:CB,border:`1px solid ${CBR}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:9,color:MT,letterSpacing:".08em",fontFamily:F}}>S&P 500</span>
                <Badge text={(data.spx?.pct||0)>=0?"UP":"DOWN"} color={(data.spx?.pct||0)>=0?GRN:RED}/>
              </div>
              <div style={{fontSize:24,fontWeight:700,color:TX,fontFamily:F}}>{data.spx?.cur?data.spx.cur.toFixed(0):"—"}</div>
              <div style={{fontSize:11,color:(data.spx?.pct||0)>=0?GRN:RED,fontFamily:F,marginBottom:4}}>
                {(data.spx?.pct||0)>=0?"▲":"▼"} {Math.abs(data.spx?.chg||0).toFixed(1)} ({(data.spx?.pct||0).toFixed(2)}%)
              </div>
              <div style={{padding:"6px 8px",borderRadius:5,background:"rgba(255,255,255,.015)"}}>
                <div style={{fontSize:10,color:DM,fontFamily:F,lineHeight:1.4}}>
                  {(data.spx?.pct||0)>=0.5?"Rally — first green. Squeeze?":
                   (data.spx?.pct||0)<=-0.5?"Selling continues. Watch capitulation.":
                   "Choppy. Awaiting signal."}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BPNDX + VRATIO + CREDIT */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
          <div className="hv" style={{padding:"14px 16px",borderRadius:10,background:CB,border:`1px solid ${CBR}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
              <span style={{fontSize:9,letterSpacing:".1em",color:MT,fontFamily:F}}>$BPNDX</span>
              <div style={{display:"flex",gap:3}}><SourceBadge status={data.sources?.bpndx}/><Badge text={(data.bp?.cur||50)<=30?"EXTREME OS":(data.bp?.cur||50)<=40?"OVERSOLD":(data.bp?.cur||50)>=65?"OVERBOUGHT":"NEUTRAL"} color={bpC}/></div>
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:3}}>
              <span style={{fontSize:30,fontWeight:700,color:bpC,fontFamily:F}}>{data.bp?.cur?data.bp.cur.toFixed(0):"—"}</span>
              {data.bp?.cur&&data.bp?.prev&&<span style={{fontSize:11,color:data.bp.cur<data.bp.prev?RED:GRN,fontFamily:F}}>{data.bp.cur<data.bp.prev?"▼":"▲"}{Math.abs(data.bp.cur-data.bp.prev).toFixed(0)}</span>}
            </div>
            <Spark data={data.bp?.h30} color={bpC} w={220} h={34} area thresh={30} tC={RED}/>
            <div style={{display:"flex",gap:3,marginTop:6}}>
              {[{v:30,l:"ExtOS",c:RED},{v:40,l:"OS",c:ORG},{v:65,l:"OB",c:BLU},{v:80,l:"ExtOB",c:"#6366f1"}].map((lv,j)=>(
                <div key={j} style={{flex:1,textAlign:"center",padding:2,borderRadius:3,background:"rgba(255,255,255,.015)"}}>
                  <div style={{fontSize:11,fontWeight:600,color:lv.c,fontFamily:F}}>{lv.v}</div>
                  <div style={{fontSize:10,color:DM}}>{lv.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hv" style={{padding:"14px 16px",borderRadius:10,background:CB,border:`1px solid ${CBR}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
              <span style={{fontSize:9,letterSpacing:".1em",color:MT,fontFamily:F}}>VIX TERM CURVE</span>
              <Badge text={tStat} color={vr<1.0?RED:GRN}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:6}}>
              <div><div style={{fontSize:9,color:DM,fontFamily:F}}>VIX9D</div><div style={{fontSize:16,fontWeight:700,color:data.vix9d?.cur>data.vix?.cur?RED:PRP,fontFamily:F}}>{v(data.vix9d?.cur)}</div></div>
              <div><div style={{fontSize:9,color:DM,fontFamily:F}}>VIX</div><div style={{fontSize:16,fontWeight:700,color:vC,fontFamily:F}}>{v(data.vix?.cur)}</div></div>
              <div><div style={{fontSize:9,color:DM,fontFamily:F}}>VIX3M</div><div style={{fontSize:16,fontWeight:700,color:"#9ca3af",fontFamily:F}}>{v(data.vix3m?.cur)}</div></div>
            </div>
            <CurveChart d1={data.term?.h30} d2={data.term?.h30_9d} l1="3M/1M" l2="9D/1M" c1={YLW} c2={PRP} w={220} h={38}/>
            <div style={{padding:"5px 8px",borderRadius:4,background:"rgba(255,255,255,.015)",marginTop:5}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:8,color:MT,fontFamily:F}}>VRatio 3M/1M:</span><span style={{fontSize:9,fontWeight:700,color:tC,fontFamily:F}}>{v(data.term?.vratio,3)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}><span style={{fontSize:8,color:MT,fontFamily:F}}>VRatio 9D/1M:</span><span style={{fontSize:9,fontWeight:700,color:(data.term?.vratio9d||0)>1.0?RED:PRP,fontFamily:F}}>{v(data.term?.vratio9d,3)}</span></div>
            </div>
          </div>

          <div className="hv" style={{padding:"14px 16px",borderRadius:10,background:CB,border:`1px solid ${CBR}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
              <span style={{fontSize:9,letterSpacing:".1em",color:MT,fontFamily:F}}>CREDIT DIFFERENTIAL</span>
              <Badge text={(data.credit?.z||0)>=1.0?"STRESS":(data.credit?.z||0)>=0.5?"WIDENING":"NORMAL"} color={cC}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:6}}>
              <div><div style={{fontSize:9,color:DM,fontFamily:F}}>HY</div><div style={{fontSize:16,fontWeight:700,color:ORG,fontFamily:F}}>{v(data.credit?.hy,2)}z</div></div>
              <div><div style={{fontSize:9,color:DM,fontFamily:F}}>IG</div><div style={{fontSize:16,fontWeight:700,color:BLU,fontFamily:F}}>{v(data.credit?.ig,2)}z</div></div>
              <div><div style={{fontSize:9,color:DM,fontFamily:F}}>HY-IG</div><div style={{fontSize:16,fontWeight:700,color:PRP,fontFamily:F}}>{v(data.credit?.diff,2)}</div></div>
            </div>
            <SpreadChart hHY={data.credit?.hHY} hIG={data.credit?.hIG} w={220} h={38}/>
            <div style={{padding:"5px 8px",borderRadius:4,background:"rgba(255,255,255,.015)",marginTop:5}}>
              <div style={{fontSize:8,color:MT,fontFamily:F}}>Composite Z</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4}}><span style={{fontSize:18,fontWeight:700,color:cC,fontFamily:F}}>{v(data.credit?.z,2)}z</span><span style={{fontSize:10,color:DM,fontFamily:F}}>trigger: 1.0z</span></div>
            </div>
          </div>
        </div>

        {/* VIX 6MO RANGE */}
        <div className="hv" style={{padding:"14px 16px",borderRadius:10,background:CB,border:`1px solid ${CBR}`,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:9,letterSpacing:".12em",color:MT,fontFamily:F}}>VIX 6-MONTH RANGE <span style={{color:DM,fontWeight:400}}>Mikey: "needs 6mo highs" · Dover: 20 = dip-buy</span></span>
            {data.vix?.cur&&data.vix?.mo6hi&&data.vix?.mo6lo&&<Badge text={`${(((data.vix.cur-data.vix.mo6lo)/(data.vix.mo6hi-data.vix.mo6lo))*100).toFixed(0)}% of range`} color={vC}/>}
          </div>
          {data.vix?.cur&&data.vix?.mo6hi&&data.vix?.mo6lo?(
          <div style={{position:"relative",height:44,margin:"4px 0 6px"}}>
            <div style={{position:"absolute",left:0,right:0,top:14,height:10,background:"rgba(255,255,255,.035)",borderRadius:5}}>
              {[{v:18,c:YLW},{v:20,c:ORG},{v:22,c:RED}].map((mk,j)=>{
                const p=((mk.v-data.vix.mo6lo)/(data.vix.mo6hi-data.vix.mo6lo))*100;
                return p>=0&&p<=100?<div key={j} style={{position:"absolute",left:`${p}%`,top:-3,width:1,height:16,background:`${mk.c}35`}}/>:null;
              })}
              {(()=>{const p=((data.vix.cur-data.vix.mo6lo)/(data.vix.mo6hi-data.vix.mo6lo))*100;
                return <div style={{position:"absolute",left:`${Math.min(Math.max(p,0),100)}%`,top:-4,transform:"translateX(-50%)"}}><div style={{width:4,height:18,background:vC,borderRadius:2,boxShadow:`0 0 6px ${vC}50`}}/></div>;
              })()}
            </div>
            <div style={{position:"absolute",left:0,bottom:0,fontSize:8,color:GRN,fontFamily:F}}>{data.vix.mo6lo.toFixed(1)}</div>
            {(()=>{const p=((data.vix.cur-data.vix.mo6lo)/(data.vix.mo6hi-data.vix.mo6lo))*100;return <div style={{position:"absolute",left:`${Math.min(Math.max(p,0),100)}%`,top:0,fontSize:8,color:vC,fontFamily:F,transform:"translateX(-50%)",fontWeight:700}}>{data.vix.cur.toFixed(1)}</div>;})()}
            <div style={{position:"absolute",right:0,bottom:0,fontSize:8,color:RED,fontFamily:F}}>{data.vix.mo6hi.toFixed(1)}</div>
          </div>
          ):<div style={{color:DM,fontSize:10,fontFamily:F,padding:10}}>Loading VIX range...</div>}
        </div>

        {/* RISK TREND + HISTORICAL */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div className="hv" style={{padding:"14px 16px",borderRadius:10,background:CB,border:`1px solid ${CBR}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:600,fontFamily:F}}>Risk Trend (30d)</span>
              <Badge text="COMPOSITE" color={ORG}/>
            </div>
            {data.vix?.h30?.length>1&&data.credit?.h30?.length>1&&data.term?.h30?.length>1?
              <Spark data={data.vix.h30.map((vi,i)=>{const vN=(vi-12)/(28-12);const cN=((data.credit.h30[i]||0)+1)/3;const tN=(1.15-(data.term.h30[i]||1.05))/0.2;return(vN+cN+tN)/3;})} color={ORG} w={340} h={44} area thresh={0.4} tC={YLW}/>
              :<div style={{color:DM,fontSize:10,fontFamily:F,padding:10}}>Loading...</div>}
          </div>
          <div className="hv" style={{padding:"14px 16px",borderRadius:10,background:CB,border:`1px solid ${CBR}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:600,fontFamily:F}}>Historical: {risk.tier}</span>
              <Badge text="20yr DATA" color={BLU}/>
            </div>
            {(()=>{const P={NORMAL:{a:"8.2%",b:"1.0%",c:"0.2%",d:"0.0%",e:"-1.1%",f:"0.8x",g:"12",h:"2.1%"},WATCH:{a:"18.5%",b:"4.2%",c:"1.1%",d:"0.3%",e:"-1.8%",f:"1.5x",g:"28",h:"5.4%"},ELEVATED:{a:"33.0%",b:"10.7%",c:"2.7%",d:"0.7%",e:"-2.6%",f:"2.5x",g:"55",h:"9.1%"},RED:{a:"52.0%",b:"22.5%",c:"8.3%",d:"3.2%",e:"-4.8%",f:"5.1x",g:"89",h:"14.7%"},LOADING:{a:"—",b:"—",c:"—",d:"—",e:"—",f:"—",g:"—",h:"—"}};
              const p=P[risk.tier]||P.NORMAL;
              return <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>{[{v:p.a,l:"5%+ dec"},{v:p.b,l:"10%+ dec"},{v:p.c,l:"15%+ dec"},{v:p.d,l:"20%+ crash"},{v:p.e,l:"Med DD"},{v:p.f,l:"vs base"},{v:p.g,l:"Days rec"},{v:p.h,l:"Since '15"}].map((x,j)=>(<div key={j} style={{textAlign:"center",padding:4}}><div style={{fontSize:14,fontWeight:700,color:ORG,fontFamily:F}}>{x.v}</div><div style={{fontSize:9,color:DM}}>{x.l}</div></div>))}</div>;
            })()}
          </div>
        </div>

        {/* S&P CHART */}
        <div className="hv" style={{padding:"14px 16px",borderRadius:10,background:CB,border:`1px solid ${CBR}`,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:11,fontWeight:600,fontFamily:F}}>S&P 500</span>
            <span style={{fontSize:10,color:DM,fontFamily:F}}>6-month price history</span>
          </div>
          <SPXChart data={data.spx?.hM} warns={data.spx?.warns||[]} w={700} h={80}/>
        </div>

        {/* ANALYST NOTES */}
        <div className="hv" style={{padding:"14px 16px",borderRadius:10,background:CB,border:`1px solid ${CBR}`,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:9,letterSpacing:".12em",color:MT,fontFamily:F}}>ANALYST CONTEXT</span>
            <button className="b bg" onClick={()=>setPanel("notes")} style={{fontSize:9}}>+ Marc Notes</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[
              {who:"MARC",c:BLU,n:notes.length?notes.slice(0,4).map(n=>n.t):["No notes yet — click + to add Marc's email"]},
              {who:"MIKEY",c:ORG,n:[
                `PCC ${data.pcc?.cur?data.pcc.cur.toFixed(3):"(manual)"} — ${data.pcc?.cur>=0.9?"in":"check"} fear zone.`,
                `PCCE ${data.pcce?.cur?data.pcce.cur.toFixed(3):"(manual)"} — near upper bound.`,
                `VIX ${v(data.vix?.cur)} — needs ${v(data.vix?.mo6hi)} (6mo hi).`,
              ]},
              {who:"DOVER",c:YLW,n:[
                `Tier: ${risk.tier} (score ${risk.s.toFixed(1)}/10)`,
                `VIX ${v(data.vix?.cur)} — ${data.vix?.cur>=20?"above":"below"} 20 dip-buy.`,
                `Credit ${v(data.credit?.z,2)}z — ${(data.credit?.z||0)>=1.0?"ELEVATED":"watching"} 1.0z.`,
                `VRatio ${v(data.term?.vratio,3)} — ${tStat.toLowerCase()}.`,
              ]},
            ].map((a,i)=>(
              <div key={i} style={{padding:"8px 10px",borderRadius:5,background:"rgba(255,255,255,.008)",borderLeft:`3px solid ${a.c}18`}}>
                <div style={{fontSize:10,fontWeight:700,color:a.c,marginBottom:5,fontFamily:F}}>{a.who}</div>
                {a.n.map((n,j)=>(<div key={j} style={{fontSize:8,color:"#9ca3af",marginBottom:4,lineHeight:1.4,fontFamily:F,paddingLeft:6,borderLeft:`2px solid ${a.c}12`}}>{n}</div>))}
              </div>
            ))}
          </div>
        </div>

        {/* DATA SOURCES */}
        <div style={{padding:"10px 14px",borderRadius:8,background:"rgba(255,255,255,.008)",border:"1px solid rgba(255,255,255,.03)",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:8,letterSpacing:".1em",color:DM,fontFamily:F}}>DATA SOURCES</span>
            <span style={{fontSize:10,color:DM,fontFamily:F}}>Next: {fmt(cd)} · Every {ri}min · Fetched {data.fetchTime}ms</span>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {data.sources&&Object.entries(data.sources).filter(([k])=>k!=="cboeDate").map(([k,v])=>(
              <div key={k} style={{padding:"3px 7px",borderRadius:3,background:"rgba(255,255,255,.012)",fontSize:9,fontFamily:F}}>
                <span style={{color:v?.includes?.("LIVE")?GRN:v==="MANUAL"?YLW:RED}}>● </span>
                <span style={{color:"#9ca3af"}}>{k.toUpperCase()}</span>
                <span style={{color:DM}}> {v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{textAlign:"center",padding:"6px 0",fontSize:8,color:"#1a1f2e",fontFamily:F}}>Market Conditions v3.0 · Dover × Mikey × Marc · Not financial advice</div>
      </div>
    </div>
  );
}
