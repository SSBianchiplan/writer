/* GPlanSiS|Writer — editor e notas (extraído de GPlanSiS-Writer-online.html).
   Ajustes para a versão servidor marcados com [servidor]. A conta, o servidor e as permissões ficam em plataforma.js. */
"use strict";
/* ================= utilidades ================= */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>Date.now();
const fmtDate=t=>{const d=new Date(t),n=new Date();const sameDay=d.toDateString()===n.toDateString();
  if(sameDay)return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const y=new Date(n);y.setDate(n.getDate()-1);if(d.toDateString()===y.toDateString())return 'Ontem';
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:d.getFullYear()===n.getFullYear()?undefined:'numeric'})};
const debounce=(f,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>f(...a),ms)}};
function toast(m,ms=2200){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),ms)}
const textOf=html=>{const d=document.createElement('div');d.innerHTML=html;d.querySelectorAll('del,.toc,style,script').forEach(e=>e.remove());return d.textContent||''};
const countWords=s=>(s.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu)||[]).length;
const AVC=['#b86e00','#1f6fd1','#2e7d32','#8e44ad','#c0392b','#00838f','#6d4c41'];
const avColor=n=>{let h=0;for(const c of String(n))h=(h*31+c.charCodeAt(0))>>>0;return AVC[h%AVC.length]};
const initials=n=>String(n||'?').trim().split(/\s+/).map(p=>p[0]).slice(0,2).join('').toUpperCase();

/* ícones */
const I={
 bold:'<path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" stroke-width="2.2"/>',
 italic:'<path d="M14 5h-4M14 19h-4M14 5l-4 14" stroke-width="2"/>',
 under:'<path d="M7 4v7a5 5 0 0010 0V4M5 20h14" stroke-width="2"/>',
 strike:'<path d="M5 12h14M16 7a4 3 0 00-4-2c-2.5 0-4 1.2-4 3M8 17a4 3 0 004 2c2.5 0 4-1.2 4-3"/>',
 sub:'<path d="M4 6l7 9M11 6l-7 9M15 16h5l-5 4h5"/>', sup:'<path d="M4 9l7 9M11 9l-7 9M15 4h5l-5 4h5"/>',
 color:'<path d="M6 17L11 4h2l5 13M8 12h8"/>', hili:'<path d="M5 20h6M8 15l7-11 4 3-7 11H8z"/>',
 clear:'<path d="M5 5h11M10 5l-3 14M14 14l6 6M20 14l-6 6"/>',
 paint:'<path d="M4 4h13v5H4zM17 6h3v6h-8v3M11 15h2v6h-2z"/>',
 ul:'<circle cx="5" cy="7" r="1.3" fill="currentColor"/><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="5" cy="17" r="1.3" fill="currentColor"/><path d="M9 7h11M9 12h11M9 17h11"/>',
 ol:'<path d="M4 5h1.5v4M4 9h3M4 14h2.5L4 17.5h3M10 7h10M10 12h10M10 17h10"/>',
 check:'<rect x="3.5" y="4.5" width="5" height="5" rx="1"/><path d="M4.8 7l1 1 1.7-1.8M3.5 14.5h5v5h-5zM11 7h9M11 17h9"/>',
 outd:'<path d="M10 6h10M10 12h10M10 18h10M7 9l-3 3 3 3"/>', ind:'<path d="M10 6h10M10 12h10M10 18h10M4 9l3 3-3 3"/>',
 al:'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', ac:'<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
 ar:'<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>', aj:'<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
 lh:'<path d="M10 6h10M10 12h10M10 18h10M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2"/>',
 find:'<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>', repl:'<path d="M4 7h11l-3-3M20 17H9l3 3"/>',
 table:'<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15"/>',
 img:'<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
 link:'<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
 pb:'<path d="M6 3v6h12V3M6 21v-6h12v6M3 12h3M9 12h2M13 12h2M18 12h3"/>', hr:'<path d="M3 12h18"/>',
 toc:'<path d="M4 6h10M4 10h14M7 14h11M7 18h9"/><circle cx="20" cy="6" r=".9" fill="currentColor"/>',
 fn:'<path d="M5 18h10M5 14h14M5 10h14M17 3v5M15 5h4"/>', cap:'<rect x="4" y="3.5" width="16" height="11" rx="1"/><path d="M6 18h12M8 21h8"/>',
 sym:'<path d="M7 19h3v-2.5A6 6 0 1114 16.5V19h3"/>', date:'<rect x="4" y="5" width="16" height="15" rx="1.5"/><path d="M4 10h16M8 3v4M16 3v4"/>',
 box:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7 10h10M7 14h6"/>', code:'<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
 eq:'<path d="M5 9h6M5 15h6M15 6l4 12M19 6l-4 12"/>', draw:'<path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"/>',
 page:'<path d="M6 3h12v18H6z"/>', orient:'<rect x="3" y="7" width="18" height="11" rx="1"/><path d="M7 3h8"/>',
 marg:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 3v18M16 3v18M4 7h16M4 17h16" stroke-dasharray="2 2"/>',
 cols:'<rect x="3.5" y="4" width="7" height="16" rx="1"/><rect x="13.5" y="4" width="7" height="16" rx="1"/>',
 wm:'<path d="M6 18L18 6M9 6h9v9"/>', hdr:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M7 7h10M7 17h10"/>',
 pcol:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 14l6-4 4 3 6-4"/>',
 spell:'<path d="M4 15l3-9 3 9M5 12h4M13 6h3a2.5 2.5 0 010 5h-3zM13 11h3.5a2.5 2.5 0 010 5H13zM4 20l3-2 3 2"/>',
 wc:'<path d="M5 6h3M5 12h14M5 18h9M12 6h7"/>', track:'<path d="M4 20l4-1 9-9-3-3-9 9zM14 4l6 6M16 20h4"/>',
 accept:'<path d="M5 12l5 5 9-10"/>', reject:'<path d="M6 6l12 12M18 6L6 18"/>',
 cmt:'<path d="M4 5h16v11H9l-5 4z"/>', speak:'<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>',
 lock:'<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/>',
 nav:'<path d="M4 5h4M4 12h4M4 19h4M11 5h9M13 12h7M13 19h7"/>', ruler:'<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
 zoom:'<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4M11 8v6M8 11h6"/>', fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
 focus:'<circle cx="12" cy="12" r="3"/><path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/>', read:'<path d="M3 5h7a2 2 0 012 2v12a2 2 0 00-2-2H3zM21 5h-7a2 2 0 00-2 2v12a2 2 0 012-2h7z"/>',
 dark:'<path d="M20 14A8 8 0 019.5 4 8 8 0 1020 14z"/>', lines:'<path d="M4 7h16M4 12h16M4 17h16"/>',
 note:'<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4"/>', tonote:'<path d="M5 4h14v12l-4 4H5z"/><path d="M9 10h6M12 7v6"/>',
 ai:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>', trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
 rowa:'<rect x="4" y="11" width="16" height="9" rx="1"/><path d="M12 3v6M9 6h6"/>', rowb:'<rect x="4" y="4" width="16" height="9" rx="1"/><path d="M12 15v6M9 18h6"/>',
 cola:'<rect x="11" y="4" width="9" height="16" rx="1"/><path d="M3 12h6M6 9v6"/>', colb:'<rect x="4" y="4" width="9" height="16" rx="1"/><path d="M15 12h6M18 9v6"/>',
 merge:'<rect x="3.5" y="5" width="17" height="14" rx="1"/><path d="M8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2"/>', thead:'<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><path d="M3.5 9.5h17" stroke-width="3"/>',
 pin:'<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v8"/>', folder:'<path d="M3 6h7l2 2h9v11H3z"/>', all:'<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
 tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>', back:'<path d="M15 5l-7 7 7 7"/>',
 doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>', dup:'<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V4H4v12h4"/>',
 undo:'<path d="M9 7L4 12l5 5M4 12h10a6 6 0 010 12" transform="scale(1 .75) translate(0 2)"/>', redo:'<path d="M15 7l5 5-5 5M20 12H10a6 6 0 000 12" transform="scale(1 .75) translate(0 2)"/>',
 print:'<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>', open:'<path d="M3 7h7l2 2h9v10H3z"/><path d="M12 12v5M9.5 14.5L12 12l2.5 2.5"/>',
 restore:'<path d="M4 12a8 8 0 108-8 8 8 0 00-6.6 3.5M4 4v4h4"/>', send:'<path d="M4 12l16-8-6 16-2-7z"/>'
};
const svg=(n,sw=1.7)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]||''}</svg>`;

/* ================= estado e persistência ================= */
let LS='gpw:v1'; // [servidor] plataforma.js troca por uma chave por usuário antes do boot()
let S={docs:{},notes:{},folders:['Projetos','Reuniões','Ideias'],settings:{author:'',theme:'',lastDoc:null,lastNote:null}};
try{const r=localStorage.getItem(LS);if(r){const o=JSON.parse(r);S={...S,...o,settings:{...S.settings,...(o.settings||{})}}}}catch(e){}
let localFull=false;
function persistLocal(){try{localStorage.setItem(LS,JSON.stringify(S));localFull=false}catch(e){localFull=true;setSync('err','Navegador sem espaço — exporte um backup')}}
const persistLocalD=debounce(persistLocal,400);

/* nuvem (db do artifact), por pessoa, privada */
const Cloud={db:null,col:null,on:false,pend:new Map(),tooBig:new Set(),
  async init(){
    if(!window.claude||!claude.use)return;
    try{
      const [db,user]=await Promise.all([claude.use('db'),claude.use('user')]);
      if(!db||!user)return;
      const id=await user.id();if(!id)return;
      try{const me=await user.me();if(me&&me.name&&!S.settings.author)S.settings.author=me.name}catch(e){}
      this.db=db;this.col=db.collection('data/users/'+id);
      setSync('busy','Sincronizando…');
      const snap=await this.col.get();let changed=false;
      snap.docs.forEach(d=>{const o=d.data();if(!o)return;
        if(d.id==='meta'){if(Array.isArray(o.folders)&&(o.updatedAt||0)>(S.metaAt||0)){S.folders=o.folders;S.metaAt=o.updatedAt;changed=true}return}
        const kind=d.id.slice(0,2),id2=d.id.slice(2),store=kind==='d_'?S.docs:kind==='n_'?S.notes:null;if(!store)return;
        const loc=store[id2];
        if(o.deletedForever){if(loc){delete store[id2];changed=true}return}
        if(!loc||(o.updatedAt||0)>(loc.updatedAt||0)){store[id2]=o;changed=true}
      });
      this.on=true;
      // envia o que só existe aqui
      const ids=new Set(snap.docs.map(d=>d.id));
      Object.values(S.docs).forEach(d=>{if(!ids.has('d_'+d.id))this.put('d',d)});
      Object.values(S.notes).forEach(n=>{if(!ids.has('n_'+n.id))this.put('n',n)});
      if(changed){persistLocal();onCloudMerged()}
      setSync('ok','Sincronizado');
    }catch(e){console.warn('db',e);this.on=false;setSync('ok','Salvo neste navegador')}
  },
  put(kind,obj){if(!this.on)return;this.pend.set(kind+'_'+obj.id,obj);this.flush()},
  meta(){if(!this.on)return;S.metaAt=now();this.pend.set('meta',{folders:S.folders,updatedAt:S.metaAt});this.flush()},
  remove(kind,id){if(!this.on)return;this.pend.delete(kind+'_'+id);this.col.doc(kind+'_'+id).set({deletedForever:true,updatedAt:now()}).catch(()=>{})},
  flush:debounce(async function(){
    const items=[...Cloud.pend.entries()];Cloud.pend.clear();if(!items.length)return;
    setSync('busy','Sincronizando…');let bad=0;
    for(const [k,o] of items){
      try{await Cloud.col.doc(k).set(JSON.parse(JSON.stringify(o)));Cloud.tooBig.delete(k)}
      catch(e){bad++;if(e&&(e.code==='invalid_argument'||e.code==='resource_exhausted'||e.code==='quota_exceeded'))Cloud.tooBig.add(k)}
    }
    if(Cloud.tooBig.size)setSync('err','Arquivo grande demais para sincronizar — fica salvo neste navegador');
    else if(bad)setSync('err','Sem conexão — salvo neste navegador');
    else setSync('ok','Sincronizado');
  },900)
};
function setSync(st,msg){const e=$('#sync');e.className=st==='ok'?'':st;e.title=msg;$('span',e).textContent=msg}

/* downloads */
let DL=null;
async function saveBlob(name,data,mime='application/octet-stream'){
  const blob=data instanceof Blob?data:new Blob([data],{type:mime});
  try{if(window.claude&&claude.use){DL=DL||await claude.use('downloads')}}catch(e){}
  if(DL){try{await DL.save({filename:name,data:blob});toast('Arquivo salvo: '+name)}catch(e){toast(e&&e.code==='declined'?'Download cancelado':'Não foi possível salvar: '+(e.message||e.code||e))}return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
}
const safeName=s=>(s||'documento').replace(/[\\/:*?"<>|]+/g,'-').trim().slice(0,80)||'documento';
const LIBG={jszip:'JSZip',mammoth:'mammoth'};
function loadScript(src){return new Promise((res,rej)=>{for(const k in LIBG)if(src.includes(k)&&window[LIBG[k]])return res();if($(`script[src="${src}"]`))return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Não foi possível carregar '+src));document.head.appendChild(s)})}

/* ================= menus e diálogos ================= */
function closeMenus(){$$('.menu').forEach(m=>m.remove())}
function menu(anchor,items){
  closeMenus();const m=document.createElement('div');m.className='menu';m.setAttribute('role','menu');
  items.forEach(it=>{if(it==='-'){m.appendChild(document.createElement('hr'));return}
    const b=document.createElement('button');b.innerHTML=(it.icon?svg(it.icon):'')+`<span>${esc(it.label)}</span>`+(it.k?`<span class="k">${esc(it.k)}</span>`:'');
    if(it.style)$('span',b).style.cssText=it.style;
    b.onmousedown=e=>e.preventDefault();b.onclick=()=>{closeMenus();it.run()};m.appendChild(b)});
  document.body.appendChild(m);const r=anchor.getBoundingClientRect();
  let x=r.left,y=r.bottom+4;const mw=m.offsetWidth,mh=m.offsetHeight;
  if(x+mw>innerWidth-6)x=innerWidth-mw-6;if(y+mh>innerHeight-6)y=Math.max(6,r.top-mh-4);
  m.style.left=Math.max(6,x)+'px';m.style.top=y+'px';return m;
}
document.addEventListener('mousedown',e=>{if(!e.target.closest('.menu'))closeMenus()},true);
function modal({title,body,buttons=[],wide=false,onOpen}){
  return new Promise(res=>{
    const sc=document.createElement('div');sc.id='scrim';
    sc.innerHTML=`<div class="modal${wide?' wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mh">${esc(title)}<button class="ib" data-x style="margin-left:auto" aria-label="Fechar">×</button></div><div class="mb">${body}</div><div class="mf"></div></div>`;
    const mf=$('.mf',sc);const done=v=>{sc.remove();document.removeEventListener('keydown',kd,true);res(v)};
    buttons.forEach(b=>{const e=document.createElement('button');e.className='tb'+(b.primary?' primary':'')+(b.danger?' danger':'');e.textContent=b.label;e.onclick=()=>{const v=b.value?b.value(sc):b.label;if(v===false)return;done(v)};mf.appendChild(e)});
    if(!buttons.length)mf.remove();
    $('[data-x]',sc).onclick=()=>done(null);sc.onmousedown=e=>{if(e.target===sc)done(null)};
    const kd=e=>{if(e.key==='Escape'){e.stopPropagation();done(null)}if(e.key==='Enter'&&!e.shiftKey&&e.target.tagName!=='TEXTAREA'){const p=$('.tb.primary',sc);if(p){e.preventDefault();p.click()}}};
    document.addEventListener('keydown',kd,true);document.body.appendChild(sc);
    const f=$('input,textarea,select',sc);if(f)setTimeout(()=>{f.focus();f.select&&f.select()},30);
    onOpen&&onOpen(sc,done);
  });
}
async function ask(title,label,val=''){const r=await modal({title,body:`<label class="fld"><span>${esc(label)}</span><input class="inp" id="mAsk" value="${esc(val)}"></label>`,buttons:[{label:'Cancelar'},{label:'OK',primary:true,value:sc=>$('#mAsk',sc).value}]});return r==='Cancelar'?null:r}
async function confirmDlg(title,msg,ok='Excluir'){const r=await modal({title,body:`<p style="margin:0">${esc(msg)}</p>`,buttons:[{label:'Cancelar'},{label:ok,primary:true,danger:true,value:()=>true}]});return r===true}

/* tema */
function applyTheme(){const t=S.settings.theme;if(t)document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme}
$('#bTheme').onclick=()=>{const dark=matchMedia('(prefers-color-scheme: dark)').matches;const cur=S.settings.theme||(dark?'dark':'light');S.settings.theme=cur==='dark'?'light':'dark';applyTheme();persistLocalD()};
applyTheme();
const author=()=>S.settings.author||'Eu';
"use strict";
/* ================= documento ================= */
const ed=$('#ed'),paper=$('#paper'),sheets=$('#sheets'),fnarea=$('#fnarea'),desk=$('#desk'),zoomer=$('#zoomer');
const PX=96/25.4;
const SIZES={A4:[210,297],Carta:[215.9,279.4],'Ofício':[215.9,355.6],A3:[297,420],A5:[148,210]};
const MARGINS={Normal:[25,25,25,25],ABNT:[30,20,20,30],Estreita:[12.7,12.7,12.7,12.7],Moderada:[25.4,19.1,25.4,19.1],Larga:[25.4,50.8,25.4,50.8]};
const defLayout=()=>({size:'A4',orient:'p',m:[25,25,25,25],cols:1,wm:'',hdr:'',ftr:'',pnum:'r',pcol:''});
let D=null,view='print',zoom=100,fitMode=false,lastRange=null,showMarks=true,showCm=true;

function newDocObj(t){const d={id:uid(),title:t.title||'Documento sem título',html:t.html||'<p><br></p>',createdAt:now(),updatedAt:now(),layout:{...defLayout(),...(t.layout||{})},comments:t.comments||[],fns:t.fns||{},track:false,locked:false,words:0};return d}
function createDoc(t){const d=newDocObj(t);S.docs[d.id]=d;persistLocal();Cloud.put('d',d);openDoc(d.id);return d}
function openDoc(id){
  const d=S.docs[id];if(!d)return;
  if(D&&D!==d)flushSave();
  D=d;d.layout={...defLayout(),...(d.layout||{})};d.comments=d.comments||[];d.fns=d.fns||{};
  S.settings.lastDoc=id;persistLocalD();
  ed.innerHTML=d.html||'<p><br></p>';ed.contentEditable=d.locked?'false':'true';
  $('#dname').value=d.title;document.title=d.title+' — GPlanSiS|Writer';
  setMode('docs');showHome(false);
  $('#stTrack').hidden=!d.track;
  lastRange=null;layoutNow();refreshPanels();updateState();$('#stPage').textContent=`Página 1 de ${D._pages||1}`;
  desk.scrollTop=0;
  if(innerWidth<900)requestAnimationFrame(fitWidth);
}
function cleanHTML(){
  const c=ed.cloneNode(true);
  c.querySelectorAll('.pgsp').forEach(e=>e.remove());
  c.querySelectorAll('.selimg').forEach(e=>e.classList.remove('selimg'));
  c.querySelectorAll('.cellsel').forEach(e=>e.classList.remove('cellsel'));
  c.querySelectorAll('.cm.on').forEach(e=>e.classList.remove('on'));
  c.querySelectorAll('[class=""]').forEach(e=>e.removeAttribute('class'));
  return c.innerHTML;
}
let saveT=null;
function markDirty(){if(!D)return;setSync('busy','Salvando…');clearTimeout(saveT);saveT=setTimeout(flushSave,600);layoutSoon()}
function flushSave(){if(!D)return;clearTimeout(saveT);saveT=null;const h=cleanHTML();
  if(h!==D.html||D._dirty){D.html=h;D.updatedAt=now();D.words=countWords(textOf(h));D._dirty=false;persistLocal();Cloud.put('d',strip(D))}
  if(!Cloud.on&&!localFull)setSync('ok','Salvo neste navegador');else if(Cloud.on&&!Cloud.pend.size&&!Cloud.tooBig.size)setSync('ok','Sincronizado')}
const strip=d=>{const o={...d};delete o._dirty;return o};
function touch(){if(D){D._dirty=true;markDirty()}}
$('#dname').addEventListener('change',e=>{if(!D)return;D.title=e.target.value.trim()||'Documento sem título';e.target.value=D.title;document.title=D.title+' — GPlanSiS|Writer';touch()});
$('#dname').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ed.focus()}});

/* ================= seleção ================= */
document.addEventListener('selectionchange',()=>{const s=getSelection();if(s.rangeCount&&ed.contains(s.anchorNode)){lastRange=s.getRangeAt(0).cloneRange();stateSoon();caretPage()}
  else if(s.rangeCount&&$('#nEd').contains(s.anchorNode)){NOTES.lastRange=s.getRangeAt(0).cloneRange()}});
function restoreSel(){if(document.activeElement!==ed)ed.focus({preventScroll:true});if(lastRange&&ed.contains(lastRange.startContainer)){const s=getSelection();s.removeAllRanges();s.addRange(lastRange)}else{const r=document.createRange();r.selectNodeContents(ed);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r)}}
function curRange(){restoreSel();const s=getSelection();return s.rangeCount?s.getRangeAt(0):null}
function exec(c,v=null){if(D&&D.locked)return toast('Documento protegido — desbloqueie em Revisão');restoreSel();document.execCommand('styleWithCSS',false,true);document.execCommand(c,false,v);afterEdit()}
function afterEdit(){markDirty();updateState()}
function closestIn(n,sel,root=ed){while(n&&n!==root){if(n.nodeType===1&&n.matches(sel))return n;n=n.parentNode}return null}
const BLK='p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th,figure,div.callout';
function blocksInSel(){const r=curRange();if(!r)return[];
  let bs=$$(BLK,ed).filter(b=>r.intersectsNode(b)&&!b.closest('.toc')&&!b.querySelector('p,h1,h2,h3,h4,li,blockquote,pre'));
  if(!bs.length){const b=closestIn(r.startContainer,BLK);if(b)bs=[b]}return bs}
function textNodesInRange(r){
  if(r.collapsed)return[];
  if(r.startContainer.nodeType===3&&r.startOffset>0&&r.startOffset<r.startContainer.length){const n=r.startContainer.splitText(r.startOffset);r.setStart(n,0)}
  if(r.endContainer.nodeType===3&&r.endOffset>0&&r.endOffset<r.endContainer.length){r.endContainer.splitText(r.endOffset)}
  const root=r.commonAncestorContainer.nodeType===3?r.commonAncestorContainer.parentNode:r.commonAncestorContainer;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const out=[];let n;
  while((n=w.nextNode())){if(!r.intersectsNode(n))continue;
    if(n===r.endContainer&&r.endOffset===0)continue;if(n===r.startContainer&&r.startOffset===n.length&&n.length)continue;
    if(n.parentNode.closest&&n.parentNode.closest('.toc,.pgsp,sup.fn'))continue;if(n.nodeValue.length)out.push(n)}
  return out}
function wrapNodes(nodes,mk){return nodes.map(n=>{const w=mk();n.parentNode.insertBefore(w,n);w.appendChild(n);return w})}

/* ================= paginação ================= */
function dims(){const L=D.layout;let [w,h]=SIZES[L.size]||SIZES.A4;if(L.orient==='l')[w,h]=[h,w];return{w,h,m:L.m}}
const layoutSoon=debounce(()=>layoutNow(),260);
function layoutNow(){
  if(!D)return;const{w,h,m}=dims(),[mt,mr,mb,ml]=m,L=D.layout,Hpx=h*PX;
  paper.style.width=w+'mm';ed.style.padding=`${Math.round(mt*PX)}px ${Math.round(mr*PX)}px 0 ${Math.round(ml*PX)}px`/* [servidor] px inteiros: recuo fracionário no elemento editável impede selecionar arrastando no Chromium */;fnarea.style.margin=`18px ${mr}mm 0 ${ml}mm`;
  ed.className=(L.cols>1?'cols'+L.cols:'')+(showMarks?'':' hidemarks')+(showCm?'':' nocm');
  document.documentElement.dataset.paper=S.settings.darkPaper?'dark':'';
  sheets.style.setProperty('--pc',L.pcol||'');
  renderFns();buildTOC();
  // limpa espaçadores
  ed.querySelectorAll('.pgsp').forEach(e=>e.remove());
  if(view!=='web'&&L.cols<=1){
    const kids=[...ed.children];let force=false;const usable=(h-mt-mb)*PX;
    for(let i=0;i<kids.length;i++){const el=kids[i];if(el.classList.contains('pgsp'))continue;
      if(el.classList.contains('pb')){force=true;continue}
      let top=el.offsetTop,bot=top+el.offsetHeight,p=Math.floor(top/Hpx);
      const pageBot=p*Hpx+(h-mb)*PX,next=(p+1)*Hpx+mt*PX;
      let target=null;
      if(force)target=next;
      else if(top>=pageBot-1)target=next;
      else if(bot>pageBot+1&&el.offsetHeight<usable*.5&&top>p*Hpx+mt*PX+4)target=next;
      force=false;
      if(target!==null&&target>top){
        const sp=document.createElement('div');sp.className='pgsp';sp.contentEditable='false';sp.setAttribute('aria-hidden','true');
        sp.style.cssText='height:0;margin:0;padding:0;border:0;pointer-events:none';el.before(sp);
        let need=target-el.offsetTop;sp.style.height=Math.max(0,need)+'px';
        const d2=target-el.offsetTop;if(Math.abs(d2)>.5)sp.style.height=Math.max(0,need+d2)+'px';
      }
    }
  }
  const total=ed.offsetHeight+(fnarea.innerHTML?fnarea.offsetHeight+18:0)+mb*PX;
  const pages=Math.max(1,Math.ceil((total-2)/Hpx));
  paper.style.minHeight=(pages*h)+'mm';paper.style.height=view==='web'?'auto':(pages*h)+'mm';
  if(view==='web'){paper.style.minHeight='auto';paper.style.paddingBottom=mb+'mm'}else paper.style.paddingBottom='0';
  D._pages=pages;
  // folhas
  let html='';const hd=fill(L.hdr),ft=fill(L.ftr);
  for(let i=0;i<pages;i++){const gT=i?5:0,gB=i<pages-1?5:0;
    const pn=L.pnum!=='none'?`Página ${i+1} de ${pages}`:'';
    const fl=L.pnum==='l'?pn:'',fc=L.pnum==='c'?pn:'',fr=L.pnum==='r'?pn:'';
    html+=`<div class="sheet" style="top:${i*Hpx+gT}px;height:${Hpx-gT-gB}px;${L.pcol?'background:'+L.pcol:''}">`+
      (hd?`<div class="hdr" style="top:${Math.max(6,mt*PX/2-8-gT)}px;padding:0 ${mr}mm 0 ${ml}mm"><span>${esc(hd)}</span></div>`:'')+
      `<div class="ftr" style="bottom:${Math.max(6,mb*PX/2-8-gB)}px;padding:0 ${mr}mm 0 ${ml}mm"><span>${esc(ft)}${fl?(ft?' · ':'')+fl:''}</span><span>${fc}</span><span>${fr}</span></div>`+
      (L.wm?`<div class="wm"><span>${esc(L.wm)}</span></div>`:'')+`<div class="pn">${i+1}</div></div>`}
  sheets.innerHTML=html;
  fillTOCPages(Hpx);
  drawRuler(w,ml,mr);
  stats();if(!$('#navP').hidden)renderNav();
}
const fill=s=>(s||'').replace(/\{titulo\}/gi,D.title).replace(/\{data\}/gi,new Date().toLocaleDateString('pt-BR'));
function drawRuler(w,ml,mr){const r=$('#ruler');if(S.settings.noRuler||view==='web'){r.hidden=true;return}r.hidden=false;r.style.width=w+'mm';
  let t='';for(let x=0;x<=w;x+=5){const cm=(x-ml)/10;const big=Math.abs((x-ml)%10)<.01;t+=`<line x1="${x}" x2="${x}" y1="${big?2.4:3.4}" y2="5" stroke="currentColor" stroke-width=".18"/>`;
    if(big&&x>ml&&x<w-mr)t+=`<text x="${x}" y="2" font-size="1.9" text-anchor="middle" fill="currentColor" font-family="IBM Plex Mono,monospace">${Math.round(cm)}</text>`}
  r.innerHTML=`<svg viewBox="0 0 ${w} 5.3" width="100%" height="20" style="color:var(--muted)"><rect x="0" y="0" width="${w}" height="5.3" fill="var(--panel)" rx=".6"/><rect x="0" y="0" width="${ml}" height="5.3" fill="var(--panel2)"/><rect x="${w-mr}" y="0" width="${mr}" height="5.3" fill="var(--panel2)"/>${t}</svg>`}
function caretPage(){if(!D||!lastRange)return;const r=lastRange.getClientRects()[0]||lastRange.startContainer.parentElement?.getBoundingClientRect?.();if(!r)return;
  const pr=paper.getBoundingClientRect(),z=zoom/100,{h}=dims();const p=Math.min(D._pages||1,Math.max(1,Math.floor((r.top-pr.top)/z/(h*PX))+1));$('#stPage').textContent=`Página ${p} de ${D._pages||1}`}
function stats(){const t=textOf(ed.innerHTML);$('#stWords').textContent=countWords(t).toLocaleString('pt-BR')+' palavras';caretPage()}

/* sumário */
function headings(){return $$('h1,h2,h3',ed).filter(h=>!h.closest('.toc'))}
function buildTOC(){const tocs=$$('.toc',ed);if(!tocs.length)return;const hs=headings();
  hs.forEach(h=>{if(!h.dataset.h)h.dataset.h=uid()});
  const inner=`<div class="tt">Sumário</div><button class="upd" data-act="updtoc" contenteditable="false">Atualizar</button>`+(hs.length?hs.map(h=>`<a class="l${h.tagName[1]}" data-go="${h.dataset.h}"><span>${esc(h.textContent.trim()||'(sem título)')}</span><span class="dots"></span><span class="pg">…</span></a>`).join(''):'<div style="color:#8e979d;font-size:.9em">Use Título 1, 2 ou 3 para montar o sumário.</div>');
  tocs.forEach(t=>{if(t.innerHTML!==inner)t.innerHTML=inner})}
function fillTOCPages(Hpx){$$('.toc a[data-go]',ed).forEach(a=>{const h=ed.querySelector(`[data-h="${a.dataset.go}"]`);const s=a.querySelector('.pg');if(h&&s)s.textContent=Math.floor(h.offsetTop/Hpx)+1})}

/* notas de fim */
function renderFns(){const sups=$$('sup.fn',ed);const seen=new Set();
  sups.forEach((s,i)=>{s.textContent=i+1;seen.add(s.dataset.fn)});
  Object.keys(D.fns).forEach(k=>{if(!seen.has(k))delete D.fns[k]});
  // numeração de legendas
  const k={fig:0,tab:0,eq:0};$$('.cap',ed).forEach(c=>{const t=c.dataset.k||'fig';k[t]=(k[t]||0)+1;const n=c.querySelector('.capn');const lbl={fig:'Figura',tab:'Tabela',eq:'Equação'}[t]+' '+k[t];if(n&&n.textContent!==lbl)n.textContent=lbl});
  const h=sups.length?`<div style="font:600 10pt var(--font);margin-bottom:4px">Notas</div><ol>`+sups.map(s=>`<li data-fn="${s.dataset.fn}" title="Clique para editar">${esc(D.fns[s.dataset.fn]||'')}</li>`).join('')+'</ol>':'';
  if(fnarea.innerHTML!==h)fnarea.innerHTML=h}
fnarea.addEventListener('click',async e=>{const li=e.target.closest('li[data-fn]');if(!li)return;const v=await ask('Editar nota de fim','Texto da nota',D.fns[li.dataset.fn]||'');if(v!==null){D.fns[li.dataset.fn]=v;touch();layoutNow()}});

/* ================= zoom e vistas ================= */
function setZoom(z,fit=false){fitMode=fit;zoom=Math.max(40,Math.min(200,Math.round(z)));zoomer.style.zoom=zoom/100;$('#zoomR').value=zoom;$('#zVal').textContent=zoom+'%';caretPage()}
function fitWidth(){if(!D)return;const{w}=dims();const avail=desk.clientWidth-30;setZoom(Math.min(100,avail/(w*PX+50)*100),true)}
$('#zoomR').oninput=e=>setZoom(+e.target.value);$('#zIn').onclick=()=>setZoom(zoom+10);$('#zOut').onclick=()=>setZoom(zoom-10);$('#zVal').onclick=fitWidth;
addEventListener('resize',debounce(()=>{if(fitMode)fitWidth()},150));
function setView(v){view=v;document.body.classList.toggle('web',v==='web');document.body.classList.toggle('focus',v==='focus');
  $$('#status [data-view]').forEach(b=>b.classList.toggle('badge',b.dataset.view===v));layoutNow();if(v==='focus')toast('Modo foco — Esc para sair')}
$$('#status [data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));

/* ================= edição: eventos ================= */
ed.addEventListener('input',()=>{afterEdit();if(!ed.innerHTML.trim()||ed.innerHTML==='<br>')ed.innerHTML='<p><br></p>'});
ed.addEventListener('click',e=>{
  const a=e.target.closest('[data-act="updtoc"]');if(a){e.preventDefault();buildTOC();layoutNow();toast('Sumário atualizado');return}
  const go=e.target.closest('.toc a[data-go]');if(go){const h=ed.querySelector(`[data-h="${go.dataset.go}"]`);if(h)h.scrollIntoView({block:'center',behavior:'smooth'});return}
  const li=e.target.closest('ul.check>li');if(li){const r=li.getBoundingClientRect(),z=zoom/100;if((e.clientX-r.left)/z<20){li.classList.toggle('done');afterEdit();e.preventDefault()}}
  const fn=e.target.closest('sup.fn');if(fn){const li2=fnarea.querySelector(`li[data-fn="${fn.dataset.fn}"]`);li2&&li2.scrollIntoView({block:'center',behavior:'smooth'})}
  const cm=e.target.closest('.cm');if(cm&&showCm){openSide('comments');focusComment(cm.dataset.c)}
  if(e.target.tagName==='IMG')selectImg(e.target);else selectImg(null);
  if(e.ctrlKey||e.metaKey){const ln=e.target.closest('a[href]');if(ln&&!ln.closest('.toc'))window.open(ln.href,'_blank','noopener')}
});
ed.addEventListener('keydown',e=>{
  if(e.key==='Tab'){const td=closestIn(getSelection().anchorNode,'td,th');if(td){e.preventDefault();const cells=$$('td,th',td.closest('table'));let i=cells.indexOf(td)+(e.shiftKey?-1:1);if(i>=cells.length){tblOp('rowb');i=cells.length}const c=$$('td,th',td.closest('table'))[i];if(c){const r=document.createRange();r.selectNodeContents(c);const s=getSelection();s.removeAllRanges();s.addRange(r)}return}
    if(closestIn(getSelection().anchorNode,'li')){e.preventDefault();exec(e.shiftKey?'outdent':'indent');return}
    e.preventDefault();exec('insertText','\t')}
});
/* colar limpo */
ed.addEventListener('paste',e=>{
  const cd=e.clipboardData;if(!cd)return;
  const files=[...cd.files||[]].filter(f=>f.type.startsWith('image/'));
  if(files.length){e.preventDefault();files.forEach(f=>insertImageFile(f));return}
  const h=cd.getData('text/html'),t=cd.getData('text/plain');e.preventDefault();
  let html=h?sanitize(h):esc(t).split(/\r?\n\r?\n/).map(p=>`<p>${p.replace(/\r?\n/g,'<br>')}</p>`).join('');
  if(!h&&!/\n/.test(t))html=esc(t);
  if(D.track)html=`<ins data-a="${esc(author())}" data-t="${now()}">${html}</ins>`;
  exec('insertHTML',html)});
ed.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('application/x-gpw-note'))e.preventDefault()});
ed.addEventListener('drop',e=>{const id=e.dataTransfer.getData('application/x-gpw-note');if(!id)return;e.preventDefault();
  let r=document.caretRangeFromPoint?document.caretRangeFromPoint(e.clientX,e.clientY):null;if(r){const s=getSelection();s.removeAllRanges();s.addRange(r);lastRange=r.cloneRange()}insertNote(id)});

/* sanitização para colar, IA e importação */
const OK_TAGS=new Set('P H1 H2 H3 H4 H5 H6 UL OL LI STRONG B EM I U S SUB SUP BR TABLE THEAD TBODY TR TD TH BLOCKQUOTE PRE CODE A IMG HR SPAN FIGURE FIGCAPTION DIV'.split(' '));
function sanitize(html){
  const d=new DOMParser().parseFromString(html,'text/html');const out=document.createElement('div');
  const walk=(n,p)=>{n.childNodes.forEach(c=>{
    if(c.nodeType===3){p.appendChild(document.createTextNode(c.nodeValue));return}
    if(c.nodeType!==1)return;const tag=c.tagName;
    if(/^(SCRIPT|STYLE|META|LINK|TITLE|O:P|XML)$/i.test(tag))return;
    if(!OK_TAGS.has(tag)){walk(c,p);return}
    const e=document.createElement(tag==='B'?'strong':tag==='I'?'em':tag==='DIV'?'p':tag.toLowerCase());
    if(tag==='A'){const h=c.getAttribute('href')||'';if(/^(https?:|mailto:|#)/i.test(h))e.setAttribute('href',h)}
    if(tag==='IMG'){const s=c.getAttribute('src')||'';if(/^(data:image\/|https?:)/i.test(s))e.setAttribute('src',s);else return}
    if(tag==='TD'||tag==='TH'){['colspan','rowspan'].forEach(a=>c.getAttribute(a)&&e.setAttribute(a,c.getAttribute(a)))}
    const st=c.getAttribute('style')||'';const keep=[];
    st.replace(/(font-weight|font-style|text-decoration|text-align|color|background-color)\s*:\s*([^;]+)/gi,(m,k,v)=>{if(!/mso-|windowtext/i.test(v))keep.push(k+':'+v.trim())});
    if(keep.length&&tag!=='TABLE')e.setAttribute('style',keep.join(';'));
    if(tag==='SPAN'&&!keep.length){walk(c,p);return}
    walk(c,e);p.appendChild(e)})};
  walk(d.body,out);
  out.querySelectorAll('p').forEach(p=>{if(p.querySelector('p,ul,ol,table,h1,h2,h3,blockquote,pre')){const f=document.createDocumentFragment();while(p.firstChild)f.appendChild(p.firstChild);p.replaceWith(f)}});
  return out.innerHTML}

/* ================= formatação ================= */
function applyFontSize(pt){const r=curRange();if(!r)return;
  if(r.collapsed){const s=document.createElement('span');s.style.fontSize=pt+'pt';s.textContent='\u200b';r.insertNode(s);const nr=document.createRange();nr.setStart(s.firstChild,1);nr.collapse(true);const se=getSelection();se.removeAllRanges();se.addRange(nr);afterEdit();return}
  document.execCommand('styleWithCSS',false,false);document.execCommand('fontSize',false,'7');document.execCommand('styleWithCSS',false,true);
  const fs=$$('font[size="7"]',ed);let first=null,last=null;
  fs.forEach(f=>{const s=document.createElement('span');s.style.fontSize=pt+'pt';while(f.firstChild)s.appendChild(f.firstChild);f.replaceWith(s);s.querySelectorAll('[style*="font-size"]').forEach(x=>x.style.fontSize='');first=first||s;last=s});
  $$('span[style*="xxx-large"]',ed).forEach(s=>{s.style.fontSize=pt+'pt';first=first||s;last=s});
  if(first){const nr=document.createRange();nr.setStartBefore(first);nr.setEndAfter(last);const se=getSelection();se.removeAllRanges();se.addRange(nr);lastRange=nr.cloneRange()}
  afterEdit()}
function setBlock(tag,cls=''){exec('formatBlock','<'+tag+'>');blocksInSel().forEach(b=>{if(b.tagName.toLowerCase()===tag){b.className=cls}});afterEdit()}
function lineHeight(v){blocksInSel().forEach(b=>b.style.lineHeight=v);afterEdit()}
function paraSpace(k,v){blocksInSel().forEach(b=>b.style[k]=v+'pt');afterEdit()}
function indentBlocks(dir){const r=curRange();if(r&&closestIn(r.startContainer,'li'))return exec(dir>0?'indent':'outdent');
  blocksInSel().forEach(b=>{const cur=parseFloat(b.style.marginLeft)||0;b.style.marginLeft=Math.max(0,cur+dir*12.5)+'mm';if(!parseFloat(b.style.marginLeft))b.style.marginLeft=''});afterEdit()}
function toggleChecklist(){const r=curRange();const ul=r&&closestIn(r.startContainer,'ul');
  if(ul&&ul.classList.contains('check')){ul.classList.remove('check');return afterEdit()}
  if(!ul)exec('insertUnorderedList');const u2=closestIn(getSelection().anchorNode,'ul');if(u2)u2.classList.add('check');afterEdit()}
function listStyle(type){const r=curRange();let l=r&&closestIn(r.startContainer,'ul,ol');const ord=/decimal|alpha|roman/.test(type);
  if(!l){exec(ord?'insertOrderedList':'insertUnorderedList');l=closestIn(getSelection().anchorNode,'ul,ol')}
  if(l){l.classList.remove('check');l.style.listStyleType=type}afterEdit()}
function changeCase(mode){const r=curRange();if(!r||r.collapsed)return toast('Selecione o texto');const ns=textNodesInRange(r);let startSent=true;
  ns.forEach(n=>{let s=n.nodeValue;
    if(mode==='up')s=s.toLocaleUpperCase('pt-BR');else if(mode==='low')s=s.toLocaleLowerCase('pt-BR');
    else if(mode==='title')s=s.toLocaleLowerCase('pt-BR').replace(/(^|[\s(\-"“])(\p{L})/gu,(m,a,b)=>a+b.toLocaleUpperCase('pt-BR'));
    else if(mode==='sent'){s=s.toLocaleLowerCase('pt-BR').replace(/(\p{L})/gu,(m)=>{if(startSent){startSent=false;return m.toLocaleUpperCase('pt-BR')}return m});s.replace(/[.!?]\s*$/,()=>{startSent=true})}
    n.nodeValue=s});
  const nr=document.createRange();nr.setStartBefore(ns[0]);nr.setEndAfter(ns[ns.length-1]);const se=getSelection();se.removeAllRanges();se.addRange(nr);afterEdit()}
/* pincel */
let painter=null;
function startPainter(){const r=curRange();if(!r)return;let el=r.startContainer;if(el.nodeType===3)el=el.parentElement;const cs=getComputedStyle(el);
  painter={ff:cs.fontFamily,fs:parseFloat(cs.fontSize)*.75,b:+cs.fontWeight>=600,i:cs.fontStyle==='italic',u:cs.textDecorationLine.includes('underline'),s:cs.textDecorationLine.includes('line-through'),c:cs.color,bg:cs.backgroundColor};
  ed.style.cursor='copy';toast('Selecione o texto que vai receber a formatação');renderTools()}
ed.addEventListener('mouseup',()=>{if(!painter)return;setTimeout(()=>{const s=getSelection();if(!s.rangeCount||s.isCollapsed)return;lastRange=s.getRangeAt(0).cloneRange();const p=painter;painter=null;ed.style.cursor='';
  exec('removeFormat');exec('fontName',p.ff.split(',')[0].replace(/"/g,''));applyFontSize(Math.round(p.fs*2)/2);
  if(p.b)exec('bold');if(p.i)exec('italic');if(p.u)exec('underline');if(p.s)exec('strikeThrough');exec('foreColor',p.c);
  if(p.bg&&p.bg!=='rgba(0, 0, 0, 0)'&&p.bg!=='transparent')exec('hiliteColor',p.bg);renderTools()},10)});

/* ================= inserir ================= */
function insertHTML(h){if(D&&D.locked)return toast('Documento protegido');restoreSel();document.execCommand('insertHTML',false,h);afterEdit()}
function tableHTML(r,c){let h='<table><tbody>';for(let i=0;i<r;i++){h+='<tr>';for(let j=0;j<c;j++)h+=i===0?'<th><br></th>':'<td><br></td>';h+='</tr>'}return h+'</tbody></table><p><br></p>'}
function tablePicker(anchor){closeMenus();const m=document.createElement('div');m.className='menu';m.style.padding='10px';
  m.innerHTML='<div class="small" id="tgl" style="margin-bottom:6px">Inserir tabela</div><div class="tgrid">'+Array.from({length:80},(_,i)=>`<i data-r="${Math.floor(i/10)+1}" data-c="${i%10+1}"></i>`).join('')+'</div><button class="tb" style="margin-top:8px;width:100%" id="tcust">Tamanho personalizado…</button>';
  document.body.appendChild(m);const r=anchor.getBoundingClientRect();m.style.left=Math.min(r.left,innerWidth-m.offsetWidth-6)+'px';m.style.top=r.bottom+4+'px';
  m.onmousedown=e=>e.preventDefault();
  m.onmouseover=e=>{const t=e.target.dataset;if(!t.r)return;$$('i',m).forEach(i=>i.classList.toggle('on',+i.dataset.r<=+t.r&&+i.dataset.c<=+t.c));$('#tgl',m).textContent=`Tabela ${t.r} × ${t.c}`};
  m.onclick=async e=>{const t=e.target.dataset;if(t.r){closeMenus();insertHTML(tableHTML(+t.r,+t.c))}
    if(e.target.id==='tcust'){closeMenus();const v=await modal({title:'Inserir tabela',body:'<div class="grid2"><label class="fld"><span>Linhas</span><input class="inp" type="number" id="tr" value="5" min="1" max="200"></label><label class="fld"><span>Colunas</span><input class="inp" type="number" id="tc" value="4" min="1" max="30"></label></div>',buttons:[{label:'Cancelar'},{label:'Inserir',primary:true,value:sc=>[+$('#tr',sc).value,+$('#tc',sc).value]}]});if(Array.isArray(v))insertHTML(tableHTML(Math.max(1,v[0]),Math.max(1,v[1])))}}}
function curCell(){const r=lastRange;return r&&closestIn(r.startContainer,'td,th')}
function tblOp(op){const c=curCell();if(!c)return toast('Coloque o cursor numa tabela');const tr=c.parentElement,tb=c.closest('table'),ci=c.cellIndex;
  const mk=(tag)=>{const e=document.createElement(tag);e.innerHTML='<br>';return e};
  if(op==='rowa'||op==='rowb'){const n=document.createElement('tr');[...tr.cells].forEach(x=>{const e=mk(op==='rowa'&&x.tagName==='TH'?'th':'td');if(x.colSpan>1)e.colSpan=x.colSpan;n.appendChild(e)});op==='rowa'?tr.before(n):tr.after(n)}
  if(op==='cola'||op==='colb'){[...tb.rows].forEach(row=>{const ref=row.cells[Math.min(ci,row.cells.length-1)];const e=mk(ref&&ref.tagName==='TH'?'th':'td');op==='cola'?ref.before(e):ref.after(e)})}
  if(op==='delrow'){if(tb.rows.length<=1)tb.remove();else tr.remove()}
  if(op==='delcol'){[...tb.rows].forEach(row=>row.cells[ci]&&row.cells[ci].remove());if(!tb.rows[0]||!tb.rows[0].cells.length)tb.remove()}
  if(op==='deltbl')tb.remove();
  if(op==='merge'){const nx=c.nextElementSibling;if(!nx)return toast('Não há célula à direita');c.colSpan=(c.colSpan||1)+(nx.colSpan||1);if(nx.textContent.trim())c.innerHTML+=' '+nx.innerHTML;nx.remove()}
  if(op==='split'){if(c.colSpan>1){const n=c.colSpan;c.colSpan=1;for(let i=1;i<n;i++)c.after(mk(c.tagName.toLowerCase()))}}
  if(op==='head'){const r0=tb.rows[0];const toTh=r0.cells[0].tagName!=='TH';[...r0.cells].forEach(x=>{const e=document.createElement(toTh?'th':'td');e.innerHTML=x.innerHTML;if(x.colSpan>1)e.colSpan=x.colSpan;x.replaceWith(e)})}
  if(['grid','zebra','clean'].includes(op)){tb.classList.remove('zebra','clean');if(op!=='grid')tb.classList.add(op)}
  if(op==='sort'){const rows=[...tb.rows].filter(r=>r.cells[0].tagName!=='TH');const dir=tb.dataset.sd==='a'?-1:1;tb.dataset.sd=dir>0?'a':'d';
    rows.sort((a,b)=>{const x=(a.cells[ci]?.textContent||'').trim(),y=(b.cells[ci]?.textContent||'').trim();const nx=parseFloat(x.replace(/\./g,'').replace(',','.')),ny=parseFloat(y.replace(/\./g,'').replace(',','.'));return(!isNaN(nx)&&!isNaN(ny)?nx-ny:x.localeCompare(y,'pt-BR'))*dir});
    rows.forEach(r=>r.parentElement.appendChild(r))}
  afterEdit();renderTools()}
async function insertImageFile(f){if(!f)return;let url=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)});
  if(!/svg/.test(f.type)&&f.size>600000){url=await downscale(url,1600)}
  insertHTML(`<figure><img src="${url}" alt="${esc(f.name)}" style="width:75%"></figure>`)}
function downscale(url,max){return new Promise(res=>{const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.86))};im.onerror=()=>res(url);im.src=url})}
$('#imgIn').onchange=e=>{insertImageFile(e.target.files[0]);e.target.value=''};
let selImg=null;
function selectImg(img){$$('.selimg',ed).forEach(i=>i.classList.remove('selimg'));$('#imgbar')?.remove();selImg=img;if(!img)return;img.classList.add('selimg');
  const b=document.createElement('div');b.id='imgbar';b.innerHTML=['25%','50%','75%','100%'].map(w=>`<button class="ib" data-w="${w}">${w}</button>`).join('')+
   `<button class="ib" data-f="" title="Em linha">${svg('ac')}</button><button class="ib" data-f="fl" title="Flutuar à esquerda">${svg('al')}</button><button class="ib" data-f="fr" title="Flutuar à direita">${svg('ar')}</button><button class="ib" data-cap title="Legenda">${svg('cap')}</button><button class="ib" data-del title="Excluir">${svg('trash')}</button>`;
  desk.appendChild(b);const r=img.getBoundingClientRect(),dr=desk.getBoundingClientRect();b.style.left=Math.max(4,r.left-dr.left+desk.scrollLeft)+'px';b.style.top=Math.max(4,r.top-dr.top+desk.scrollTop-40)+'px';
  b.onmousedown=e=>e.preventDefault();
  b.onclick=e=>{const t=e.target.closest('button');if(!t)return;
    if(t.dataset.w){img.style.width=t.dataset.w}
    if('f' in t.dataset){img.classList.remove('fl','fr');if(t.dataset.f)img.classList.add(t.dataset.f)}
    if('cap' in t.dataset){const fig=img.closest('figure');const cap=`<p class="cap" data-k="fig"><span class="capn" contenteditable="false">Figura</span> — legenda</p>`;(fig||img).insertAdjacentHTML('afterend',cap)}
    if('del' in t.dataset){(img.closest('figure')||img).remove();selectImg(null)}
    afterEdit();if(selImg)selectImg(selImg)}}
desk.addEventListener('scroll',()=>{if(selImg)selectImg(selImg)},{passive:true});
async function insertLink(){const r=curRange();const sel=r&&!r.collapsed?r.toString():'';const ex=r&&closestIn(r.startContainer,'a');
  const v=await modal({title:'Link',body:`<label class="fld"><span>Endereço</span><input class="inp" id="lu" value="${esc(ex?ex.getAttribute('href'):'https://')}"></label>${sel||ex?'':'<label class="fld"><span>Texto exibido</span><input class="inp" id="lt"></label>'}`,buttons:[...(ex?[{label:'Remover link',value:()=>'__rm'}]:[]),{label:'Cancelar'},{label:'Aplicar',primary:true,value:sc=>({u:$('#lu',sc).value.trim(),t:$('#lt',sc)?.value})}]});
  if(v==='__rm'){lastRange&&ex&&(()=>{const rr=document.createRange();rr.selectNodeContents(ex);lastRange=rr})();exec('unlink');return}
  if(!v||!v.u)return;if(!/^(https?:|mailto:|#)/i.test(v.u))v.u='https://'+v.u;
  if(sel||ex)exec('createLink',v.u);else insertHTML(`<a href="${esc(v.u)}">${esc(v.t||v.u)}</a>`)}
function insertTOC(){insertHTML('<div class="toc" contenteditable="false" data-toc="1"></div><p><br></p>');layoutNow()}
async function insertFn(){const v=await ask('Nota de fim','Texto da nota');if(v===null)return;const id=uid();D.fns[id]=v;insertHTML(`<sup class="fn" data-fn="${id}" contenteditable="false">#</sup>`);layoutNow()}
function insertCaption(k){const lbl={fig:'Figura',tab:'Tabela',eq:'Equação'}[k];insertHTML(`<p class="cap" data-k="${k}"><span class="capn" contenteditable="false">${lbl}</span> — descrição</p>`);layoutNow()}
const SYMS='© ® ™ ° ± × ÷ µ Ω ∑ √ ∞ ≤ ≥ ≠ ≈ → ← ↑ ↓ ↔ ⇒ • … § ¶ € £ ¥ ½ ¼ ¾ ² ³ ¹ α β γ δ ε θ λ π σ φ ω Δ Σ Φ Ψ ∂ ∫ ∇ ∈ ∉ ∩ ∪ ⊂ ∀ ∃ ¬ ∧ ∨ ⌀ ✓ ✗ ★ ☐ ☑ « » “ ” ‘ ’ — – ‰ ℃ ℉ № ª º'.split(' ');
function symbols(anchor){closeMenus();const m=document.createElement('div');m.className='menu';m.style.width='300px';m.style.padding='8px';
  m.innerHTML='<div class="symg">'+SYMS.map(s=>`<button title="${s}">${s}</button>`).join('')+'</div>';document.body.appendChild(m);
  const r=anchor.getBoundingClientRect();m.style.left=Math.min(r.left,innerWidth-310)+'px';m.style.top=r.bottom+4+'px';
  m.onmousedown=e=>e.preventDefault();m.onclick=e=>{const b=e.target.closest('button');if(b)exec('insertText',b.textContent)}}
async function insertEq(){const v=await ask('Equação','Expressão (ex.: P = V × I × cos φ)','');if(v)insertHTML(`<span class="eq">${esc(v)}</span>&nbsp;`)}
function insertDate(fmt){const d=new Date();const s=fmt==='long'?d.toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'}):fmt==='time'?d.toLocaleString('pt-BR'):d.toLocaleDateString('pt-BR');exec('insertText',s)}

/* ================= localizar ================= */
const FIND={hits:[],i:-1};
function findRanges(q,cs,whole,rx){const out=[];if(!q)return out;let re;
  try{re=new RegExp(rx?q:q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),cs?'g':'gi');if(whole)re=new RegExp('(?<![\\p{L}\\p{N}])(?:'+re.source+')(?![\\p{L}\\p{N}])',re.flags+'u')}catch(e){return out}
  const w=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){if(n.parentNode.closest('.toc,del,.pgsp'))continue;re.lastIndex=0;let m;while((m=re.exec(n.nodeValue))){if(!m[0].length){re.lastIndex++;continue}const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);out.push(r)}}
  return out}
function paintFind(){if(!window.CSS||!CSS.highlights)return;CSS.highlights.delete('find');CSS.highlights.delete('findcur');if(FIND.hits.length){CSS.highlights.set('find',new Highlight(...FIND.hits));if(FIND.hits[FIND.i])CSS.highlights.set('findcur',new Highlight(FIND.hits[FIND.i]))}}
function findOpts(){return[$('#fq')?.value||'',$('#fcs')?.checked,$('#fww')?.checked,$('#frx')?.checked]}
function doFind(){FIND.hits=findRanges(...findOpts());FIND.i=FIND.hits.length?0:-1;paintFind();const c=$('#fcount');if(c)c.textContent=FIND.hits.length?`${FIND.i+1} de ${FIND.hits.length}`:($('#fq').value?'Nenhum resultado':'')}
function findStep(d){if(!FIND.hits.length)doFind();if(!FIND.hits.length)return;FIND.i=(FIND.i+d+FIND.hits.length)%FIND.hits.length;paintFind();const r=FIND.hits[FIND.i];
  const el=r.startContainer.parentElement;el&&el.scrollIntoView({block:'center',behavior:'smooth'});$('#fcount').textContent=`${FIND.i+1} de ${FIND.hits.length}`}
function replaceOne(){if(!FIND.hits.length)return doFind();const r=FIND.hits[FIND.i];if(!r)return;const s=getSelection();s.removeAllRanges();s.addRange(r);lastRange=r.cloneRange();exec('insertText',$('#frp').value);doFind()}
function replaceAll(){const hits=findRanges(...findOpts());const rp=$('#frp').value;for(let i=hits.length-1;i>=0;i--){const r=hits[i];r.deleteContents();r.insertNode(document.createTextNode(rp))}ed.normalize();afterEdit();doFind();toast(hits.length+' substituições')}

/* ================= revisão: controle de alterações ================= */
ed.addEventListener('beforeinput',e=>{
  if(!D||!D.track)return;const t=e.inputType;const s=getSelection();if(!s.rangeCount)return;
  if(t==='insertText'||t==='insertReplacementText'){
    e.preventDefault();const txt=e.data??(e.dataTransfer&&e.dataTransfer.getData('text/plain'))??'';
    let r=s.getRangeAt(0);if(!r.collapsed){markDel(r,false);r=s.getRangeAt(0)}
    let insEl=closestIn(r.startContainer,'ins');const delEl=closestIn(r.startContainer,'del');
    if(delEl){r.setStartAfter(delEl);r.collapse(true)}
    const tn=document.createTextNode(txt);
    if(insEl&&insEl.dataset.a===author()){r.insertNode(tn)}else{const ins=document.createElement('ins');ins.dataset.a=author();ins.dataset.t=now();ins.appendChild(tn);r.insertNode(ins)}
    const nr=document.createRange();nr.setStart(tn,tn.length);nr.collapse(true);s.removeAllRanges();s.addRange(nr);afterEdit();return}
  if(/^delete(Content|Word)(Backward|Forward)$/.test(t)){
    const back=/Backward/.test(t);const orig=s.getRangeAt(0).cloneRange();
    if(s.isCollapsed)s.modify('extend',back?'backward':'forward',/Word/.test(t)?'word':'character');
    const r=s.getRangeAt(0);const nodes=textNodesInRange(r.cloneRange());
    if(!nodes.length){s.removeAllRanges();s.addRange(orig);return}
    e.preventDefault();markDel(r,back);afterEdit()}
});
function markDel(r,back){const nodes=textNodesInRange(r);let anchor=null;
  nodes.forEach(n=>{if(closestIn(n,'del'))return;const ins=closestIn(n,'ins');if(ins){n.remove();if(!ins.textContent)ins.remove();return}
    const d=document.createElement('del');d.dataset.a=author();d.dataset.t=now();n.before(d);d.appendChild(n);anchor=anchor||d;if(!back)anchor=d});
  const s=getSelection();const nr=document.createRange();
  if(anchor&&anchor.isConnected){back?nr.setStartBefore(anchor):nr.setStartAfter(anchor)}else{nr.setStart(r.startContainer,Math.min(r.startOffset,r.startContainer.length??r.startContainer.childNodes.length))}
  nr.collapse(true);s.removeAllRanges();s.addRange(nr)}
function unwrap(e){const p=e.parentNode;while(e.firstChild)p.insertBefore(e.firstChild,e);e.remove()}
function resolveChange(el,accept){if(el.tagName==='INS')accept?unwrap(el):el.remove();else accept?el.remove():unwrap(el)}
function resolveAll(accept){$$('ins,del',ed).forEach(e=>resolveChange(e,accept));ed.normalize();afterEdit();refreshPanels();toast(accept?'Alterações aceitas':'Alterações rejeitadas')}
function toggleTrack(){D.track=!D.track;$('#stTrack').hidden=!D.track;touch();renderTools();toast(D.track?'Controle de alterações ligado':'Controle de alterações desligado')}

/* comentários */
async function addComment(){const r=curRange();if(!r||r.collapsed)return toast('Selecione o trecho a comentar');const nodes=textNodesInRange(r);if(!nodes.length)return;
  const txt=await modal({title:'Novo comentário',body:`<div class="q" style="font-style:italic;color:var(--muted);margin-bottom:8px">“${esc(r.toString().slice(0,140))}”</div><textarea class="inp" id="ct" rows="4" placeholder="Escreva o comentário"></textarea>`,buttons:[{label:'Cancelar'},{label:'Comentar',primary:true,value:sc=>$('#ct',sc).value.trim()||false}]});
  if(!txt||txt==='Cancelar')return;const id=uid();wrapNodes(nodes,()=>{const s=document.createElement('span');s.className='cm';s.dataset.c=id;return s});
  D.comments.push({id,text:txt,author:author(),at:now(),replies:[]});touch();openSide('comments');focusComment(id)}
function focusComment(id){$$('.cm.on',ed).forEach(e=>e.classList.remove('on'));$$(`.cm[data-c="${id}"]`,ed).forEach(e=>e.classList.add('on'));
  $$('#sideB .card').forEach(c=>c.classList.toggle('on',c.dataset.c===id));const c=$(`#sideB .card[data-c="${id}"]`);c&&c.scrollIntoView({block:'nearest'})}
function delComment(id,resolve){$$(`.cm[data-c="${id}"]`,ed).forEach(unwrap);const c=D.comments.find(x=>x.id===id);if(resolve&&c){c.done=true}else D.comments=D.comments.filter(x=>x.id!==id);touch();refreshPanels()}

/* contagem e leitura */
function wordCountDlg(){const t=textOf(ed.innerHTML);const w=countWords(t);const ch=t.replace(/\u200b/g,'').length,chs=t.replace(/\s|\u200b/g,'').length;const par=$$('p,h1,h2,h3,h4,li',ed).filter(p=>p.textContent.trim()).length;
  let sel='';const r=lastRange;if(r&&!r.collapsed){const st=r.toString();sel=`<tr><td>Seleção</td><td>${countWords(st)} palavras</td></tr>`}
  modal({title:'Contagem de palavras',body:`<table style="width:100%;border-collapse:collapse" class="wc">${[['Páginas',D._pages||1],['Palavras',w.toLocaleString('pt-BR')],['Caracteres (sem espaços)',chs.toLocaleString('pt-BR')],['Caracteres (com espaços)',ch.toLocaleString('pt-BR')],['Parágrafos',par],['Tempo de leitura',Math.max(1,Math.round(w/200))+' min'],['Comentários',D.comments.filter(c=>!c.done).length],['Alterações pendentes',$$('ins,del',ed).length]].map(([a,b])=>`<tr><td style="padding:5px 0;color:var(--muted)">${a}</td><td style="text-align:right;font-weight:500">${b}</td></tr>`).join('')}${sel}</table>`,buttons:[{label:'Fechar',primary:true}]})}
function readAloud(){if(!('speechSynthesis' in window))return toast('Leitura em voz alta indisponível neste navegador');if(speechSynthesis.speaking){speechSynthesis.cancel();return toast('Leitura interrompida')}
  const r=lastRange;const t=r&&!r.collapsed?r.toString():textOf(ed.innerHTML);const u=new SpeechSynthesisUtterance(t.slice(0,30000));u.lang=(D&&D.lang)||'pt-BR'; /* [servidor] idioma do documento */speechSynthesis.speak(u);toast('Lendo… clique de novo para parar')}
function toggleLock(){D.locked=!D.locked;ed.contentEditable=D.locked?'false':'true';touch();renderTools();toast(D.locked?'Documento protegido contra edição':'Edição liberada')}

/* ================= layout de página ================= */
function setLayout(k,v){D.layout[k]=v;touch();layoutNow();renderTools();if(fitMode)fitWidth()}
async function marginsDlg(){const m=D.layout.m;const v=await modal({title:'Margens personalizadas (mm)',body:`<div class="grid2">${['Superior','Direita','Inferior','Esquerda'].map((l,i)=>`<label class="fld"><span>${l}</span><input class="inp" type="number" step="0.5" min="0" max="100" data-i="${i}" value="${m[i]}"></label>`).join('')}</div>`,buttons:[{label:'Cancelar'},{label:'Aplicar',primary:true,value:sc=>$$('input',sc).map(i=>+i.value||0)}]});if(Array.isArray(v))setLayout('m',v)}
async function hdrDlg(){const L=D.layout;const v=await modal({title:'Cabeçalho e rodapé',body:`<label class="fld"><span>Cabeçalho (use {titulo} e {data})</span><input class="inp" id="hh" value="${esc(L.hdr)}"></label><label class="fld"><span>Rodapé</span><input class="inp" id="hf" value="${esc(L.ftr)}"></label><label class="fld"><span>Número de página</span><select class="inp" id="hp">${[['r','Direita'],['c','Centro'],['l','Esquerda'],['none','Sem número']].map(([a,b])=>`<option value="${a}" ${L.pnum===a?'selected':''}>${b}</option>`).join('')}</select></label>`,buttons:[{label:'Cancelar'},{label:'Aplicar',primary:true,value:sc=>({hdr:$('#hh',sc).value,ftr:$('#hf',sc).value,pnum:$('#hp',sc).value})}]});
  if(v&&v.pnum){Object.assign(D.layout,v);touch();layoutNow()}}
async function wmDlg(){const v=await ask('Marca d’água','Texto (vazio remove)',D.layout.wm||'RASCUNHO');if(v!==null)setLayout('wm',v.trim())}
"use strict";
/* ================= faixa de opções ================= */
const FONTS=['IBM Plex Serif','IBM Plex Sans','IBM Plex Mono','Georgia','Times New Roman','Garamond','Cambria','Calibri','Arial','Helvetica','Verdana','Courier New'];
const FSIZES=[8,9,10,10.5,11,12,13,14,16,18,20,24,28,32,36,48,60,72];
const STYLES=[['p','','Normal','font:12px var(--serif)'],['p','title','Título','font:500 17px var(--font)'],['p','subtitle','Subtítulo','font:12px var(--font);color:#5f676d'],['h1','','Título 1','font:600 15px var(--font)'],['h2','','Título 2','font:600 13px var(--font)'],['h3','','Título 3','font:600 12px var(--font)'],['blockquote','','Citação','font:italic 12px var(--serif);color:#3c4247'],['pre','','Código','font:11px var(--mono)'],['p','emph','Destaque','font:500 12px var(--font);color:#8a5200']];
let curTab='home';
const B=(icon,title,run,o={})=>({t:'b',icon,title,run,...o});
const BIG=(icon,label,run,o={})=>({t:'big',icon,label,run,...o});
function tabsDef(){
  const inTable=!!curCell();
  const T=[
  {id:'home',label:'Página inicial',groups:[
    {l:'Área de transferência',items:[BIG('paint','Pincel',startPainter,{on:()=>!!painter,title:'Copiar formatação'}),{t:'col',items:[B('undo','Desfazer (Ctrl+Z)',()=>exec('undo')),B('redo','Refazer (Ctrl+Y)',()=>exec('redo'))]}]},
    {l:'Fonte',items:[{t:'col',items:[{t:'row',items:[{t:'font'},{t:'size'},B('plus','Aumentar fonte',()=>stepSize(1)),B('minus','Diminuir fonte',()=>stepSize(-1))]},
      {t:'row',items:[B('bold','Negrito (Ctrl+B)',()=>exec('bold'),{st:'bold'}),B('italic','Itálico (Ctrl+I)',()=>exec('italic'),{st:'italic'}),B('under','Sublinhado (Ctrl+U)',()=>exec('underline'),{st:'underline'}),B('strike','Tachado',()=>exec('strikeThrough'),{st:'strikeThrough'}),B('sub','Subscrito',()=>exec('subscript'),{st:'subscript'}),B('sup','Sobrescrito',()=>exec('superscript'),{st:'superscript'}),{t:'color',k:'foreColor',icon:'color',title:'Cor da fonte'},{t:'color',k:'hiliteColor',icon:'hili',title:'Realce'},{t:'b',icon:'',label:'Aa',title:'Maiúsculas e minúsculas',menu:[['MAIÚSCULAS','up'],['minúsculas','low'],['Primeira Letra Maiúscula','title'],['Frase normal','sent']].map(([l,m])=>({label:l,run:()=>changeCase(m)}))},B('clear','Limpar formatação',()=>{exec('removeFormat');setBlock('p')})]}]}]},
    {l:'Parágrafo',items:[{t:'col',items:[{t:'row',items:[B('ul','Marcadores',()=>exec('insertUnorderedList'),{st:'insertUnorderedList',menu:[['● Disco','disc'],['○ Círculo','circle'],['■ Quadrado','square'],['– Traço','"– "']].map(([l,v])=>({label:l,run:()=>listStyle(v)}))}),B('ol','Numeração',()=>exec('insertOrderedList'),{st:'insertOrderedList',menu:[['1. 2. 3.','decimal'],['a. b. c.','lower-alpha'],['A. B. C.','upper-alpha'],['i. ii. iii.','lower-roman'],['I. II. III.','upper-roman']].map(([l,v])=>({label:l,run:()=>listStyle(v)}))}),B('check','Lista de tarefas',toggleChecklist),B('outd','Diminuir recuo',()=>indentBlocks(-1)),B('ind','Aumentar recuo',()=>indentBlocks(1))]},
      {t:'row',items:[B('al','Alinhar à esquerda',()=>exec('justifyLeft'),{st:'justifyLeft'}),B('ac','Centralizar',()=>exec('justifyCenter'),{st:'justifyCenter'}),B('ar','Alinhar à direita',()=>exec('justifyRight'),{st:'justifyRight'}),B('aj','Justificar',()=>exec('justifyFull'),{st:'justifyFull'}),B('lh','Espaçamento',null,{menu:[...['1','1.15','1.5','2','2.5','3'].map(v=>({label:'Entre linhas '+v.replace('.',','),run:()=>lineHeight(v)})),'-',{label:'Sem espaço depois',run:()=>paraSpace('marginBottom',0)},{label:'6 pt depois',run:()=>paraSpace('marginBottom',6)},{label:'12 pt depois',run:()=>paraSpace('marginBottom',12)},{label:'12 pt antes',run:()=>paraSpace('marginTop',12)}]})]}]}]},
    {l:'Estilos',items:[{t:'styles'}]},
    {l:'Editar',items:[{t:'col',items:[B('find','Localizar (Ctrl+F)',()=>openSide('find'),{label:'Localizar'}),B('repl','Substituir (Ctrl+H)',()=>openSide('find'),{label:'Substituir'})]}]}
  ]},
  {id:'ins',label:'Inserir',groups:[
    {l:'Páginas',items:[BIG('pb','Quebra de página',()=>insertHTML('<div class="pb" contenteditable="false"></div><p><br></p>'),{title:'Ctrl+Enter'}),BIG('toc','Sumário',insertTOC)]},
    {l:'Tabelas',items:[BIG('table','Tabela',null,{picker:true})]},
    {l:'Ilustrações',items:[BIG('img','Imagem',()=>$('#imgIn').click()),BIG('draw','Desenho',()=>$('#imgIn').click(),{title:'Insira o SVG ou PNG exportado do GPlanSiS|Drawings'})]},
    {l:'Links',items:[BIG('link','Link',insertLink,{title:'Ctrl+K'})]},
    {l:'Texto',items:[BIG('box','Caixa',null,{menu:[{label:'Destaque',run:()=>insertHTML('<div class="callout"><p>Texto em destaque</p></div><p><br></p>')},{label:'Informação',run:()=>insertHTML('<div class="callout info"><p>Informação</p></div><p><br></p>')},{label:'Atenção',run:()=>insertHTML('<div class="callout warn"><p>Atenção</p></div><p><br></p>')}]}),BIG('code','Bloco de código',()=>setBlock('pre')),BIG('hr','Linha',()=>insertHTML('<hr><p><br></p>'))]},
    {l:'Símbolos',items:[BIG('eq','Equação',insertEq),BIG('sym','Símbolo',null,{sym:true}),BIG('date','Data e hora',null,{menu:[{label:'dd/mm/aaaa',run:()=>insertDate('short')},{label:'Por extenso',run:()=>insertDate('long')},{label:'Data e hora',run:()=>insertDate('time')}]})]},
    {l:'Notas',items:[BIG('note','Inserir nota',()=>openSide('notes')),BIG('tonote','Enviar seleção',selToNote,{title:'Cria uma nota com o trecho selecionado'})]}
  ]},
  {id:'lay',label:'Layout',groups:[
    {l:'Configurar página',items:[BIG('page','Tamanho',null,{menu:Object.keys(SIZES).map(k=>({label:k+' — '+SIZES[k].join(' × ').replace(/\./g,',')+' mm',run:()=>setLayout('size',k)}))}),
      BIG('orient','Orientação',null,{menu:[{label:'Retrato',run:()=>setLayout('orient','p')},{label:'Paisagem',run:()=>setLayout('orient','l')}]}),
      BIG('marg','Margens',null,{menu:[...Object.entries(MARGINS).map(([k,v])=>({label:k+(k==='ABNT'?' (sup. 3, esq. 3, inf. 2, dir. 2 cm)':''),run:()=>setLayout('m',[...v])})),'-',{label:'Personalizadas…',run:marginsDlg}]}),
      BIG('cols','Colunas',null,{menu:[1,2,3].map(n=>({label:n+(n>1?' colunas':' coluna'),run:()=>setLayout('cols',n)}))})]},
    {l:'Plano de fundo',items:[BIG('wm','Marca d’água',wmDlg),BIG('pcol','Cor da página',null,{menu:[['Branca',''],['Marfim','#fbf8f0'],['Cinza claro','#f3f4f5'],['Azul claro','#f1f6fb']].map(([l,v])=>({label:l,run:()=>setLayout('pcol',v)}))})]},
    {l:'Cabeçalho e rodapé',items:[BIG('hdr','Cabeçalho e rodapé',hdrDlg)]}
  ]},
  {id:'ref',label:'Referências',groups:[
    {l:'Sumário',items:[BIG('toc','Inserir sumário',insertTOC),BIG('restore','Atualizar',()=>{buildTOC();layoutNow();toast('Sumário atualizado')})]},
    {l:'Notas',items:[BIG('fn','Nota de fim',insertFn)]},
    {l:'Legendas',items:[BIG('cap','Legenda',null,{menu:[{label:'Figura',run:()=>insertCaption('fig')},{label:'Tabela',run:()=>insertCaption('tab')},{label:'Equação',run:()=>insertCaption('eq')}]})]}
  ]},
  {id:'rev',label:'Revisão',groups:[
    {l:'Revisão de texto',items:[BIG('spell','Ortografia',()=>{ed.spellcheck=!ed.spellcheck;renderTools();toast(ed.spellcheck?'Verificação ortográfica ligada':'Verificação desligada')},{on:()=>ed.spellcheck}),BIG('wc','Contagem de palavras',wordCountDlg),BIG('speak','Ler em voz alta',readAloud)]},
    {l:'Comentários',items:[BIG('cmt','Novo comentário',addComment,{title:'Ctrl+Alt+M'}),BIG('cmt','Ver comentários',()=>openSide('comments'))]},
    {l:'Controle',items:[BIG('track','Controlar alterações',toggleTrack,{on:()=>D&&D.track}),BIG('lines','Mostrar marcas',()=>{showMarks=!showMarks;layoutNow();renderTools()},{on:()=>showMarks}),BIG('track','Lista de alterações',()=>openSide('changes'))]},
    {l:'Alterações',items:[BIG('accept','Aceitar todas',()=>resolveAll(true)),BIG('reject','Rejeitar todas',()=>resolveAll(false))]},
    {l:'Proteger',items:[BIG('lock','Proteger documento',toggleLock,{on:()=>D&&D.locked})]}
  ]},
  {id:'view',label:'Exibir',groups:[
    {l:'Modos',items:[BIG('page','Impressão',()=>setView('print'),{on:()=>view==='print'}),BIG('read','Web',()=>setView('web'),{on:()=>view==='web'}),BIG('focus','Foco',()=>setView('focus'))]},
    {l:'Mostrar',items:[BIG('nav','Navegação',()=>togglePane('navP'),{on:()=>!$('#navP').hidden}),BIG('ruler','Régua',()=>{S.settings.noRuler=!S.settings.noRuler;persistLocalD();layoutNow();renderTools()},{on:()=>!S.settings.noRuler}),BIG('cmt','Realce de comentários',()=>{showCm=!showCm;layoutNow();renderTools()},{on:()=>showCm})]},
    {l:'Zoom',items:[BIG('zoom','100%',()=>setZoom(100)),BIG('fit','Largura da página',fitWidth)]},
    {l:'Papel',items:[BIG('dark','Papel escuro',()=>{S.settings.darkPaper=!S.settings.darkPaper;persistLocalD();layoutNow();renderTools()},{on:()=>S.settings.darkPaper})]}
  ]},
  {id:'ai',label:'Assistente',groups:[
    {l:'Reescrever',items:[BIG('ai','Melhorar escrita',()=>aiRun('melhorar')),BIG('spell','Corrigir',()=>aiRun('corrigir')),BIG('wc','Resumir',()=>aiRun('resumir')),BIG('plus','Expandir',()=>aiRun('expandir'))]},
    {l:'Tom e idioma',items:[BIG('doc','Formal',()=>aiRun('formal')),BIG('sym','Traduzir',null,{menu:[['Inglês','inglês'],['Espanhol','espanhol'],['Português','português do Brasil']].map(([l,v])=>({label:l,run:()=>aiRun('traduzir',v)}))})]},
    {l:'Gerar',items:[BIG('send','Pedir ao assistente',()=>openSide('ai')),BIG('ul','Tópicos',()=>aiRun('topicos')),BIG('check','Ações da ata',()=>aiRun('acoes'))]}
  ]}];
  if(inTable)T.push({id:'tbl',label:'Tabela',ctx:true,groups:[
    {l:'Linhas e colunas',items:[BIG('rowa','Linha acima',()=>tblOp('rowa')),BIG('rowb','Linha abaixo',()=>tblOp('rowb')),BIG('cola','Coluna à esquerda',()=>tblOp('cola')),BIG('colb','Coluna à direita',()=>tblOp('colb'))]},
    {l:'Excluir',items:[BIG('minus','Linha',()=>tblOp('delrow')),BIG('minus','Coluna',()=>tblOp('delcol')),BIG('trash','Tabela',()=>tblOp('deltbl'))]},
    {l:'Células',items:[BIG('merge','Mesclar à direita',()=>tblOp('merge')),BIG('cols','Dividir',()=>tblOp('split')),BIG('thead','Cabeçalho',()=>tblOp('head')),BIG('ol','Ordenar coluna',()=>tblOp('sort'))]},
    {l:'Estilo',items:[BIG('table','Grade',()=>tblOp('grid')),BIG('lines','Zebrada',()=>tblOp('zebra')),BIG('hr','Limpa',()=>tblOp('clean'))]}
  ]});
  return T}
function renderTabs(){const T=tabsDef();if(!T.find(t=>t.id===curTab))curTab='home';
  $('#tabs').innerHTML=T.map(t=>`<button class="tab${t.ctx?' ctx':''}" role="tab" aria-selected="${t.id===curTab}" data-tab="${t.id}">${t.label}</button>`).join('')}
$('#tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;curTab=b.dataset.tab;renderTabs();renderTools()};
$('#tabs').onmousedown=e=>e.preventDefault();
let ACT=[];
function renderTools(){const T=tabsDef();const tab=T.find(t=>t.id===curTab)||T[0];ACT=[];
  const it=(x)=>{
    if(x.t==='col')return`<div class="gcol">${x.items.map(it).join('')}</div>`;
    if(x.t==='row')return`<div class="grow">${x.items.map(it).join('')}</div>`;
    if(x.t==='font')return`<select class="sel" id="fFont" title="Fonte" style="width:150px">${FONTS.map(f=>`<option style="font-family:'${f}'">${f}</option>`).join('')}</select>`;
    if(x.t==='size')return`<select class="sel" id="fSize" title="Tamanho" style="width:62px">${FSIZES.map(s=>`<option value="${s}">${String(s).replace('.',',')}</option>`).join('')}</select>`;
    if(x.t==='styles')return`<div class="styles">${STYLES.map((s,i)=>`<button class="sty" data-sty="${i}" title="${s[2]}"><span style="${s[3]}">${s[2]}</span></button>`).join('')}</div>`;
    if(x.t==='color'){const i=ACT.push(x)-1;const c=x.k==='foreColor'?(S.settings.fc||'#c0392b'):(S.settings.hc||'#ffe066');return`<span style="display:inline-flex"><button class="ib colorbtn" data-a="${i}" title="${x.title}">${svg(x.icon)}<i class="bar" style="background:${c}"></i></button><button class="ib" data-cm="${i}" title="Escolher cor" style="min-width:14px;padding:0 2px">▾</button></span>`}
    const i=ACT.push(x)-1;const on=x.on&&x.on();
    const lbl=x.t==='big'?`<span>${esc(x.label)}</span>`:(x.label&&!x.icon?`<b style="font-size:12px">${esc(x.label)}</b>`:'');
    const main=`<button class="ib${x.t==='big'?' big':''}${on?' on':''}" data-a="${i}" ${x.st?`data-st="${x.st}"`:''} title="${esc(x.title||x.label||'')}">${x.icon?svg(x.icon):''}${lbl}</button>`;return x.menu&&x.run&&x.t!=='big'?`<span style="display:inline-flex">${main}<button class="ib" data-mm="${i}" title="Mais opções" style="min-width:14px;padding:0 2px">▾</button></span>`:main};
  $('#tools').innerHTML=tab.groups.map(g=>`<div class="grp"><div class="gb">${g.items.map(it).join('')}</div><div class="gl">${g.l}</div></div>`).join('');
  const ff=$('#fFont'),fs=$('#fSize');
  if(ff)ff.onchange=()=>{exec('fontName',ff.value);ed.focus()};
  if(fs)fs.onchange=()=>{applyFontSize(+fs.value);ed.focus()};
  updateState()}
$('#tools').addEventListener('mousedown',e=>{if(!e.target.closest('select,input'))e.preventDefault()});
$('#tools').addEventListener('click',e=>{
  const sty=e.target.closest('[data-sty]');if(sty){const s=STYLES[+sty.dataset.sty];setBlock(s[0],s[1]);return}
  const mm=e.target.closest('[data-mm]');if(mm){menu(mm,ACT[+mm.dataset.mm].menu);return}
  const cm=e.target.closest('[data-cm]');if(cm){colorMenu(cm,ACT[+cm.dataset.cm]);return}
  const b=e.target.closest('[data-a]');if(!b)return;const x=ACT[+b.dataset.a];
  if(x.t==='color'){exec(x.k,x.k==='foreColor'?(S.settings.fc||'#c0392b'):(S.settings.hc||'#ffe066'));return}
  if(x.picker)return tablePicker(b);if(x.sym)return symbols(b);
  if(x.menu&&(!x.run||x.t==='big'||e.altKey)){menu(b,x.menu);return}
  if(x.menu&&x.run&&e.detail===0){menu(b,x.menu);return}
  x.run&&x.run()});
$('#tools').addEventListener('contextmenu',e=>{const b=e.target.closest('[data-a]');if(!b)return;const x=ACT[+b.dataset.a];if(x&&x.menu){e.preventDefault();menu(b,x.menu)}});
const PALETTE=['#000000','#2d3336','#7d8286','#ffffff','#c0392b','#eb6a20','#f6a709','#2e7d32','#1f6fd1','#8e44ad','#ffe066','#b8f2c2','#cfe3ff','#ffd1dc','#e0e0e0'];
function colorMenu(anchor,x){closeMenus();const m=document.createElement('div');m.className='menu';m.style.padding='8px';
  m.innerHTML=`<div style="display:grid;grid-template-columns:repeat(5,26px);gap:5px">${PALETTE.map(c=>`<button data-c="${c}" style="width:26px;height:26px;border-radius:5px;background:${c};border:1px solid var(--line);padding:0"></button>`).join('')}</div>${x.k==='hiliteColor'?'<button data-c="transparent" style="margin-top:6px">Sem realce</button>':''}<label style="display:flex;gap:6px;align-items:center;margin-top:6px;font-size:12px">Personalizada <input type="color" id="ccu"></label>`;
  document.body.appendChild(m);const r=anchor.getBoundingClientRect();m.style.left=r.left+'px';m.style.top=r.bottom+4+'px';
  const apply=c=>{if(c!=='transparent'){S.settings[x.k==='foreColor'?'fc':'hc']=c;persistLocalD()}closeMenus();exec(x.k,c);renderTools()};
  m.onmousedown=e=>{if(e.target.id!=='ccu')e.preventDefault()};m.onclick=e=>{const b=e.target.closest('[data-c]');if(b)apply(b.dataset.c)};$('#ccu',m).onchange=e=>apply(e.target.value)}
function stepSize(d){const i=FSIZES.indexOf(+$('#fSize')?.value||12);const n=FSIZES[Math.max(0,Math.min(FSIZES.length-1,(i<0?5:i)+d))];applyFontSize(n)}
const stateSoon=debounce(()=>updateState(),80);
let lastInTable=false;
function updateState(){if(!D)return;
  $$('#tools [data-st]').forEach(b=>{let on=false;try{on=document.queryCommandState(b.dataset.st)}catch(e){}b.classList.toggle('on',on&&ed.contains(getSelection().anchorNode))});
  const r=lastRange;if(!r){const fs=$('#fSize');if(fs)fs.value=12;const ff=$('#fFont');if(ff)ff.value='IBM Plex Serif'}if(r){let el=r.startContainer;if(el.nodeType===3)el=el.parentElement;if(el&&ed.contains(el)){const cs=getComputedStyle(el);
    const ff=$('#fFont'),fs=$('#fSize');if(ff){const f=cs.fontFamily.split(',')[0].replace(/["']/g,'').trim();if(FONTS.includes(f))ff.value=f}
    if(fs){const pt=Math.round(parseFloat(cs.fontSize)*.75*2)/2;if(!FSIZES.includes(pt)){const o=document.createElement('option');o.value=pt;o.textContent=String(pt).replace('.',',');fs.appendChild(o)}fs.value=pt}
    const blk=closestIn(el,'p,h1,h2,h3,h4,blockquote,pre');$$('.sty').forEach(s=>{const d=STYLES[+s.dataset.sty];s.classList.toggle('on',!!blk&&blk.tagName.toLowerCase()===d[0]&&(blk.className||'')===d[1])})}}
  const inT=!!curCell();if(inT!==lastInTable){lastInTable=inT;if(!inT&&curTab==='tbl')curTab='home';renderTabs();renderTools()}}

/* ================= painéis laterais ================= */
let sideMode=null;
function togglePane(id){const p=$('#'+id);p.hidden=!p.hidden;if(id==='navP'&&!p.hidden)renderNav();renderTools();if(fitMode)setTimeout(fitWidth,10)}
$$('[data-close]').forEach(b=>b.onclick=()=>{$('#'+b.dataset.close).hidden=true;if(b.dataset.close==='sideP'){sideMode=null;if(window.CSS&&CSS.highlights)CSS.highlights.clear()}renderTools();if(fitMode)setTimeout(fitWidth,10)});
function openSide(m){sideMode=m;$('#sideP').hidden=false;refreshPanels();if(fitMode)setTimeout(fitWidth,10);if(m==='find')setTimeout(()=>{const q=$('#fq');q.focus();q.select()},20)}
function renderNav(){const q=($('#navQ').value||'').toLowerCase();const hs=headings();
  $('#navL').innerHTML=hs.length?hs.filter(h=>!q||h.textContent.toLowerCase().includes(q)).map((h,i)=>`<a class="l${h.tagName[1]}" data-i="${hs.indexOf(h)}">${esc(h.textContent.trim()||'(sem título)')}</a>`).join(''):'<div class="small">Os títulos do documento aparecem aqui. Aplique Título 1, 2 ou 3 em Página inicial › Estilos.</div>'}
$('#navL').onclick=e=>{const a=e.target.closest('a[data-i]');if(!a)return;const h=headings()[+a.dataset.i];if(h){h.scrollIntoView({block:'start',behavior:'smooth'});const r=document.createRange();r.selectNodeContents(h);r.collapse(true);lastRange=r}};
$('#navQ').oninput=()=>{const q=$('#navQ').value;if(q.length>1&&!headings().some(h=>h.textContent.toLowerCase().includes(q.toLowerCase()))){}renderNav()};
function refreshPanels(){if(!D||$('#sideP').hidden)return;const b=$('#sideB'),T=$('#sideT');
  if(sideMode==='find'){T.textContent='Localizar e substituir';
    if(!$('#fq')){b.innerHTML=`<input class="inp" id="fq" placeholder="Localizar"><div style="display:flex;gap:4px;align-items:center;margin:6px 0"><button class="tb" id="fprev">Anterior</button><button class="tb" id="fnext">Próximo</button><span class="small" id="fcount" style="margin-left:auto"></span></div>
      <div class="seg" style="margin-bottom:10px"><label class="small"><input type="checkbox" id="fcs"> Maiúsc./minúsc.</label><label class="small"><input type="checkbox" id="fww"> Palavra inteira</label><label class="small"><input type="checkbox" id="frx"> Expressão regular</label></div>
      <input class="inp" id="frp" placeholder="Substituir por"><div style="display:flex;gap:4px;margin-top:6px"><button class="tb" id="fr1">Substituir</button><button class="tb primary" id="fra">Substituir tudo</button></div>`;
      $('#fq').oninput=doFind;['fcs','fww','frx'].forEach(i=>$('#'+i).onchange=doFind);$('#fq').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findStep(e.shiftKey?-1:1)}};
      $('#fprev').onclick=()=>findStep(-1);$('#fnext').onclick=()=>findStep(1);$('#fr1').onclick=replaceOne;$('#fra').onclick=replaceAll;
      const r=lastRange;if(r&&!r.collapsed&&r.toString().length<80)$('#fq').value=r.toString();doFind()}
    return}
  if(sideMode==='comments'){T.textContent='Comentários';
    const order=[...new Set($$('.cm',ed).map(e=>e.dataset.c))];const open=D.comments.filter(c=>!c.done).sort((a,b)=>{const i=order.indexOf(a.id),j=order.indexOf(b.id);return(i<0?1e9:i)-(j<0?1e9:j)});const done=D.comments.filter(c=>c.done);
    b.innerHTML=(open.length?'':`<div class="empty">Nenhum comentário aberto.<br>Selecione um trecho e use <b>Revisão › Novo comentário</b>.</div>`)+open.map(c=>{const q=$$(`.cm[data-c="${c.id}"]`,ed).map(e=>e.textContent).join('');
      return`<div class="card" data-c="${c.id}"><div class="meta"><span class="av" style="background:${avColor(c.author)}">${esc(initials(c.author))}</span><b style="color:var(--text)">${esc(c.author)}</b><span>${fmtDate(c.at)}</span></div>${q?`<div class="q">${esc(q)}</div>`:'<div class="q">(trecho removido)</div>'}<div>${esc(c.text)}</div>${(c.replies||[]).map(r=>`<div class="rep"><div class="meta"><span class="av" style="background:${avColor(r.author)}">${esc(initials(r.author))}</span><b style="color:var(--text)">${esc(r.author)}</b><span>${fmtDate(r.at)}</span></div>${esc(r.text)}</div>`).join('')}<div class="acts"><button data-ca="reply">Responder</button><button data-ca="done">Resolver</button><button data-ca="del">Excluir</button><button data-ca="note">Virar nota</button></div></div>`}).join('')+
      (done.length?`<div class="small" style="margin:10px 0 6px">Resolvidos (${done.length})</div>`+done.map(c=>`<div class="card" style="opacity:.65" data-c="${c.id}"><div class="meta"><b style="color:var(--text)">${esc(c.author)}</b><span>${fmtDate(c.at)}</span></div>${esc(c.text)}<div class="acts"><button data-ca="del">Excluir</button></div></div>`).join(''):'');
    b.onclick=async e=>{const card=e.target.closest('.card');if(!card)return;const id=card.dataset.c;const c=D.comments.find(x=>x.id===id);const a=e.target.dataset.ca;
      if(!a){focusComment(id);const s=ed.querySelector(`.cm[data-c="${id}"]`);s&&s.scrollIntoView({block:'center',behavior:'smooth'});return}
      if(a==='reply'){const v=await ask('Responder','Resposta');if(v){c.replies=c.replies||[];c.replies.push({author:author(),text:v,at:now()});touch();refreshPanels()}}
      if(a==='done')delComment(id,true);if(a==='del')delComment(id,false);
      if(a==='note'){const q=$$(`.cm[data-c="${id}"]`,ed).map(e=>e.textContent).join('');NOTES.create({title:'Comentário: '+c.text.slice(0,40),html:`<blockquote>${esc(q)}</blockquote><p>${esc(c.text)}</p>`,docId:D.id});toast('Nota criada')}};
    return}
  if(sideMode==='changes'){T.textContent='Alterações';const ch=$$('ins,del',ed);
    b.innerHTML=(ch.length?`<div style="display:flex;gap:4px;margin-bottom:8px"><button class="tb" id="caA">Aceitar todas</button><button class="tb" id="caR">Rejeitar todas</button></div>`:'<div class="empty">Nenhuma alteração pendente.<br>Ligue <b>Controlar alterações</b> para registrar inserções e exclusões.</div>')+
      ch.map((c,i)=>`<div class="card" data-i="${i}"><div class="meta"><span class="av" style="background:${avColor(c.dataset.a||'?')}">${esc(initials(c.dataset.a))}</span><b style="color:var(--text)">${esc(c.dataset.a||'—')}</b><span>${c.tagName==='INS'?'inseriu':'excluiu'}</span><span>${c.dataset.t?fmtDate(+c.dataset.t):''}</span></div><div class="q" style="font-style:normal;${c.tagName==='DEL'?'text-decoration:line-through;color:var(--danger)':'color:var(--ins)'}">${esc(c.textContent.slice(0,120))}</div><div class="acts"><button data-ch="1">Aceitar</button><button data-ch="0">Rejeitar</button></div></div>`).join('');
    if(ch.length){$('#caA').onclick=()=>resolveAll(true);$('#caR').onclick=()=>resolveAll(false)}
    b.onclick=e=>{const card=e.target.closest('.card[data-i]');if(!card)return;const el=$$('ins,del',ed)[+card.dataset.i];if(!el)return;
      if(e.target.dataset.ch){resolveChange(el,e.target.dataset.ch==='1');ed.normalize();afterEdit();refreshPanels()}else el.scrollIntoView({block:'center',behavior:'smooth'})};
    return}
  if(sideMode==='notes'){T.textContent='Notas';NOTES.renderSide(b);return}
  if(sideMode==='ai'){T.textContent='Assistente de escrita';renderAIPane(b);return}
}
ed.addEventListener('input',debounce(()=>{if(sideMode==='changes'||sideMode==='comments')refreshPanels()},700));

/* ================= início (backstage) ================= */
function showHome(on=true){$('#home').hidden=!on;$('#ribbon').hidden=on;$('#bNotesPane').hidden=on;$('#bAI').hidden=on;$('#dname').hidden=on||!D;if(on){$('#sideP').hidden=true;$('#navP').hidden=true;sideMode=null}else requestAnimationFrame(()=>layoutNow());$('#status').style.visibility=on?'hidden':'';if(on){flushSave();renderHome()}}
$('#brand').onclick=()=>{setMode('docs');showHome(true)};
function renderHome(){const q=(S._hq||'').toLowerCase();const docs=Object.values(S.docs).filter(d=>!q||d.title.toLowerCase().includes(q)||textOf(d.html).toLowerCase().includes(q)).sort((a,b)=>b.updatedAt-a.updatedAt);
  $('#homeIn').innerHTML=`<h2>Documentos</h2><div class="small">Editor de documentos com páginas, estilos, revisão e notas integradas. Tudo fica salvo automaticamente.</div>
  <h3>Começar um documento</h3><div class="tpls">${Object.entries(TPL).map(([k,t])=>`<button class="tpl" data-tpl="${k}"><div class="th">${t.thumb}</div><div class="nm">${t.name}</div><div class="ds">${t.desc}</div></button>`).join('')}</div>
  <h3 style="display:flex;align-items:center;gap:8px">Recentes<input class="inp" id="hq" placeholder="Buscar documentos" value="${esc(S._hq||'')}" style="max-width:260px;margin-left:auto"><button class="tb" id="hOpen">${svg('open')}<span class="lbl">Abrir arquivo</span></button></h3>
  <div class="dlist">${docs.length?docs.map(d=>`<div class="drow" data-d="${d.id}">${svg('doc')}<span class="t">${esc(d.title)}</span><span class="m">${(d.words||0).toLocaleString('pt-BR')} palavras</span><span class="m">${fmtDate(d.updatedAt)}</span><button class="ib" data-dup="${d.id}" title="Duplicar">${svg('dup')}</button><button class="ib" data-del="${d.id}" title="Excluir">${svg('trash')}</button></div>`).join(''):`<div class="empty">${q?'Nenhum documento encontrado.':'Nenhum documento ainda. Escolha um modelo acima ou abra um arquivo .docx, .md, .html ou .txt.'}</div>`}</div>`;
  const hq=$('#hq');hq.oninput=()=>{S._hq=hq.value;renderHome();const n=$('#hq');n.focus();n.setSelectionRange(n.value.length,n.value.length)};
  $('#hOpen').onclick=()=>$('#fileIn').click()}
$('#homeIn').addEventListener('click',async e=>{
  const t=e.target.closest('[data-tpl]');if(t){const T=TPL[t.dataset.tpl];createDoc({title:T.title,html:T.html(),layout:T.layout});return}
  const du=e.target.closest('[data-dup]');if(du){e.stopPropagation();const s=S.docs[du.dataset.dup];const n={...JSON.parse(JSON.stringify(s)),id:uid(),title:s.title+' (cópia)',createdAt:now(),updatedAt:now()};S.docs[n.id]=n;persistLocal();Cloud.put('d',n);renderHome();return}
  const dl=e.target.closest('[data-del]');if(dl){e.stopPropagation();const d=S.docs[dl.dataset.del];if(await confirmDlg('Excluir documento',`“${d.title}” será excluído. Essa ação não pode ser desfeita.`)){delete S.docs[d.id];if(D&&D.id===d.id)D=null;persistLocal();Cloud.remove('d',d.id);renderHome()}return}
  const r=e.target.closest('[data-d]');if(r)openDoc(r.dataset.d)});

/* modo (documentos x notas) */
let mode='docs';
function setMode(m){mode=m;$$('#modeSw button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===m));
  const docs=m==='docs';$('#notes').hidden=docs;$('#desk').hidden=!docs;$('#ribbon').hidden=!docs||!$('#home').hidden;$('#status').hidden=!docs;
  $('#dname').hidden=!docs||!D;$('#bExport').hidden=false;$('#bNotesPane').hidden=!docs||!$('#home').hidden;$('#bAI').hidden=!docs||!$('#home').hidden;
  if(!docs){$('#navP').hidden=true;$('#sideP').hidden=true;flushSave();NOTES.render()}
  if(docs&&!D)showHome(true);if(docs&&D&&$('#home').hidden)requestAnimationFrame(()=>{layoutNow();if(fitMode)fitWidth()})}
$('#modeSw').onclick=e=>{const b=e.target.closest('[data-mode]');if(b){if(b.dataset.mode==='docs'){setMode('docs');if(D)showHome(false)}else setMode('notes')}};
$('#bNotesPane').onclick=()=>{if($('#home').hidden===false)return setMode('notes');sideMode==='notes'&&!$('#sideP').hidden?($('#sideP').hidden=true,sideMode=null):openSide('notes')};
$('#bAI').onclick=()=>{if(!$('#home').hidden)return;sideMode==='ai'&&!$('#sideP').hidden?($('#sideP').hidden=true,sideMode=null):openSide('ai')};
function onCloudMerged(){if(D&&S.docs[D.id]&&S.docs[D.id]!==D){const id=D.id;D=null;openDoc(id)}if(!$('#home').hidden)renderHome();if(mode==='notes')NOTES.render();if(sideMode==='notes')refreshPanels()}

/* atalhos */
document.addEventListener('keydown',e=>{const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
  if(e.key==='Escape'){if(view==='focus')setView('print');if(painter){painter=null;ed.style.cursor='';renderTools()}closeMenus();selectImg(null)}
  if(mod&&e.shiftKey&&k==='n'){e.preventDefault();NOTES.quick();return}
  if(!mod)return;
  if(k==='s'){e.preventDefault();if(mode==='notes')NOTES.flush();else flushSave();toast('Salvo');return}
  if(mode!=='docs'||!D||!$('#home').hidden)return;
  if(k==='f'&&!e.shiftKey){e.preventDefault();openSide('find')}
  if(k==='h'){e.preventDefault();openSide('find');setTimeout(()=>$('#frp')&&$('#frp').focus(),40)}
  if(k==='k'){e.preventDefault();insertLink()}
  if(k==='p'){e.preventDefault();printDoc()}
  if(k==='enter'&&ed.contains(getSelection().anchorNode)){e.preventDefault();insertHTML('<div class="pb" contenteditable="false"></div><p><br></p>')}
  if(e.altKey&&k==='m'){e.preventDefault();addComment()}
  if(e.altKey&&['1','2','3'].includes(e.key)){e.preventDefault();setBlock('h'+e.key)}
  if(e.altKey&&e.key==='0'){e.preventDefault();setBlock('p')}
  if(e.key==='>'||(e.shiftKey&&k==='.')){e.preventDefault();stepSize(1)}
  if(e.key==='<'||(e.shiftKey&&k===',')){e.preventDefault();stepSize(-1)}
});
"use strict";
/* ================= modelos ================= */
const today=()=>new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});
const th=(t,n=6)=>`<b>${t}</b>`+Array.from({length:n},(_,i)=>`<i style="width:${60+((i*37)%40)}%"></i>`).join('');
const TPL={
 blank:{name:'Em branco',desc:'Página A4 vazia',title:'Documento sem título',thumb:'',html:()=>'<p><br></p>'},
 relatorio:{name:'Relatório técnico',desc:'Capa, sumário e seções',title:'Relatório técnico',thumb:th('Relatório técnico',9),layout:{m:[30,20,20,30],hdr:'{titulo}',pnum:'r'},html:()=>`<p class="title">Relatório técnico</p><p class="subtitle">Assunto do relatório · ${today()}</p><table><tbody><tr><th>Cliente</th><td><br></td><th>Revisão</th><td>R0</td></tr><tr><th>Responsável</th><td><br></td><th>Data</th><td>${new Date().toLocaleDateString('pt-BR')}</td></tr></tbody></table><div class="toc" contenteditable="false" data-toc="1"></div><h1>Objetivo</h1><p>Descreva o propósito do relatório e a pergunta que ele responde.</p><h1>Escopo</h1><p>O que está incluído e o que fica fora.</p><h2>Premissas</h2><ul><li>Premissa 1</li><li>Premissa 2</li></ul><h1>Desenvolvimento</h1><p>Apresente os dados, os métodos e a análise.</p><h1>Conclusões</h1><p>Resultados principais.</p><h1>Recomendações</h1><ol><li>Recomendação</li></ol>`},
 ata:{name:'Ata de reunião',desc:'Pauta, decisões e ações',title:'Ata de reunião',thumb:th('Ata de reunião',8),html:()=>`<h1>Ata de reunião</h1><table><tbody><tr><th>Data</th><td>${new Date().toLocaleDateString('pt-BR')}</td><th>Local</th><td><br></td></tr><tr><th>Participantes</th><td colspan="3"><br></td></tr></tbody></table><h2>Pauta</h2><ol><li>Item de pauta</li></ol><h2>Discussão</h2><p>Resumo do que foi discutido.</p><h2>Decisões</h2><ul><li>Decisão</li></ul><h2>Ações</h2><table><tbody><tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr><tr><td><br></td><td><br></td><td><br></td><td>Aberta</td></tr></tbody></table><h2>Próxima reunião</h2><p><br></p>`},
 proposta:{name:'Proposta comercial',desc:'Escopo, preço e condições',title:'Proposta comercial',thumb:th('Proposta comercial',8),layout:{ftr:'{titulo} — confidencial',pnum:'c'},html:()=>`<p class="title">Proposta comercial</p><p class="subtitle">Para: nome do cliente · ${today()}</p><h1>Apresentação</h1><p>Contexto e entendimento da necessidade do cliente.</p><h1>Escopo de fornecimento</h1><table><tbody><tr><th>Item</th><th>Descrição</th><th>Qtd.</th><th>Valor (R$)</th></tr><tr><td>1</td><td><br></td><td>1</td><td><br></td></tr></tbody></table><h1>Exclusões</h1><ul><li><br></li></ul><h1>Prazo</h1><p><br></p><h1>Condições comerciais</h1><p>Validade da proposta, forma de pagamento e reajuste.</p><div class="callout"><p>Esta proposta é válida por 30 dias.</p></div>`},
 memorial:{name:'Memorial descritivo',desc:'Padrão ABNT, numeração',title:'Memorial descritivo',thumb:th('Memorial descritivo',9),layout:{m:[30,20,20,30],hdr:'{titulo}',pnum:'r'},html:()=>`<p class="title">Memorial descritivo</p><p class="subtitle">Obra / sistema · Rev. 0</p><div class="toc" contenteditable="false" data-toc="1"></div><h1>1 Identificação</h1><p><br></p><h1>2 Normas aplicáveis</h1><ul><li>ABNT NBR …</li></ul><h1>3 Descrição dos serviços</h1><h2>3.1 Serviços preliminares</h2><p><br></p><h2>3.2 Execução</h2><p><br></p><h1>4 Materiais</h1><table><tbody><tr><th>Material</th><th>Especificação</th><th>Referência</th></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><h1>5 Critérios de aceitação</h1><p><br></p>`},
 carta:{name:'Carta',desc:'Correspondência formal',title:'Carta',thumb:th('Carta',6),html:()=>`<p style="text-align:right">Florianópolis, ${today()}</p><p><br></p><p>À<br>Empresa destinatária<br>A/C: nome</p><p><br></p><p><strong>Assunto:</strong> assunto da carta</p><p><br></p><p>Prezado(a) Senhor(a),</p><p>Corpo da carta.</p><p><br></p><p>Atenciosamente,</p><p><br></p><p>Nome<br>Cargo</p>`},
 exemplo:{name:'Exemplo guiado',desc:'Veja os recursos em uso',title:'Exemplo — recursos do Writer',thumb:th('Exemplo guiado',9),layout:{hdr:'Exemplo guiado',pnum:'r'},html:()=>`<p class="title">Recursos do Writer</p><p class="subtitle">Um documento curto que mostra o que dá para fazer.</p><div class="toc" contenteditable="false" data-toc="1"></div><h1>Texto e estilos</h1><p>Use a galeria de <strong>Estilos</strong> para títulos, citações e código. O sumário acima se monta sozinho a partir dos títulos e mostra a página de cada um. Esta frase tem uma nota de fim<sup class="fn" data-fn="ex1" contenteditable="false">1</sup>.</p><blockquote>Uma citação fica recuada e em itálico.</blockquote><p>Selecione um trecho e use <span class="cm" data-c="exc1">Revisão › Novo comentário</span> para comentar.</p><h2>Listas</h2><ul class="check"><li class="done">Lista de tarefas com caixas clicáveis</li><li>Marque esta caixa clicando nela</li></ul><ol><li>Numeração</li><li>Com estilos (a, b, c / i, ii, iii)</li></ol><h1>Tabelas</h1><table class="zebra"><tbody><tr><th>Equipamento</th><th>Potência (kW)</th><th>Situação</th></tr><tr><td>Bomba B-101</td><td>15</td><td>Operando</td></tr><tr><td>Agitador AG-02</td><td>5,5</td><td>Manutenção</td></tr><tr><td>Compressor C-03</td><td>37</td><td>Operando</td></tr></tbody></table><p class="cap" data-k="tab"><span class="capn" contenteditable="false">Tabela 1</span> — com o cursor na tabela, a aba Tabela aparece na faixa de opções.</p><div class="callout info"><p>Caixas de destaque servem para avisos e observações.</p></div><div class="pb" contenteditable="false"></div><h1>Revisão</h1><p>Ligue <strong>Controlar alterações</strong> e edite: inserções ficam sublinhadas e exclusões riscadas, cada uma com autor e hora.</p><h2>Notas integradas</h2><p>Abra o painel <strong>Notas</strong> no topo para arrastar uma nota para dentro do texto ou enviar a seleção para uma nota nova.</p>`,
  fns:{ex1:'Notas de fim ficam numeradas automaticamente no final do documento.'},comments:[{id:'exc1',text:'Comentários ficam no painel lateral, com respostas e resolução.',author:'GPlanSiS',at:Date.now(),replies:[]}]}
};
// createDoc recebe fns/comments do exemplo
const _createDoc=createDoc;
createDoc=function(t){const T=Object.values(TPL).find(x=>x.title===t.title&&x.fns);if(T){t.fns=JSON.parse(JSON.stringify(T.fns));t.comments=JSON.parse(JSON.stringify(T.comments))}return _createDoc(t)};

/* ================= importar ================= */
$('#fileIn').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const ext=f.name.split('.').pop().toLowerCase();const base=f.name.replace(/\.[^.]+$/,'');
  try{
    if(ext==='json'){const o=JSON.parse(await f.text());if(!o.docs&&!o.notes)throw new Error('Backup inválido');
      const nd=Object.keys(o.docs||{}).length,nn=Object.keys(o.notes||{}).length;
      if(!await confirmDlg('Restaurar backup',`Importar ${nd} documentos e ${nn} notas? Itens com o mesmo identificador serão substituídos.`,'Importar'))return;
      Object.assign(S.docs,o.docs||{});Object.assign(S.notes,o.notes||{});if(o.folders)S.folders=[...new Set([...S.folders,...o.folders])];
      persistLocal();Object.values(o.docs||{}).forEach(d=>Cloud.put('d',d));Object.values(o.notes||{}).forEach(n=>Cloud.put('n',n));Cloud.meta();
      toast('Backup restaurado');mode==='notes'?NOTES.render():renderHome();return}
    let html='';
    if(ext==='docx'){toast('Lendo arquivo do Word…');await loadScript('/vendor/mammoth.browser.min.js');
      const r=await mammoth.convertToHtml({arrayBuffer:await f.arrayBuffer()},{convertImage:mammoth.images.imgElement(img=>img.read('base64').then(b=>({src:'data:'+img.contentType+';base64,'+b})))});html=sanitize(r.value)}
    else if(ext==='html'||ext==='htm'){const d=new DOMParser().parseFromString(await f.text(),'text/html');html=sanitize(d.body.innerHTML)}
    else if(ext==='md'){html=mdToHtml(await f.text())}
    else{html=esc(await f.text()).split(/\r?\n\r?\n/).map(p=>`<p>${p.replace(/\r?\n/g,'<br>')}</p>`).join('')}
    if(mode==='notes'){NOTES.create({title:base,html});toast('Nota importada');return}
    createDoc({title:base,html:html||'<p><br></p>'});toast('Arquivo aberto: '+f.name)
  }catch(err){toast('Não foi possível abrir: '+err.message,4000)}};

/* markdown */
function mdInline(s){return esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<em>$2</em>').replace(/~~([^~]+)~~/g,'<s>$1</s>').replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img alt="$1" src="$2">').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>')}
function mdToHtml(md){const L=md.replace(/\r/g,'').split('\n');let o='',i=0;
  while(i<L.length){let l=L[i];
    if(/^```/.test(l)){let c=[];i++;while(i<L.length&&!/^```/.test(L[i]))c.push(L[i++]);i++;o+=`<pre>${esc(c.join('\n'))}</pre>`;continue}
    let m;if((m=l.match(/^(#{1,4})\s+(.*)/))){o+=`<h${m[1].length}>${mdInline(m[2])}</h${m[1].length}>`;i++;continue}
    if(/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(l)){o+='<hr>';i++;continue}
    if(/^>\s?/.test(l)){let c=[];while(i<L.length&&/^>\s?/.test(L[i]))c.push(L[i++].replace(/^>\s?/,''));o+=`<blockquote><p>${mdInline(c.join(' '))}</p></blockquote>`;continue}
    if(/^\|.*\|\s*$/.test(l)){let rows=[];while(i<L.length&&/^\|.*\|\s*$/.test(L[i]))rows.push(L[i++]);rows=rows.filter(r=>!/^\|[\s:|-]+\|$/.test(r));
      o+='<table><tbody>'+rows.map((r,k)=>'<tr>'+r.slice(1,-1).split('|').map(c=>k?`<td>${mdInline(c.trim())}</td>`:`<th>${mdInline(c.trim())}</th>`).join('')+'</tr>').join('')+'</tbody></table>';continue}
    if(/^\s*[-*+]\s+\[( |x)\]/i.test(l)){let it=[];while(i<L.length&&/^\s*[-*+]\s+\[( |x)\]/i.test(L[i])){const d=/\[x\]/i.test(L[i]);it.push(`<li${d?' class="done"':''}>${mdInline(L[i++].replace(/^\s*[-*+]\s+\[.\]\s*/,''))}</li>`)}o+=`<ul class="check">${it.join('')}</ul>`;continue}
    if(/^\s*[-*+]\s+/.test(l)){let it=[];while(i<L.length&&/^\s*[-*+]\s+/.test(L[i]))it.push(`<li>${mdInline(L[i++].replace(/^\s*[-*+]\s+/,''))}</li>`);o+=`<ul>${it.join('')}</ul>`;continue}
    if(/^\s*\d+[.)]\s+/.test(l)){let it=[];while(i<L.length&&/^\s*\d+[.)]\s+/.test(L[i]))it.push(`<li>${mdInline(L[i++].replace(/^\s*\d+[.)]\s+/,''))}</li>`);o+=`<ol>${it.join('')}</ol>`;continue}
    if(!l.trim()){i++;continue}
    let p=[];while(i<L.length&&L[i].trim()&&!/^(#{1,4}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s|\|)/.test(L[i]))p.push(L[i++]);o+=`<p>${mdInline(p.join(' '))}</p>`}
  return o||'<p><br></p>'}
function htmlToMd(root){const out=[];const inl=n=>[...n.childNodes].map(c=>{if(c.nodeType===3)return c.nodeValue.replace(/\u200b/g,'');if(c.nodeType!==1)return'';const t=c.tagName,s=inl(c);
  if(t==='DEL')return'';if(t==='STRONG'||t==='B')return s.trim()?`**${s}**`:s;if(t==='EM'||t==='I')return s.trim()?`*${s}*`:s;if(t==='S'||t==='STRIKE')return`~~${s}~~`;if(t==='CODE')return'`'+s+'`';
  if(t==='A')return`[${s}](${c.getAttribute('href')})`;if(t==='BR')return'  \n';if(t==='IMG')return`![${c.alt||''}](${(c.src||'').startsWith('data:')?'imagem-embutida':c.src})`;
  if(t==='SUP'&&c.classList.contains('fn'))return`[^${s}]`;const st=c.getAttribute('style')||'';if(/font-weight:\s*(bold|[6-9]00)/.test(st)&&s.trim())return`**${s}**`;if(/font-style:\s*italic/.test(st)&&s.trim())return`*${s}*`;return s}).join('');
  const blk=(n,depth=0)=>{[...n.children].forEach(c=>{const t=c.tagName;if(c.classList.contains('pgsp')||c.classList.contains('toc'))return;
    if(/^H[1-6]$/.test(t))out.push('#'.repeat(+t[1])+' '+inl(c).trim(),'');
    else if(t==='P'){const x=inl(c).trim();if(c.classList.contains('title'))out.push('# '+x,'');else if(x)out.push(x,'')}
    else if(t==='UL'||t==='OL'){[...c.children].forEach((li,k)=>{const pre='  '.repeat(depth)+(c.classList.contains('check')?`- [${li.classList.contains('done')?'x':' '}] `:t==='OL'?`${k+1}. `:'- ');const sub=[...li.children].filter(x=>/^(UL|OL)$/.test(x.tagName));const cl=li.cloneNode(true);cl.querySelectorAll('ul,ol').forEach(x=>x.remove());out.push(pre+inl(cl).trim());sub.forEach(s=>{const w=document.createElement('div');w.appendChild(s.cloneNode(true));blk(w,depth+1);out.pop&&0})});out.push('')}
    else if(t==='BLOCKQUOTE')out.push('> '+inl(c).trim(),'');
    else if(t==='PRE')out.push('```',c.textContent,'```','');
    else if(t==='TABLE'){[...c.rows].forEach((r,k)=>{out.push('| '+[...r.cells].map(x=>inl(x).trim().replace(/\|/g,'\\|')).join(' | ')+' |');if(!k)out.push('|'+[...r.cells].map(()=>' --- ').join('|')+'|')});out.push('')}
    else if(t==='HR')out.push('---','');
    else if(c.classList.contains('pb'))out.push('','---','');
    else if(t==='FIGURE'||t==='DIV')blk(c,depth);else{const x=inl(c).trim();if(x)out.push(x,'')}})};
  blk(root);return out.join('\n').replace(/\n{3,}/g,'\n\n').trim()+'\n'}

/* ================= exportar ================= */
function exportHTMLbody(){const d=document.createElement('div');d.innerHTML=cleanHTML();d.querySelectorAll('[contenteditable]').forEach(e=>e.removeAttribute('contenteditable'));d.querySelectorAll('.toc .upd').forEach(e=>e.remove());
  d.querySelectorAll('.pb').forEach(e=>{e.className='pbk';e.setAttribute('style','break-after:page;page-break-after:always')});
  d.querySelectorAll('.cm').forEach(unwrap);if(!showMarks){d.querySelectorAll('del').forEach(e=>e.remove());d.querySelectorAll('ins').forEach(unwrap)}
  d.querySelectorAll('.toc a').forEach(a=>{a.removeAttribute('data-go')});
  let fn='';const sups=[...d.querySelectorAll('sup.fn')];if(sups.length)fn='<hr><div class="fns"><b>Notas</b><ol>'+sups.map(s=>`<li>${esc(D.fns[s.dataset.fn]||'')}</li>`).join('')+'</ol></div>';
  return d.innerHTML+fn}
const DOC_CSS=`body{font-family:'IBM Plex Serif',Georgia,'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#1b1f22}
p{margin:0 0 8pt}h1{font:600 20pt/1.2 'IBM Plex Sans',Arial,sans-serif;margin:16pt 0 8pt}h2{font:600 15pt/1.25 'IBM Plex Sans',Arial,sans-serif;margin:14pt 0 6pt}h3{font:600 12.5pt/1.3 'IBM Plex Sans',Arial,sans-serif;margin:12pt 0 4pt}
p.title{font:500 28pt/1.1 'IBM Plex Sans',Arial,sans-serif;margin:0 0 6pt}p.subtitle{font:14pt 'IBM Plex Sans',Arial,sans-serif;color:#5f676d;margin:0 0 16pt}
blockquote{margin:8pt 0 8pt 12pt;padding-left:12pt;border-left:3px solid #c9ced3;font-style:italic}pre{font:10pt 'IBM Plex Mono',Consolas,monospace;background:#f2f4f5;padding:8pt;white-space:pre-wrap}
table{border-collapse:collapse;width:100%;margin:6pt 0 10pt}td,th{border:1px solid #b9c0c6;padding:4pt 6pt;vertical-align:top}th{background:#eef0f2;text-align:left}
img{max-width:100%}figure{margin:8pt 0;text-align:center}.cap{font-style:italic;font-size:9.5pt;color:#5f676d;text-align:center}.callout{border:1px solid #e5c98b;background:#fff8e6;padding:8pt 10pt;margin:8pt 0}
.callout.info{border-color:#a9c7ea;background:#eef5fd}.callout.warn{border-color:#efb4ac;background:#fdf0ee}ul.check{list-style:none}ul.check li.done{text-decoration:line-through;color:#8e979d}ul.check li::before{content:"☐ "}ul.check li.done::before{content:"☑ "}
ins{color:#1f6fd1}del{color:#c0392b}.toc{border:1px solid #e0e3e6;padding:8pt 12pt;margin-bottom:14pt}.toc a{display:flex;color:inherit;text-decoration:none}.toc .dots{flex:1;border-bottom:1px dotted #999;margin:0 4px 4px}.toc a.l2{padding-left:14pt}.toc a.l3{padding-left:28pt}.toc .tt{font-weight:600}
.fns{font-size:10pt}.eq{font-style:italic}`;
function pageCSS(){const{w,h,m}=dims(),L=D.layout;const q=s=>'"'+String(s).replace(/"/g,'\\"')+'"';
  const pn=L.pnum==='none'?'':`"Página " counter(page) " de " counter(pages)`;const ft=fill(L.ftr);
  const pos={l:'left',c:'center',r:'right'}[L.pnum];
  let boxes='';if(L.hdr)boxes+=`@top-center{content:${q(fill(L.hdr))};font:9pt 'IBM Plex Sans',Arial;color:#80878d}`;
  if(ft)boxes+=`@bottom-left{content:${q(ft)};font:9pt 'IBM Plex Sans',Arial;color:#80878d}`;
  if(pn)boxes+=`@bottom-${pos==='left'&&ft?'center':pos}{content:${pn};font:9pt 'IBM Plex Sans',Arial;color:#80878d}`;
  return`@page{size:${w}mm ${h}mm;margin:${m[0]}mm ${m[1]}mm ${m[2]}mm ${m[3]}mm;${boxes}}`}
function standaloneHTML(){return`<!DOCTYPE html><html lang="${D.lang||'pt-BR'}"><head><meta charset="utf-8"><title>${esc(D.title)}</title><style>${pageCSS()}${DOC_CSS}${D.layout.cols>1?`.body{column-count:${D.layout.cols};column-gap:10mm}`:''}body{max-width:${dims().w-dims().m[1]-dims().m[3]}mm;margin:20px auto}@media print{body{margin:0;max-width:none}}</style></head><body><div class="body">${exportHTMLbody()}</div></body></html>`}
function printDoc(){flushSave();const pr=$('#printRoot');let st=$('#printCSS');if(!st){st=document.createElement('style');st.id='printCSS';document.head.appendChild(st)}
  st.textContent=pageCSS()+'@media print{'+DOC_CSS.split('}').filter(x=>x.trim()).map(r=>{const[s,b]=r.split('{');return s.split(',').map(x=>x.trim()==='body'?'#printRoot':'#printRoot '+x.trim()).join(',')+'{'+b+'}'}).join('')+(L2=>L2.cols>1?`#printRoot{column-count:${L2.cols};column-gap:10mm}`:'')(D.layout)+(D.layout.wm?`#printRoot::before{content:${JSON.stringify(D.layout.wm)};position:fixed;top:45%;left:0;right:0;text-align:center;transform:rotate(-38deg);font:600 76pt 'IBM Plex Sans',Arial;color:rgba(120,130,140,.15)}`:'')+'}';
  pr.innerHTML=exportHTMLbody();
  try{window.print()}catch(e){toast('A impressão foi bloqueada aqui. Exporte em HTML e imprima pelo navegador.',4500)}}
let exportMenu=function(anchor){if(mode==='notes')return NOTES.exportMenu(anchor);if(!D){return menu(anchor,[{label:'Backup completo (.json)',icon:'dup',run:backupAll}])}
  menu(anchor,[
   {label:'PDF (imprimir)',icon:'print',k:'Ctrl+P',run:printDoc},
   {label:"Word (.docx)",icon:"doc",run:()=>exportDocx()},
   {label:'Word 97–2003 (.doc)',icon:'doc',run:()=>{flushSave();saveBlob(safeName(D.title)+'.doc','\ufeff'+`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(D.title)}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>${pageCSS().replace(/@(top|bottom)-[a-z]+\{[^}]*\}/g,'')}${DOC_CSS}</style></head><body>${exportHTMLbody()}</body></html>`,'application/msword')}},
   {label:'Página web (.html)',icon:'code',run:()=>{flushSave();saveBlob(safeName(D.title)+'.html',standaloneHTML(),'text/html')}},
   {label:'Markdown (.md)',icon:'lines',run:()=>{flushSave();const d=document.createElement('div');d.innerHTML=exportHTMLbody();saveBlob(safeName(D.title)+'.md',htmlToMd(d),'text/markdown')}},
   {label:'Texto (.txt)',icon:'al',run:()=>{flushSave();const d=document.createElement('div');d.innerHTML=exportHTMLbody().replace(/<\/(p|h\d|li|tr|blockquote|pre)>/g,'$&\n').replace(/<br>/g,'\n');saveBlob(safeName(D.title)+'.txt',d.textContent.replace(/\n{3,}/g,'\n\n'),'text/plain')}},
   '-',{label:'Abrir arquivo…',icon:'open',run:()=>$('#fileIn').click()},{label:'Backup completo (.json)',icon:'dup',run:backupAll}])}
$('#bExport').onclick=e=>exportMenu(e.currentTarget);
function backupAll(){flushSave();NOTES.flush();saveBlob('gplansis-writer-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({app:'GPlanSiS|Writer',v:1,at:new Date().toISOString(),docs:S.docs,notes:S.notes,folders:S.folders},null,1),'application/json')}
let exportDocx=null;
"use strict";
/* ================= Word .docx nativo (OOXML) ================= */
const xe=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function cssHex(c){if(!c)return null;c=c.trim();if(/^#[0-9a-f]{6}$/i.test(c))return c.slice(1).toUpperCase();if(/^#[0-9a-f]{3}$/i.test(c))return c.slice(1).split('').map(x=>x+x).join('').toUpperCase();
  const m=c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);if(m){if(m[4]!==undefined&&+m[4]===0)return null;return[m[1],m[2],m[3]].map(v=>(+v).toString(16).padStart(2,'0')).join('').toUpperCase()}return null}
const fontMap=f=>{if(!f)return null;f=f.split(',')[0].replace(/["']/g,'').trim();return{'IBM Plex Serif':'Cambria','IBM Plex Sans':'Calibri','IBM Plex Mono':'Consolas'}[f]||f};
async function rasterize(src){return new Promise(res=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.naturalWidth||800;c.height=im.naturalHeight||600;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);res({url:c.toDataURL('image/png'),w:c.width,h:c.height})};im.onerror=()=>res(null);im.src=src})}
async function buildDocx(){
  const{w,h,m}=dims(),L=D.layout,tw=x=>Math.round(x*56.6929),contentTw=tw(w-m[1]-m[3]),contentPx=(w-m[1]-m[3])*PX;
  const root=document.createElement('div');root.innerHTML=cleanHTML();
  if(!showMarks){root.querySelectorAll('del').forEach(e=>e.remove());root.querySelectorAll('ins').forEach(unwrap)}
  const rels=[],media=[],nums=[],comments=[];let rid=10,did=1,cid=0,tcid=1;
  const rel=(type,target,ext)=>{const id='rId'+(rid++);rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${xe(target)}"${ext?' TargetMode="External"':''}/>`);return id};
  // imagens: medir e converter
  const live=$$('img',ed);const imgs=$$('img',root);
  for(let i=0;i<imgs.length;i++){const im=imgs[i],lv=live[i];let src=im.getAttribute('src')||'';let nw=lv?lv.naturalWidth:0,nh=lv?lv.naturalHeight:0;
    let mime=(src.match(/^data:(image\/[a-z+]+);base64,/)||[])[1];
    if(!mime||!/png|jpeg|gif/.test(mime)){const r=await rasterize(src);if(!r){im.remove();continue}src=r.url;mime='image/png';nw=r.w;nh=r.h}
    const ext=mime.split('/')[1].replace('jpeg','jpg');const name=`image${media.length+1}.${ext}`;media.push({name,b64:src.split(',')[1]});
    const pct=parseFloat(im.style.width)||100;let wpx=contentPx*Math.min(100,pct)/100;if(!im.style.width&&nw)wpx=Math.min(nw,contentPx);const hpx=nw?wpx*nh/nw:wpx*.66;
    im.dataset.rid=rel('image','media/'+name);im.dataset.cx=Math.round(wpx*9525);im.dataset.cy=Math.round(hpx*9525)}
  // comentários: último segmento de cada id
  const lastCm={},cmIds={};root.querySelectorAll('.cm').forEach(e=>{lastCm[e.dataset.c]=e});
  const cmNum=id=>{if(!(id in cmIds)){cmIds[id]=cid++;}return cmIds[id]};
  const dt=t=>new Date(+t||Date.now()).toISOString().replace(/\.\d+Z$/,'Z');
  // runs
  function rPr(f){let x='';if(f.style)x+=`<w:rStyle w:val="${f.style}"/>`;const fn=fontMap(f.font);if(fn)x+=`<w:rFonts w:ascii="${xe(fn)}" w:hAnsi="${xe(fn)}" w:cs="${xe(fn)}"/>`;
    if(f.b)x+='<w:b/>';if(f.i)x+='<w:i/>';if(f.s)x+='<w:strike/>';if(f.color)x+=`<w:color w:val="${f.color}"/>`;if(f.sz)x+=`<w:sz w:val="${Math.round(f.sz*2)}"/>`;
    if(f.hl)x+=`<w:shd w:val="clear" w:color="auto" w:fill="${f.hl}"/>`;if(f.u)x+='<w:u w:val="single"/>';if(f.sub)x+='<w:vertAlign w:val="subscript"/>';if(f.sup)x+='<w:vertAlign w:val="superscript"/>';return x?`<w:rPr>${x}</w:rPr>`:''}
  function textRun(t,f){if(!t)return'';const parts=t.replace(/\u200b/g,'').split('\t');return`<w:r>${rPr(f)}`+parts.map((p,i)=>(i?'<w:tab/>':'')+(p?(f.del?`<w:delText xml:space="preserve">${xe(p)}</w:delText>`:`<w:t xml:space="preserve">${xe(p)}</w:t>`):'')).join('')+'</w:r>'}
  function styleFmt(el,f){const st=el.style;const g={...f};
    if(st.fontWeight&&(st.fontWeight==='bold'||+st.fontWeight>=600))g.b=true;if(st.fontWeight==='normal')g.b=false;if(st.fontStyle==='italic')g.i=true;
    const td=st.textDecorationLine||st.textDecoration||'';if(td.includes('underline'))g.u=true;if(td.includes('line-through'))g.s=true;
    const c=cssHex(st.color);if(c)g.color=c;const bg=cssHex(st.backgroundColor);if(bg)g.hl=bg;if(st.fontSize){const v=parseFloat(st.fontSize);if(st.fontSize.endsWith('pt'))g.sz=v;else if(st.fontSize.endsWith('px'))g.sz=v*.75}
    if(st.fontFamily)g.font=st.fontFamily;return g}
  function runs(node,f){let x='';node.childNodes.forEach(c=>{
    if(c.nodeType===3){x+=textRun(c.nodeValue.replace(/\s+/g,' '),f);return}if(c.nodeType!==1)return;const t=c.tagName;
    if(t==='BR'){x+='<w:r><w:br/></w:r>';return}
    if(t==='IMG'){if(c.dataset.rid)x+=drawing(c);return}
    if(c.classList.contains('pgsp'))return;
    let g=styleFmt(c,f);
    if(t==='STRONG'||t==='B')g.b=true;if(t==='EM'||t==='I')g.i=true;if(t==='U')g.u=true;if(t==='S'||t==='STRIKE')g.s=true;if(t==='SUB')g.sub=true;if(t==='SUP')g.sup=true;
    if(t==='CODE'){g.font='Consolas'}if(t==='FONT'){if(c.color)g.color=cssHex(c.color)||g.color;if(c.face)g.font=c.face}
    if(t==='A'&&c.getAttribute('href')&&!c.closest('.toc')){const href=c.getAttribute('href');if(/^(https?:|mailto:)/i.test(href)){x+=`<w:hyperlink r:id="${rel('hyperlink',href,true)}" w:history="1">${runs(c,{...g,style:'Hyperlink'})}</w:hyperlink>`;return}}
    if(t==='INS'){x+=`<w:ins w:id="${tcid++}" w:author="${xe(c.dataset.a||author())}" w:date="${dt(c.dataset.t)}">${runs(c,g)}</w:ins>`;return}
    if(t==='DEL'){x+=`<w:del w:id="${tcid++}" w:author="${xe(c.dataset.a||author())}" w:date="${dt(c.dataset.t)}">${runs(c,{...g,del:true})}</w:del>`;return}
    if(c.classList.contains('cm')){const id=c.dataset.c,first=!(id in cmIds),n=cmNum(id);x+=(first?`<w:commentRangeStart w:id="${n}"/>`:'')+runs(c,g);if(lastCm[id]===c)x+=`<w:commentRangeEnd w:id="${n}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${n}"/></w:r>`;return}
    if(t==='SUP'&&c.classList.contains('fn')){x+=textRun(c.textContent,{...g,sup:true});return}
    if(c.classList.contains('eq'))g.i=true;
    x+=runs(c,g)});return x}
  function drawing(im){const id=did++;return`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${im.dataset.cx}" cy="${im.dataset.cy}"/><wp:docPr id="${id}" name="Imagem ${id}" descr="${xe(im.alt||'')}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Imagem ${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${im.dataset.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${im.dataset.cx}" cy="${im.dataset.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`}
  function pPr(el,o={}){let x='';if(o.style)x+=`<w:pStyle w:val="${o.style}"/>`;if(o.num)x+=`<w:numPr><w:ilvl w:val="${o.num[1]}"/><w:numId w:val="${o.num[0]}"/></w:numPr>`;
    if(o.extra)x+=o.extra;const st=el&&el.style||{};
    const sb=parseFloat(st.marginTop),sa=parseFloat(st.marginBottom),lh=parseFloat(st.lineHeight);if(!isNaN(sb)||!isNaN(sa)||!isNaN(lh))x+=`<w:spacing${!isNaN(sb)?` w:before="${Math.round(sb*20)}"`:''}${!isNaN(sa)?` w:after="${Math.round(sa*20)}"`:''}${!isNaN(lh)&&lh<6?` w:line="${Math.round(lh*240)}" w:lineRule="auto"`:''}/>`;
    const ml=parseFloat(st.marginLeft);if(!isNaN(ml)&&ml>0&&!o.num)x+=`<w:ind w:left="${tw(ml)}"/>`;
    const al=(st.textAlign||o.jc||'');const jc={left:'left',center:'center',right:'right',justify:'both'}[al];if(jc)x+=`<w:jc w:val="${jc}"/>`;return x?`<w:pPr>${x}</w:pPr>`:''}
  const P=(el,o,inner)=>`<w:p>${pPr(el,o)}${inner}</w:p>`;
  const isInline=n=>n.nodeType===3||(n.nodeType===1&&!/^(P|H[1-6]|UL|OL|LI|TABLE|BLOCKQUOTE|PRE|DIV|FIGURE|HR)$/.test(n.tagName));
  function newNum(ord){const id=nums.length+1;nums.push(ord?1:0);return id}
  function list(el,lvl,ctxNum){let x='';const ord=el.tagName==='OL';const check=el.classList.contains('check');const num=check?null:(lvl===0||ctxNum==null?newNum(ord):newNum(ord));
    [...el.children].forEach(li=>{if(li.tagName!=='LI')return;let inl=document.createElement('span');const sub=[];
      [...li.childNodes].forEach(c=>{if(c.nodeType===1&&(c.tagName==='UL'||c.tagName==='OL'))sub.push(c);else if(c.nodeType===1&&c.tagName==='P'){inl.append(...c.cloneNode(true).childNodes,' ')}else inl.appendChild(c.cloneNode(true))});
      if(check)x+=P(li,{extra:`<w:ind w:left="${360+lvl*360}" w:hanging="360"/>`},textRun((li.classList.contains('done')?'☑':'☐')+'\t',{})+runs(inl,li.classList.contains('done')?{s:true,color:'8E979D'}:{}));
      else x+=P(li,{style:'ListParagraph',num:[num,lvl]},runs(inl,{}));
      sub.forEach(s=>x+=list(s,lvl+1,num))});return x}
  function table(t){const rows=[...t.rows];const cols=Math.max(1,...rows.map(r=>[...r.cells].reduce((a,c)=>a+(c.colSpan||1),0)));const cw=Math.floor(contentTw/cols);
    const clean=t.classList.contains('clean'),zebra=t.classList.contains('zebra');
    let x=`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/>${clean?'<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:right w:val="nil"/><w:insideV w:val="nil"/><w:bottom w:val="single" w:sz="4" w:color="B9C0C6"/><w:insideH w:val="single" w:sz="4" w:color="B9C0C6"/></w:tblBorders>':''}<w:tblLook w:val="04A0" w:firstRow="1"/></w:tblPr><w:tblGrid>${'<w:gridCol w:w="'+cw+'"/>'.repeat(cols)}</w:tblGrid>`;
    rows.forEach((r,ri)=>{const head=[...r.cells].every(c=>c.tagName==='TH');x+=`<w:tr>${head&&ri===0?'<w:trPr><w:tblHeader/></w:trPr>':''}`;
      [...r.cells].forEach(c=>{const sp=c.colSpan||1;const th=c.tagName==='TH';const fill=th?'EEF0F2':(zebra&&ri%2===0?'F6F7F8':null);
        let inner='';const hasBlk=[...c.children].some(e=>!isInline(e));
        if(hasBlk)inner=blocks(c,{b:th});else inner=P(c,{},runs(c,th?{b:true}:{}));if(!inner.includes('<w:p'))inner='<w:p/>';
        x+=`<w:tc><w:tcPr><w:tcW w:w="${cw*sp}" w:type="dxa"/>${sp>1?`<w:gridSpan w:val="${sp}"/>`:''}${fill?`<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`:''}</w:tcPr>${inner}</w:tc>`});x+='</w:tr>'});
    return x+'</w:tbl><w:p/>'}
  function blocks(container,f={}){let x='',buf=null;const flush=()=>{if(buf&&buf.textContent.replace(/\s/g,'').length||buf&&buf.querySelector('img'))x+=P(null,{},runs(buf,f));buf=null};
    [...container.childNodes].forEach(c=>{
      if(isInline(c)){if(c.nodeType===3&&!c.nodeValue.trim()&&!buf)return;buf=buf||document.createElement('span');buf.appendChild(c.cloneNode(true));return}
      flush();const t=c.tagName,cl=c.classList;
      if(/^H[1-6]$/.test(t)){x+=P(c,{style:'Heading'+Math.min(4,+t[1])},runs(c,f));return}
      if(t==='P'){const style=cl.contains('title')?'Title':cl.contains('subtitle')?'Subtitle':cl.contains('cap')?'Caption':cl.contains('emph')?'IntenseQuote':null;x+=P(c,{style},runs(c,f));return}
      if(t==='BLOCKQUOTE'){const hasB=[...c.children].some(e=>!isInline(e));if(hasB)x+=blocks(c,f).replace(/<w:p>(<w:pPr>)?/g,(m0,a)=>a?'<w:p><w:pPr><w:pStyle w:val="Quote"/>':'<w:p><w:pPr><w:pStyle w:val="Quote"/></w:pPr>');else x+=P(c,{style:'Quote'},runs(c,f));return}
      if(t==='PRE'){c.textContent.split('\n').forEach(l=>x+=P(null,{style:'Code'},textRun(l||' ',{})));return}
      if(t==='UL'||t==='OL'){x+=list(c,0);return}
      if(t==='TABLE'){x+=table(c);return}
      if(t==='HR'){x+='<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C9CED3"/></w:pBdr></w:pPr></w:p>';return}
      if(cl.contains('pb')||cl.contains('pbk')){x+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';return}
      if(cl.contains('toc')){x+=P(null,{style:'TOCHeading'},textRun('Sumário',{}));c.querySelectorAll('a').forEach(a=>{const lv=+(a.className.match(/l(\d)/)||[0,1])[1];const tx=a.querySelector('span')?.textContent||'';const pg=a.querySelector('.pg')?.textContent||'';
        x+=P(null,{style:'TOC'+lv,extra:`<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${contentTw}"/></w:tabs>`},textRun(tx+'\t'+pg,{}))});return}
      if(cl.contains('callout')){const fill=cl.contains('info')?'EEF5FD':cl.contains('warn')?'FDF0EE':'FFF8E6',bd=cl.contains('info')?'A9C7EA':cl.contains('warn')?'EFB4AC':'E5C98B';
        const ex=`<w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="${bd}"/><w:left w:val="single" w:sz="4" w:space="4" w:color="${bd}"/><w:bottom w:val="single" w:sz="4" w:space="4" w:color="${bd}"/><w:right w:val="single" w:sz="4" w:space="4" w:color="${bd}"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;
        [...c.children].forEach(p=>x+=P(p,{extra:ex},runs(p,f)));if(!c.children.length)x+=P(null,{extra:ex},runs(c,f));return}
      if(t==='FIGURE'){x+=P(c,{jc:'center'},runs(c,f));return}
      x+=blocks(c,f)});flush();return x}
  let body=blocks(root);
  const sups=$$('sup.fn',ed);if(sups.length){body+=P(null,{style:'Heading3'},textRun('Notas',{}));sups.forEach((s,i)=>body+=P(null,{},textRun(`${i+1}. ${D.fns[s.dataset.fn]||''}`,{sz:10})))}
  // comentários
  D.comments.forEach(c=>{if(!(c.id in cmIds))return;const n=cmIds[c.id];comments.push(`<w:comment w:id="${n}" w:author="${xe(c.author)}" w:date="${dt(c.at)}" w:initials="${xe(initials(c.author))}"><w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r><w:r><w:t xml:space="preserve">${xe(c.text)}</w:t></w:r></w:p>${(c.replies||[]).map(r=>`<w:p><w:r><w:t xml:space="preserve">${xe(r.author+': '+r.text)}</w:t></w:r></w:p>`).join('')}</w:comment>`)});
  // cabeçalho e rodapé
  const NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  let hdrRef='',ftrRef='';const files={};
  if(L.hdr){const id=rel('header','header1.xml');hdrRef=`<w:headerReference w:type="default" r:id="${id}"/>`;files['word/header1.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}><w:p><w:pPr><w:pStyle w:val="Header"/><w:jc w:val="center"/></w:pPr>${textRun(fill(L.hdr),{color:'80878D',sz:9})}</w:p></w:hdr>`}
  if(L.ftr||L.pnum!=='none'){const id=rel('footer','footer1.xml');ftrRef=`<w:footerReference w:type="default" r:id="${id}"/>`;const fr={color:'80878D',sz:9};
    const pn=L.pnum==='none'?'':textRun('Página ',fr)+`<w:fldSimple w:instr=" PAGE "><w:r>${rPr(fr)}<w:t>1</w:t></w:r></w:fldSimple>`+textRun(' de ',fr)+`<w:fldSimple w:instr=" NUMPAGES "><w:r>${rPr(fr)}<w:t>1</w:t></w:r></w:fldSimple>`;
    const ft=fill(L.ftr);const jc={l:'left',c:'center',r:'right'}[L.pnum]||'left';
    const inner=ft&&pn?textRun(ft,fr)+(jc==='left'?textRun('  ·  ',fr):'<w:r><w:tab/></w:r>'+(jc==='center'?'':'<w:r><w:tab/></w:r>'))+pn:(ft?textRun(ft,fr):pn);
    files['word/footer1.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="center" w:pos="${Math.round(contentTw/2)}"/><w:tab w:val="right" w:pos="${contentTw}"/></w:tabs>${ft?'':`<w:jc w:val="${jc}"/>`}</w:pPr>${inner}</w:p></w:ftr>`}
  const sect=`<w:sectPr>${hdrRef}${ftrRef}<w:pgSz w:w="${tw(w)}" w:h="${tw(h)}"${L.orient==='l'?' w:orient="landscape"':''}/><w:pgMar w:top="${tw(m[0])}" w:right="${tw(m[1])}" w:bottom="${tw(m[2])}" w:left="${tw(m[3])}" w:header="${tw(Math.min(12.5,m[0]/2))}" w:footer="${tw(Math.min(12.5,m[2]/2))}" w:gutter="0"/>${L.cols>1?`<w:cols w:num="${L.cols}" w:space="567"/>`:''}</w:sectPr>`;
  const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}${sect}</w:body></w:document>`;
  // estilos
  const sty=(id,name,type,ppr,rpr,o='')=>`<w:style w:type="${type}" w:styleId="${id}"${o}><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>${ppr?`<w:pPr>${ppr}</w:pPr>`:''}${rpr?`<w:rPr>${rpr}</w:rPr>`:''}</w:style>`;
  const sans='<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>';
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria" w:eastAsia="Cambria" w:cs="Cambria"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="${D.lang||'pt-BR'}" w:eastAsia="${D.lang||'pt-BR'}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${sty('Heading1','heading 1','paragraph','<w:keepNext/><w:spacing w:before="320" w:after="160"/><w:outlineLvl w:val="0"/>',sans+'<w:b/><w:sz w:val="40"/>')}
${sty('Heading2','heading 2','paragraph','<w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="1"/>',sans+'<w:b/><w:sz w:val="30"/>')}
${sty('Heading3','heading 3','paragraph','<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/>',sans+'<w:b/><w:sz w:val="25"/>')}
${sty('Heading4','heading 4','paragraph','<w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="3"/>',sans+'<w:b/><w:i/><w:sz w:val="23"/>')}
${sty('Title','Title','paragraph','<w:spacing w:after="120"/>',sans+'<w:sz w:val="56"/>')}
${sty('Subtitle','Subtitle','paragraph','<w:spacing w:after="320"/>',sans+'<w:color w:val="5F676D"/><w:sz w:val="28"/>')}
${sty('Quote','Quote','paragraph','<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="C9CED3"/></w:pBdr><w:ind w:left="360"/>','<w:i/><w:color w:val="3C4247"/>')}
${sty('IntenseQuote','Intense Quote','paragraph','','<w:b/><w:color w:val="8A5200"/>')}
${sty('Code','Code','paragraph','<w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:shd w:val="clear" w:color="auto" w:fill="F2F4F5"/>','<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/>')}
${sty('Caption','caption','paragraph','<w:jc w:val="center"/><w:spacing w:after="200"/>',sans+'<w:i/><w:color w:val="5F676D"/><w:sz w:val="19"/>')}
${sty('ListParagraph','List Paragraph','paragraph','<w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/>','')}
${sty('TOCHeading','TOC Heading','paragraph','<w:spacing w:before="120" w:after="120"/>',sans+'<w:b/><w:sz w:val="26"/>')}
${[1,2,3].map(i=>sty('TOC'+i,'toc '+i,'paragraph',`<w:spacing w:after="40"/><w:ind w:left="${(i-1)*280}"/>`,sans)).join('')}
${sty('Header','header','paragraph','<w:spacing w:after="0"/>','')}${sty('Footer','footer','paragraph','<w:spacing w:after="0"/>','')}
${sty('CommentText','annotation text','paragraph','','<w:sz w:val="20"/>')}
<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="1F6FD1"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B9C0C6"/><w:left w:val="single" w:sz="4" w:color="B9C0C6"/><w:bottom w:val="single" w:sz="4" w:color="B9C0C6"/><w:right w:val="single" w:sz="4" w:color="B9C0C6"/><w:insideH w:val="single" w:sz="4" w:color="B9C0C6"/><w:insideV w:val="single" w:sz="4" w:color="B9C0C6"/></w:tblBorders><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:style></w:styles>`;
  const bul=['•','◦','▪'],ordF=['decimal','lowerLetter','lowerRoman'];
  const lvls=ord=>Array.from({length:9},(_,i)=>`<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${ord?ordF[i%3]:'bullet'}"/><w:lvlText w:val="${ord?'%'+(i+1)+'.':bul[i%3]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720+i*360}" w:hanging="360"/></w:pPr>${ord?'':'<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>'}</w:lvl>`).join('');
  const numbering=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${lvls(false)}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${lvls(true)}</w:abstractNum>${nums.map((a,i)=>`<w:num w:numId="${i+1}"><w:abstractNumId w:val="${a}"/>${a?Array.from({length:9},(_,k)=>`<w:lvlOverride w:ilvl="${k}"><w:startOverride w:val="1"/></w:lvlOverride>`).join(''):''}</w:num>`).join('')}</w:numbering>`;
  rels.push('<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>','<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>','<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>');
  if(comments.length)rels.push('<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>');
  const z=new JSZip();
  z.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${comments.length?'<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>':''}${files['word/header1.xml']?'<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>':''}${files['word/footer1.xml']?'<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>':''}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  z.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  z.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(D.title)}</dc:title><dc:creator>${xe(author())}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date(D.createdAt).toISOString().replace(/\.\d+Z/,'Z')}</dcterms:created></cp:coreProperties>`);
  z.file('word/document.xml',doc);z.file('word/styles.xml',styles);z.file('word/numbering.xml',numbering);
  z.file('word/settings.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${NS}>${D.track?'<w:trackRevisions/>':''}<w:defaultTabStop w:val="709"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
  if(comments.length)z.file('word/comments.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments ${NS}>${comments.join('')}</w:comments>`);
  Object.entries(files).forEach(([k,v])=>z.file(k,v));
  media.forEach(mm=>z.file('word/media/'+mm.name,mm.b64,{base64:true}));
  z.file('word/_rels/document.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
  return z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})}
exportDocx=async function(){flushSave();try{await loadScript('/vendor/jszip.min.js')}catch(e){return toast('Sem acesso à biblioteca de compactação. Use Word 97–2003 (.doc).',4500)}
  try{toast('Gerando .docx…');const blob=await buildDocx();saveBlob(safeName(D.title)+'.docx',blob)}catch(e){console.error(e);toast('Falha ao gerar .docx: '+e.message,4500)}};
"use strict";
/* ================= formatos de arquivo: importação ================= */
const u8=b=>b instanceof Uint8Array?b:new Uint8Array(b);
const CP1252={128:8364,130:8218,131:402,132:8222,133:8230,134:8224,135:8225,136:710,137:8240,138:352,139:8249,140:338,142:381,145:8216,146:8217,147:8220,148:8221,149:8226,150:8211,151:8212,152:732,153:8482,154:353,155:8250,156:339,158:382,159:376};
const cp1252ch=c=>String.fromCharCode(CP1252[c]||c);
function sniff(buf){const b=u8(buf);const s=String.fromCharCode(...b.slice(0,8));
  if(b[0]===0xD0&&b[1]===0xCF&&b[2]===0x11&&b[3]===0xE0)return'cfb';if(b[0]===0x50&&b[1]===0x4B)return'zip';if(s.startsWith('{\\rtf'))return'rtf';
  const head=new TextDecoder('utf-8',{fatal:false}).decode(b.slice(0,2048)).toLowerCase();if(/<html|<body|<!doctype|<p[\s>]|<div[\s>]|xmlns:w=/.test(head))return'html';return'text'}
function decodeText(buf){const b=u8(buf);if(b[0]===0xFF&&b[1]===0xFE)return new TextDecoder('utf-16le').decode(b.slice(2));if(b[0]===0xFE&&b[1]===0xFF)return new TextDecoder('utf-16be').decode(b.slice(2));
  try{return new TextDecoder('utf-8',{fatal:true}).decode(b)}catch(e){let s='';for(const c of b)s+=cp1252ch(c);return s}}
const paras=t=>t.replace(/\r\n?/g,'\n').split(/\n{2,}|\n(?=\s*\n)/).map(p=>p.trim()?`<p>${esc(p).replace(/\n/g,'<br>')}</p>`:'').join('')||'<p><br></p>';
const linesToParas=t=>t.replace(/\r\n?/g,'\n').split('\n').map(l=>`<p>${l.trim()?esc(l):'<br>'}</p>`).join('');

/* --- Word 97–2003 binário (.doc): contêiner OLE/CFB + tabela de peças --- */
function readCFB(buf){const b=u8(buf),dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
  const ss=1<<dv.getUint16(30,true),mss=1<<dv.getUint16(32,true),cutoff=dv.getUint32(56,true);
  const off=n=>(n+1)*ss;const fatSecs=[];for(let i=0;i<109;i++){const v=dv.getUint32(76+i*4,true);if(v<0xFFFFFFFA)fatSecs.push(v)}
  let dif=dv.getUint32(68,true),guard=0;while(dif<0xFFFFFFFA&&guard++<1000){for(let i=0;i<ss/4-1;i++){const v=dv.getUint32(off(dif)+i*4,true);if(v<0xFFFFFFFA)fatSecs.push(v)}dif=dv.getUint32(off(dif)+ss-4,true)}
  const fat=[];fatSecs.forEach(s=>{for(let i=0;i<ss/4;i++)fat.push(dv.getUint32(off(s)+i*4,true))});
  const chain=(start,tbl)=>{const out=[];let n=start,g=0;while(n<0xFFFFFFFA&&g++<1e6){out.push(n);n=tbl[n]}return out};
  const readBig=(start,size)=>{const o=new Uint8Array(chain(start,fat).length*ss);chain(start,fat).forEach((s,i)=>o.set(b.subarray(off(s),off(s)+ss),i*ss));return o.subarray(0,size)};
  const dirBytes=readBig(dv.getUint32(48,true),1e9);const ents=[];
  for(let p=0;p+128<=dirBytes.length;p+=128){const d=new DataView(dirBytes.buffer,dirBytes.byteOffset+p,128);const nl=d.getUint16(64,true);let name='';for(let i=0;i<nl/2-1;i++)name+=String.fromCharCode(d.getUint16(i*2,true));
    ents.push({name,type:d.getUint8(66),start:d.getUint32(116,true),size:d.getUint32(120,true)})}
  const root=ents[0];const miniFat=[];const mfStart=dv.getUint32(60,true);if(mfStart<0xFFFFFFFA){const m=readBig(mfStart,1e9);const md=new DataView(m.buffer,m.byteOffset,m.byteLength);for(let i=0;i<m.length/4;i++)miniFat.push(md.getUint32(i*4,true))}
  const mini=root?readBig(root.start,root.size):new Uint8Array();
  return{get(name){const e=ents.find(x=>x.name===name&&x.type===2);if(!e)return null;if(e.size>=cutoff)return readBig(e.start,e.size);
    const o=new Uint8Array(chain(e.start,miniFat).length*mss);chain(e.start,miniFat).forEach((s,i)=>o.set(mini.subarray(s*mss,s*mss+mss),i*mss));return o.subarray(0,e.size)},names:ents.map(e=>e.name)}}
function docBinaryToHtml(buf){const cfb=readCFB(buf);const wd=cfb.get('WordDocument');if(!wd)throw new Error('não é um documento do Word 97–2003');
  const dv=new DataView(wd.buffer,wd.byteOffset,wd.byteLength);if(dv.getUint16(0,true)!==0xA5EC)throw new Error('cabeçalho do Word não reconhecido');
  const flags=dv.getUint16(0x0A,true);if(flags&0x0100)throw new Error('o documento está protegido por senha');
  const tbl=cfb.get(flags&0x0200?'1Table':'0Table');if(!tbl)throw new Error('tabela de texto ausente');
  const ccpText=dv.getInt32(0x4C,true),fcClx=dv.getUint32(0x1A2,true),lcbClx=dv.getUint32(0x1A6,true);
  const td=new DataView(tbl.buffer,tbl.byteOffset,tbl.byteLength);let p=fcClx,end=fcClx+lcbClx;let text='';
  while(p<end){const t=tbl[p];if(t===1){p+=3+td.getUint16(p+1,true);continue}if(t!==2)break;const lcb=td.getUint32(p+1,true);const base=p+5,n=(lcb-4)/12;
    for(let i=0;i<n&&text.length<ccpText;i++){const cp0=td.getUint32(base+i*4,true),cp1=td.getUint32(base+(i+1)*4,true);let fc=td.getUint32(base+(n+1)*4+i*8+2,true);const comp=fc&0x40000000;const len=cp1-cp0;
      if(comp){fc=(fc&0x3FFFFFFF)/2;for(let k=0;k<len;k++)text+=cp1252ch(wd[fc+k])}else{for(let k=0;k<len;k++)text+=String.fromCharCode(wd[fc+2*k]|(wd[fc+2*k+1]<<8))}}
    break}
  if(!text){// documento não complexo antigo: texto contíguo
    const fcMin=dv.getUint32(0x18,true);for(let k=0;k<ccpText;k++)text+=cp1252ch(wd[fcMin+k])}
  text=text.slice(0,ccpText);
  // campos: mantém o resultado
  let out='',depth=0,mode=[];for(const ch of text){if(ch==='\x13'){mode.push('i');continue}if(ch==='\x14'){if(mode.length)mode[mode.length-1]='r';continue}if(ch==='\x15'){mode.pop();continue}if(mode.length&&mode[mode.length-1]==='i')continue;out+=ch}
  out=out.replace(/[\x01\x08\x05\x1f]/g,'').replace(/\x1e/g,'-').replace(/\xa0/g,' ');
  // monta parágrafos e tabelas
  let html='',buf2='',row=[],rows=[],lastCell=false;const flushT=()=>{if(rows.length){html+='<table><tbody>'+rows.map(r=>'<tr>'+r.map(c=>`<td>${c||'<br>'}</td>`).join('')+'</tr>').join('')+'</tbody></table>';rows=[]}};
  const fmt=s=>esc(s).replace(/\x0b/g,'<br>').replace(/\t/g,'&emsp;');
  for(const ch of out){
    if(ch==='\x07'){if(!buf2&&lastCell){rows.push(row);row=[];lastCell=false}else{row.push(fmt(buf2));buf2='';lastCell=true}continue}
    if(ch==='\r'){if(row.length){buf2+='\x0b';continue}flushT();const t=buf2.trim();html+=t?`<p>${fmt(buf2)}</p>`:'<p><br></p>';buf2='';lastCell=false;continue}
    if(ch==='\x0c'){flushT();if(buf2.trim())html+=`<p>${fmt(buf2)}</p>`;buf2='';html+='<div class="pb" contenteditable="false"></div>';continue}
    lastCell=false;buf2+=ch}
  flushT();if(buf2.trim())html+=`<p>${fmt(buf2)}</p>`;
  return html.replace(/(<p><br><\/p>){3,}/g,'<p><br></p><p><br></p>')}

/* --- RTF --- */
function rtfToHtml(src){let i=0,html='',para='',cell=[],row=[],rows=[];const st=[{b:0,i:0,u:0,skip:0,uc:1}];let cur=st[0],ucSkip=0;
  const SKIP=new Set(['fonttbl','colortbl','stylesheet','info','pict','header','footer','headerl','headerr','headerf','footerl','footerr','footerf','object','themedata','colorschememapping','latentstyles','datastore','xmlnstbl','listtable','listoverridetable','rsidtbl','generator','mmathPr','pgdsctbl','fldinst','bkmkstart','bkmkend','filetbl','revtbl']);
  let span={b:0,i:0,u:0},open=false;const closeSpan=()=>{if(open){para+='</span>';open=false}};
  const add=t=>{if(cur.skip||!t)return;if(span.b!==cur.b||span.i!==cur.i||span.u!==cur.u){closeSpan();span={b:cur.b,i:cur.i,u:cur.u}}
    if(!open&&(cur.b||cur.i||cur.u)){para+=`<span style="${cur.b?'font-weight:bold;':''}${cur.i?'font-style:italic;':''}${cur.u?'text-decoration:underline;':''}">`;open=true}para+=esc(t)};
  let inTbl=false;const flushRows=()=>{if(rows.length){html+='<table><tbody>'+rows.map(r=>'<tr>'+r.map(x=>`<td>${x||'<br>'}</td>`).join('')+'</tr>').join('')+'</tbody></table>';rows=[]}};
  const endPara=()=>{closeSpan();if(inTbl){cell.push(para);para='';return}flushRows();html+=para.trim()?`<p>${para}</p>`:'<p><br></p>';para=''};
  while(i<src.length){const c=src[i];
    if(c==='{'){st.push({...cur,skip:cur.skip});cur=st[st.length-1];i++;if(src.startsWith('\\*',i)){cur.skip=1}continue}
    if(c==='}'){closeSpan();st.pop();cur=st[st.length-1]||st[0];if(!st.length)st.push(cur);i++;continue}
    if(c==='\\'){const n=src[i+1];
      if(n==='\\'||n==='{'||n==='}'){add(n);i+=2;continue}
      if(n==="'"){const h=parseInt(src.substr(i+2,2),16);if(ucSkip>0)ucSkip--;else add(cp1252ch(h));i+=4;continue}
      if(n==='~'){add('\u00a0');i+=2;continue}if(n==='-'||n==='_'){i+=2;continue}
      if(n==='\n'||n==='\r'){endPara();i+=2;continue}
      const m=/^\\([a-zA-Z]+)(-?\d+)? ?/.exec(src.slice(i,i+40));if(!m){i++;continue}i+=m[0].length;const w=m[1],v=m[2]!==undefined?+m[2]:null;
      if(SKIP.has(w)){cur.skip=1;continue}
      switch(w){case'par':case'sect':endPara();break;case'line':if(!cur.skip)para+='<br>';break;case'tab':add('\t');break;
        case'b':cur.b=v===0?0:1;break;case'i':cur.i=v===0?0:1;break;case'ul':cur.u=v===0?0:1;break;case'ulnone':cur.u=0;break;case'plain':cur.b=cur.i=cur.u=0;break;
        case'uc':cur.uc=v||1;break;case'u':{let cp=v<0?v+65536:v;add(String.fromCharCode(cp));ucSkip=cur.uc;break}
        case'emdash':add('—');break;case'endash':add('–');break;case'bullet':add('•');break;case'lquote':add('‘');break;case'rquote':add('’');break;case'ldblquote':add('“');break;case'rdblquote':add('”');break;
        case'trowd':break;case'intbl':inTbl=true;break;case'cell':closeSpan();cell.push(para);para='';row.push(cell.filter(x=>x.trim()).join('<br>'));cell=[];break;
        case'nestcell':closeSpan();cell.push(para);para='';row.push(cell.join('<br>'));cell=[];break;
        case'row':if(row.length)rows.push(row);row=[];break;case'pard':inTbl=false;break;
        case'page':endPara();html+='<div class="pb" contenteditable="false"></div>';break}
      continue}
    if(c==='\r'||c==='\n'){i++;continue}
    if(ucSkip>0){ucSkip--;i++;continue}
    let j=i;while(j<src.length&&!'\\{}\r\n'.includes(src[j]))j++;add(src.slice(i,j));i=j}
  flushRows();
  closeSpan();if(para.trim())html+=`<p>${para}</p>`;return sanitize(html)||'<p><br></p>'}

/* --- OpenDocument (.odt) --- */
async function odtToHtml(zip){const xml=await zip.file('content.xml').async('string');const d=new DOMParser().parseFromString(xml,'application/xml');
  const NS={text:'urn:oasis:names:tc:opendocument:xmlns:text:1.0',table:'urn:oasis:names:tc:opendocument:xmlns:table:1.0',style:'urn:oasis:names:tc:opendocument:xmlns:style:1.0',fo:'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',draw:'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',xlink:'http://www.w3.org/1999/xlink'};
  const styles={};const readSt=async doc=>{doc.querySelectorAll('*').forEach(s=>{if(s.localName!=='style'||s.namespaceURI!==NS.style)return;const tp=[...s.children].find(c=>c.localName==='text-properties');const pp=[...s.children].find(c=>c.localName==='paragraph-properties');
    const o={par:s.getAttributeNS(NS.style,'parent-style-name')};if(tp){o.b=tp.getAttributeNS(NS.fo,'font-weight')==='bold';o.i=tp.getAttributeNS(NS.fo,'font-style')==='italic';const ul=tp.getAttributeNS(NS.style,'text-underline-style');o.u=!!ul&&ul!=='none';o.s=(tp.getAttributeNS(NS.style,'text-line-through-style')||'none')!=='none';o.c=tp.getAttributeNS(NS.fo,'color')}
    if(pp){o.al=pp.getAttributeNS(NS.fo,'text-align');o.pb=pp.getAttributeNS(NS.fo,'break-before')==='page'}styles[s.getAttributeNS(NS.style,'name')]=o})};
  await readSt(d);if(zip.file('styles.xml')){await readSt(new DOMParser().parseFromString(await zip.file('styles.xml').async('string'),'application/xml'))}
  const sty=n=>{let s=styles[n]||{};const p=s.par&&styles[s.par]?styles[s.par]:{};return{...p,...s,name:n,parName:s.par}};
  const imgs={};for(const f of Object.keys(zip.files).filter(f=>/^Pictures\//.test(f))){const ext=f.split('.').pop().toLowerCase();const mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml'}[ext];if(mime)imgs[f]=`data:${mime};base64,`+await zip.file(f).async('base64')}
  const inl=n=>[...n.childNodes].map(c=>{if(c.nodeType===3)return esc(c.nodeValue);if(c.nodeType!==1)return'';const l=c.localName;
    if(l==='s')return'&nbsp;'.repeat(+(c.getAttributeNS(NS.text,'c')||1));if(l==='tab')return'&emsp;';if(l==='line-break')return'<br>';
    if(l==='span'){const s=sty(c.getAttributeNS(NS.text,'style-name'));let x=inl(c);if(s.b)x=`<strong>${x}</strong>`;if(s.i)x=`<em>${x}</em>`;if(s.u)x=`<u>${x}</u>`;if(s.s)x=`<s>${x}</s>`;if(s.c&&s.c!=='#000000')x=`<span style="color:${s.c}">${x}</span>`;return x}
    if(l==='a')return`<a href="${esc(c.getAttributeNS(NS.xlink,'href')||'#')}">${inl(c)}</a>`;
    if(l==='frame'){const im=[...c.children].find(x=>x.localName==='image');const h=im&&im.getAttributeNS(NS.xlink,'href');return h&&imgs[h]?`<img src="${imgs[h]}" style="width:75%">`:''}
    if(l==='note'){const b=[...c.children].find(x=>x.localName==='note-body');return b?`<sup>[${esc(b.textContent.trim())}]</sup>`:''}
    if(['bookmark','bookmark-start','bookmark-end','soft-page-break','sequence-decls'].includes(l))return'';return inl(c)}).join('');
  const blk=n=>[...n.children].map(c=>{const l=c.localName;
    if(l==='h'){const lv=Math.min(4,+(c.getAttributeNS(NS.text,'outline-level')||1));return`<h${lv}>${inl(c)}</h${lv}>`}
    if(l==='p'){const s=sty(c.getAttributeNS(NS.text,'style-name'));const nm=(s.parName||s.name||'').toLowerCase();const al=s.al&&s.al!=='start'&&s.al!=='left'?` style="text-align:${s.al==='end'?'right':s.al==='justify'?'justify':s.al}"`:'';
      const pre=s.pb?'<div class="pb" contenteditable="false"></div>':'';const x=inl(c)||'<br>';
      if(/^title/.test(nm))return pre+`<p class="title">${x}</p>`;if(/subtitle/.test(nm))return pre+`<p class="subtitle">${x}</p>`;if(/quot/.test(nm))return pre+`<blockquote>${x}</blockquote>`;if(/caption|illustration/.test(nm))return pre+`<p class="cap">${x}</p>`;
      if(/preformat|source/.test(nm))return pre+`<pre>${x}</pre>`;return pre+`<p${al}>${x}</p>`}
    if(l==='list'){return`<ul>${[...c.children].filter(x=>x.localName==='list-item').map(li=>`<li>${[...li.children].map(x=>x.localName==='list'?blk({children:[x]}):inl(x)).join(' ')}</li>`).join('')}</ul>`}
    if(l==='table'){const rows=[];c.querySelectorAll('*').forEach(r=>{if(r.localName==='table-row'&&r.closest&&true)rows.push(r)});
      return'<table><tbody>'+rows.map((r,ri)=>'<tr>'+[...r.children].filter(x=>x.localName==='table-cell').map(td=>{const sp=td.getAttributeNS(NS.table,'number-columns-spanned');const tag=ri===0&&c.querySelector('table-header-rows')?'th':'td';return`<${tag}${sp>1?` colspan="${sp}"`:''}>${[...td.children].map(x=>inl(x)).join('<br>')||'<br>'}</${tag}>`}).join('')+'</tr>').join('')+'</tbody></table>'}
    if(l==='section'||l==='table-of-content'||l==='index-body')return blk(l==='table-of-content'?([...c.children].find(x=>x.localName==='index-body')||c):c);
    return''}).join('');
  const body=d.getElementsByTagNameNS(NS.text,'text')[0]||d.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0','text')[0];
  return blk(body)||'<p><br></p>'}

/* --- CSV/TSV --- */
function csvToHtml(t,sep){t=t.replace(/^\ufeff/,'');if(!sep){const l=t.split('\n')[0];sep=l.includes('\t')?'\t':(l.split(';').length>l.split(',').length?';':',')}
  const rows=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'&&t[i+1]==='"'){f+='"';i++}else if(c==='"')q=false;else f+=c;continue}
    if(c==='"'){q=true;continue}if(c===sep){row.push(f);f='';continue}if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(f);f='';if(row.some(x=>x!==''))rows.push(row);row=[];continue}f+=c}
  row.push(f);if(row.some(x=>x!==''))rows.push(row);if(!rows.length)return'<p><br></p>';
  return'<table><tbody>'+rows.map((r,i)=>'<tr>'+r.map(c=>i?`<td>${esc(c)||'<br>'}</td>`:`<th>${esc(c)||'<br>'}</th>`).join('')+'</tr>').join('')+'</tbody></table><p><br></p>'}

async function fileToHtml(f){const ext=(f.name.split('.').pop()||'').toLowerCase();const buf=await f.arrayBuffer();const kind=sniff(buf);
  if(kind==='cfb')return{html:docBinaryToHtml(buf),note:'Documento do Word 97–2003: texto, parágrafos e tabelas importados; a formatação do arquivo original não é lida.'};
  if(kind==='rtf')return{html:rtfToHtml(new TextDecoder('latin1').decode(u8(buf)))};
  if(kind==='zip'){await loadScript('/vendor/jszip.min.js');const z=await JSZip.loadAsync(buf);
    if(z.file('word/document.xml')){await loadScript('/vendor/mammoth.browser.min.js');
      const r=await mammoth.convertToHtml({arrayBuffer:buf},{styleMap:["p[style-name='Title'] => p.title:fresh","p[style-name='Subtitle'] => p.subtitle:fresh","p[style-name='Quote'] => blockquote:fresh","p[style-name='Intense Quote'] => p.emph:fresh","p[style-name='Code'] => pre:fresh","p[style-name='caption'] => p.cap:fresh","r[style-name='Strong'] => strong"],convertImage:mammoth.images.imgElement(img=>img.read('base64').then(b=>({src:'data:'+img.contentType+';base64,'+b})))});
      let h=sanitizeKeepCls(r.value);return{html:h||'<p><br></p>'}}
    if(z.file('content.xml'))return{html:await odtToHtml(z)};
    throw new Error('arquivo compactado não reconhecido como documento')}
  const txt=decodeText(buf);
  if(ext==='json')return{json:JSON.parse(txt)};
  if(kind==='html'||ext==='html'||ext==='htm'){const d=new DOMParser().parseFromString(txt,'text/html');return{html:sanitizeKeepCls(d.body.innerHTML),title:d.title}}
  if(ext==='md'||ext==='markdown')return{html:mdToHtml(txt)};
  if(ext==='csv'||ext==='tsv')return{html:csvToHtml(txt,ext==='tsv'?'\t':null)};
  return{html:paras(txt)}}
// preserva classes do próprio Writer (título, citação, legenda) ao importar
function sanitizeKeepCls(h){const keep=[];const d=document.createElement('div');d.innerHTML=h;d.querySelectorAll('p.title,p.subtitle,p.cap,p.emph,ul.check').forEach(e=>keep.push(e.className));let k=0;
  const out=document.createElement('div');out.innerHTML=sanitize(h);out.querySelectorAll('p,ul').forEach(e=>{});
  const src=[...d.querySelectorAll('p,ul')],dst=[...out.querySelectorAll('p,ul')];if(src.length===dst.length)src.forEach((e,i)=>{if(e.className&&/^(title|subtitle|cap|emph|check)$/.test(e.className))dst[i].className=e.className});return out.innerHTML}

async function importFiles(files){for(const f of files){try{
    const base=f.name.replace(/\.[^.]+$/,'');toast('Abrindo '+f.name+'…',6000);const r=await fileToHtml(f);
    if(r.json){const o=r.json;if(!o.docs&&!o.notes)throw new Error('backup inválido');const nd=Object.keys(o.docs||{}).length,nn=Object.keys(o.notes||{}).length;
      if(!await confirmDlg('Restaurar backup',`Importar ${nd} documentos e ${nn} notas? Itens com o mesmo identificador serão substituídos.`,'Importar'))continue;
      Object.assign(S.docs,o.docs||{});Object.assign(S.notes,o.notes||{});if(o.folders)S.folders=[...new Set([...S.folders,...o.folders])];
      persistLocal();Object.values(o.docs||{}).forEach(d=>Cloud.put('d',d));Object.values(o.notes||{}).forEach(n=>Cloud.put('n',n));Cloud.meta();toast('Backup restaurado');mode==='notes'?NOTES.render():(!$('#home').hidden&&renderHome());continue}
    if(mode==='notes'){const prev=mode;NOTES.create({title:base,html:r.html});toast('Nota importada: '+f.name);continue}
    createDoc({title:base,html:r.html});toast(r.note||('Arquivo aberto: '+f.name),r.note?6000:2500)
  }catch(err){console.error(err);toast(`Não foi possível abrir ${f.name}: ${err.message}`,5000)}}}
$('#fileIn').onchange=e=>{const fs=[...e.target.files];e.target.value='';importFiles(fs)};
/* arrastar arquivo para a janela */
let dragN=0;const hasFiles=e=>[...(e.dataTransfer?.types||[])].includes('Files');
addEventListener('dragenter',e=>{if(!hasFiles(e))return;dragN++;$('#dropz').hidden=false;$('#dropz').textContent=mode==='notes'?'Solte para importar como nota':'Solte para abrir como documento'});
addEventListener('dragleave',e=>{if(!hasFiles(e))return;if(--dragN<=0){dragN=0;$('#dropz').hidden=true}});
addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();dragN=0;$('#dropz').hidden=true;const fs=[...e.dataTransfer.files];
  const imgs=fs.filter(f=>f.type.startsWith('image/'));if(imgs.length===fs.length&&mode==='docs'&&D&&$('#home').hidden){imgs.forEach(insertImageFile);return}importFiles(fs.filter(f=>!f.type.startsWith('image/')||!D))});

/* ================= exportação: RTF e ODT ================= */
function rtfEsc(s){let o='';for(const ch of s){const c=ch.codePointAt(0);if(ch==='\\'||ch==='{'||ch==='}')o+='\\'+ch;else if(ch==='\t')o+='\\tab ';else if(c>126){if(c>0xFFFF){const h=0xD800+((c-0x10000)>>10),l=0xDC00+((c-0x10000)&0x3FF);o+=`\\u${h-65536}?\\u${l-65536}?`}else o+=`\\u${c>32767?c-65536:c}?`}else o+=ch}return o}
function buildRTF(){const root=document.createElement('div');root.innerHTML=exportHTMLbody();const{w,h,m}=dims(),tw=x=>Math.round(x*56.6929);const cw=tw(w-m[1]-m[3]);
  const inl=n=>[...n.childNodes].map(c=>{if(c.nodeType===3)return rtfEsc(c.nodeValue.replace(/\s+/g,' ').replace(/\u200b/g,''));if(c.nodeType!==1)return'';const t=c.tagName,st=c.getAttribute('style')||'';let x=inl(c);
    if(t==='BR')return'\\line ';if(t==='DEL')return`{\\strike ${x}}`;if(t==='STRONG'||t==='B'||/font-weight:\s*(bold|[6-9]00)/.test(st))x=`{\\b ${x}}`;if(t==='EM'||t==='I'||/italic/.test(st))x=`{\\i ${x}}`;
    if(t==='U'||/underline/.test(st)||t==='INS')x=`{\\ul ${x}}`;if(t==='S'||/line-through/.test(st))x=`{\\strike ${x}}`;if(t==='SUP')x=`{\\super ${x}}`;if(t==='SUB')x=`{\\sub ${x}}`;
    if(t==='A'&&c.getAttribute('href'))x=`{\\field{\\*\\fldinst HYPERLINK "${rtfEsc(c.getAttribute('href'))}"}{\\fldrslt{\\ul\\cf2 ${x}}}}`;return x}).join('');
  const al=e=>({center:'\\qc',right:'\\qr',justify:'\\qj'}[e.style?.textAlign]||'');let o='';
  const blk=n=>[...n.children].forEach(c=>{const t=c.tagName,cl=c.classList;
    if(/^H[1-4]$/.test(t)){const sz={1:40,2:30,3:25,4:23}[t[1]];o+=`{\\pard\\s${t[1]}\\keepn\\sb240\\sa120${al(c)}\\f1\\b\\fs${sz} ${inl(c)}\\par}\n`;return}
    if(t==='P'){const fs=cl.contains('title')?'\\f1\\fs56':cl.contains('subtitle')?'\\f1\\fs28\\cf3':cl.contains('cap')?'\\qc\\i\\fs19\\cf3':'';o+=`{\\pard\\sa160${al(c)}${fs} ${inl(c)}\\par}\n`;return}
    if(t==='BLOCKQUOTE'){o+=`{\\pard\\li567\\sa160\\i ${inl(c)}\\par}\n`;return}
    if(t==='PRE'){c.textContent.split('\n').forEach(l=>o+=`{\\pard\\f2\\fs20 ${rtfEsc(l)}\\par}\n`);return}
    if(t==='UL'||t==='OL'){[...c.children].forEach((li,i)=>{const mk=cl.contains('check')?(li.classList.contains('done')?'\\u9745?':'\\u9744?'):t==='OL'?`${i+1}.`:'\\bullet';const cp=li.cloneNode(true);cp.querySelectorAll('ul,ol').forEach(x=>x.remove());o+=`{\\pard\\fi-360\\li720\\sa60 ${mk}\\tab ${inl(cp)}\\par}\n`;li.querySelectorAll(':scope>ul,:scope>ol').forEach(s=>{const w2=document.createElement('div');w2.appendChild(s.cloneNode(true));blk(w2)})});return}
    if(t==='TABLE'){[...c.rows].forEach(r=>{const n=Math.max(1,r.cells.length);let x='\\trowd\\trgaph108';let pos=0;[...r.cells].forEach(()=>{pos+=Math.floor(cw/n);x+=`\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx${pos}`});
      o+=x+'\n'+[...r.cells].map(td=>`\\pard\\intbl${td.tagName==='TH'?'\\b':''} ${inl(td)}\\b0\\cell`).join('')+'\\row\n'});o+='\\pard\\par\n';return}
    if(t==='HR'){o+='{\\pard\\brdrb\\brdrs\\brdrw10\\brsp20 \\par}\n';return}
    if(cl.contains('pbk')){o+='\\page\n';return}
    if(cl.contains('toc')){o+='{\\pard\\sb120\\sa120\\f1\\b\\fs26 '+rtfEsc('Sumário')+'\\par}\n';c.querySelectorAll('a').forEach(a=>{const lv=+(a.className.match(/l(\d)/)||[0,1])[1];o+=`{\\pard\\li${(lv-1)*280}\\tqr\\tldot\\tx${cw}\\f1 ${rtfEsc(a.querySelector('span')?.textContent||'')}\\tab ${rtfEsc(a.querySelector('.pg')?.textContent||'')}\\par}\n`});return}
    if(t==='DIV'||t==='FIGURE'||t==='OL'){blk(c);return}
    const x=inl(c);if(x.trim())o+=`{\\pard ${x}\\par}\n`});
  blk(root);
  return`{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1{\\fonttbl{\\f0\\froman Cambria;}{\\f1\\fswiss Calibri;}{\\f2\\fmodern Consolas;}}{\\colortbl;\\red0\\green0\\blue0;\\red31\\green111\\blue209;\\red95\\green103\\blue109;}{\\info{\\title ${rtfEsc(D.title)}}{\\author ${rtfEsc(author())}}}\\paperw${tw(w)}\\paperh${tw(h)}\\margt${tw(m[0])}\\margr${tw(m[1])}\\margb${tw(m[2])}\\margl${tw(m[3])}${D.layout.orient==='l'?'\\landscape':''}\\deflang1046\\f0\\fs24\n${rtfHF()}${o}}`}
function rtfHF(){const L=D.layout,hd=fill(L.hdr),ft=fill(L.ftr);let x='';if(hd)x+=`{\\header\\pard\\qc\\f1\\fs18\\cf3 ${rtfEsc(hd)}\\par}`;const pn=L.pnum==='none'?'':'P'+rtfEsc('á')+'gina {\\field{\\*\\fldinst PAGE}{\\fldrslt 1}} de {\\field{\\*\\fldinst NUMPAGES}{\\fldrslt 1}}';
  if(ft||pn)x+=`{\\footer\\pard${{l:'',c:'\\qc',r:'\\qr'}[L.pnum]||''}\\f1\\fs18\\cf3 ${rtfEsc(ft)}${ft&&pn?' \\u183? ':''}${pn}\\par}`;return x}

async function buildODT(){await loadScript('/vendor/jszip.min.js');
  const root=document.createElement('div');root.innerHTML=exportHTMLbody();const{w,h,m}=dims();const live=$$('img',ed);const imgs=$$('img',root);
  const z=new JSZip();z.file('mimetype','application/vnd.oasis.opendocument.text',{compression:'STORE'});const pics=[];const contentW=w-m[1]-m[3];
  for(let i=0;i<imgs.length;i++){const im=imgs[i],lv=live[i];let src=im.getAttribute('src')||'';let nw=lv?.naturalWidth||0,nh=lv?.naturalHeight||0;let mime=(src.match(/^data:(image\/[a-z+]+);base64,/)||[])[1];
    if(!mime||!/png|jpeg|gif/.test(mime)){const r=await rasterize(src);if(!r){im.remove();continue}src=r.url;mime='image/png';nw=r.w;nh=r.h}
    const name=`Pictures/img${i+1}.${mime.split('/')[1].replace('jpeg','jpg')}`;z.file(name,src.split(',')[1],{base64:true});pics.push([name,mime]);
    const pct=parseFloat(im.style.width)||100;const wmm=Math.min(contentW,contentW*pct/100);im.dataset.odt=name;im.dataset.w=wmm.toFixed(1);im.dataset.h=(nw?wmm*nh/nw:wmm*.66).toFixed(1)}
  const auto=new Map();const tstyle=f=>{const k=JSON.stringify(f);if(!auto.has(k))auto.set(k,'T'+(auto.size+1));return auto.get(k)};
  let pid=0;const pAl={};const pStyle=(base,al)=>{if(!al)return base;const k=base+'|'+al;if(!pAl[k])pAl[k]='P'+(++pid);return pAl[k]};
  const inl=(n,f={})=>[...n.childNodes].map(c=>{if(c.nodeType===3){const t=xe(c.nodeValue.replace(/\u200b/g,'')).replace(/\t/g,'<text:tab/>').replace(/ {2,}/g,s=>' <text:s text:c="'+(s.length-1)+'"/>');const k=Object.keys(f).filter(x=>f[x]).length;return k?`<text:span text:style-name="${tstyle(f)}">${t}</text:span>`:t}
    if(c.nodeType!==1)return'';const t=c.tagName,st=c.getAttribute('style')||'';const g={...f};
    if(t==='BR')return'<text:line-break/>';if(t==='IMG'){if(!c.dataset.odt)return'';return`<draw:frame draw:name="${c.dataset.odt}" text:anchor-type="as-char" svg:width="${c.dataset.w}mm" svg:height="${c.dataset.h}mm"><draw:image xlink:href="${c.dataset.odt}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`}
    if(t==='STRONG'||t==='B'||/font-weight:\s*(bold|[6-9]00)/.test(st))g.b=1;if(t==='EM'||t==='I'||/italic/.test(st))g.i=1;if(t==='U'||/underline/.test(st))g.u=1;if(t==='S'||t==='DEL'||/line-through/.test(st))g.s=1;
    if(t==='SUP')g.sup=1;if(t==='SUB')g.sub=1;const col=cssHex(c.style.color);if(col)g.c=col;const bg=cssHex(c.style.backgroundColor);if(bg)g.bg=bg;if(t==='CODE')g.mono=1;
    if(t==='A'&&c.getAttribute('href'))return`<text:a xlink:type="simple" xlink:href="${xe(c.getAttribute('href'))}">${inl(c,g)}</text:a>`;return inl(c,g)}).join('');
  const al=e=>({center:'center',right:'end',justify:'justify'}[e.style?.textAlign]||'');let body='';let tn=0;
  const list=(c)=>{const ord=c.tagName==='OL',chk=c.classList.contains('check');if(chk)return[...c.children].map(li=>`<text:p text:style-name="Check">${li.classList.contains('done')?'☑':'☐'}<text:tab/>${inl(li)}</text:p>`).join('');return`<text:list text:style-name="${ord?'LNum':'LBul'}">`+[...c.children].map(li=>{const cp=li.cloneNode(true);cp.querySelectorAll('ul,ol').forEach(x=>x.remove());
      const pre=chk?(li.classList.contains('done')?'☑ ':'☐ '):'';return`<text:list-item><text:p text:style-name="List">${pre}${inl(cp)}</text:p>${[...li.querySelectorAll(':scope>ul,:scope>ol')].map(list).join('')}</text:list-item>`}).join('')+'</text:list>'};
  const blk=n=>[...n.children].forEach(c=>{const t=c.tagName,cl=c.classList;
    if(/^H[1-4]$/.test(t)){body+=`<text:h text:style-name="Heading_20_${t[1]}" text:outline-level="${t[1]}">${inl(c)}</text:h>`;return}
    if(t==='P'){const base=cl.contains('title')?'Title':cl.contains('subtitle')?'Subtitle':cl.contains('cap')?'Caption':'Standard';body+=`<text:p text:style-name="${pStyle(base,al(c))}">${inl(c)}</text:p>`;return}
    if(t==='BLOCKQUOTE'){body+=`<text:p text:style-name="Quotations">${inl(c)}</text:p>`;return}
    if(t==='PRE'){c.textContent.split('\n').forEach(l=>body+=`<text:p text:style-name="Preformatted_20_Text">${xe(l).replace(/ {2,}/g,s=>' <text:s text:c="'+(s.length-1)+'"/>')}</text:p>`);return}
    if(t==='UL'||t==='OL'){body+=list(c);return}
    if(t==='TABLE'){const cols=Math.max(1,...[...c.rows].map(r=>[...r.cells].reduce((a,x)=>a+(x.colSpan||1),0)));tn++;
      body+=`<table:table table:name="Tabela${tn}" table:style-name="Tbl"><table:table-column table:number-columns-repeated="${cols}"/>`+[...c.rows].map(r=>'<table:table-row>'+[...r.cells].map(td=>`<table:table-cell table:style-name="Cell" office:value-type="string"${td.colSpan>1?` table:number-columns-spanned="${td.colSpan}"`:''}><text:p text:style-name="${td.tagName==='TH'?'TableHead':'Table_20_Contents'}">${inl(td)}</text:p></table:table-cell>`+(td.colSpan>1?'<table:covered-table-cell/>'.repeat(td.colSpan-1):'')).join('')+'</table:table-row>').join('')+'</table:table>';return}
    if(t==='HR'){body+='<text:p text:style-name="Rule"/>';return}
    if(cl.contains('pbk')){body+='<text:p text:style-name="PageBreak"/>';return}
    if(cl.contains('callout')){[...c.children].forEach(p=>body+=`<text:p text:style-name="Callout">${inl(p)}</text:p>`);return}
    if(cl.contains('toc')){body+='<text:p text:style-name="TOCHead">Sumário</text:p>';c.querySelectorAll('a').forEach(a=>{const lv=Math.min(3,+(a.className.match(/l(\d)/)||[0,1])[1]);const tx=a.querySelector('span')?.textContent||'';const pg=a.querySelector('.pg')?.textContent||'';body+=`<text:p text:style-name="TOC${lv}">${xe(tx)}<text:tab/>${xe(pg)}</text:p>`});return}
    if(t==='DIV'||t==='FIGURE'){if(t==='FIGURE'){body+=`<text:p text:style-name="${pStyle('Standard','center')}">${inl(c)}</text:p>`;return}blk(c);return}
    const x=inl(c);if(x.trim())body+=`<text:p text:style-name="Standard">${x}</text:p>`});
  blk(root);
  const autoXml=[...auto.entries()].map(([k,n])=>{const f=JSON.parse(k);return`<style:style style:name="${n}" style:family="text"><style:text-properties${f.b?' fo:font-weight="bold" style:font-weight-asian="bold"':''}${f.i?' fo:font-style="italic"':''}${f.u?' style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"':''}${f.s?' style:text-line-through-style="solid"':''}${f.sup?' style:text-position="super 58%"':''}${f.sub?' style:text-position="sub 58%"':''}${f.c?` fo:color="#${f.c}"`:''}${f.bg?` fo:background-color="#${f.bg}"`:''}${f.mono?' style:font-name="Consolas"':''}/></style:style>`}).join('')+
    Object.entries(pAl).map(([k,n])=>{const[b,a]=k.split('|');return`<style:style style:name="${n}" style:family="paragraph" style:parent-style-name="${b}"><style:paragraph-properties fo:text-align="${a}"/></style:style>`}).join('');
  const NSD='xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3"';
  const fonts='<office:font-face-decls><style:font-face style:name="Cambria" svg:font-family="Cambria" style:font-family-generic="roman"/><style:font-face style:name="Calibri" svg:font-family="Calibri" style:font-family-generic="swiss"/><style:font-face style:name="Consolas" svg:font-family="Consolas" style:font-family-generic="modern" style:font-pitch="fixed"/></office:font-face-decls>';
  z.file('content.xml',`<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NSD}>${fonts}<office:automatic-styles><style:style style:name="Tbl" style:family="table"><style:table-properties style:width="${(contentW/10).toFixed(2)}cm" table:align="margins"/></style:style><style:style style:name="Cell" style:family="table-cell"><style:table-cell-properties fo:padding="0.1cm" fo:border="0.03cm solid #b9c0c6"/></style:style>${autoXml}</office:automatic-styles><office:body><office:text>${body}</office:text></office:body></office:document-content>`);
  const L=D.layout,ft=fill(L.ftr),hd=fill(L.hdr);const pn=L.pnum==='none'?'':'Página <text:page-number text:select-page="current">1</text:page-number> de <text:page-count>1</text:page-count>';
  const ps=(name,parent,pp,tp,cls='text')=>`<style:style style:name="${name}" style:family="paragraph"${parent?` style:parent-style-name="${parent}"`:''} style:class="${cls}">${pp?`<style:paragraph-properties ${pp}/>`:''}${tp?`<style:text-properties ${tp}/>`:''}</style:style>`;
  const sans='style:font-name="Calibri"';
  z.file('styles.xml',`<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NSD}>${fonts}<office:styles>
<style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.28cm" fo:line-height="140%"/><style:text-properties style:font-name="Cambria" fo:font-size="12pt" fo:language="pt" fo:country="BR"/></style:default-style>
${ps('Standard','','','')}${ps('Heading','Standard','fo:margin-top="0.42cm" fo:margin-bottom="0.21cm" fo:keep-with-next="always"',sans+' fo:font-weight="bold"')}
${[[1,'20pt'],[2,'15pt'],[3,'12.5pt'],[4,'11.5pt']].map(([i,s])=>`<style:style style:name="Heading_20_${i}" style:display-name="Heading ${i}" style:family="paragraph" style:parent-style-name="Heading" style:default-outline-level="${i}" style:class="text"><style:text-properties fo:font-size="${s}"${i===4?' fo:font-style="italic"':''}/></style:style>`).join('')}
${ps('Title','Standard','fo:margin-bottom="0.2cm"',sans+' fo:font-size="28pt"','chapter')}${ps('Subtitle','Standard','fo:margin-bottom="0.5cm"',sans+' fo:font-size="14pt" fo:color="#5f676d"','chapter')}
${ps('Quotations','Standard','fo:margin-left="1cm" fo:padding-left="0.3cm" fo:border-left="0.06cm solid #c9ced3"','fo:font-style="italic" fo:color="#3c4247"')}
${ps('Preformatted_20_Text','Standard','fo:margin-bottom="0cm" fo:line-height="100%" fo:background-color="#f2f4f5"','style:font-name="Consolas" fo:font-size="10pt"')}
${ps('Caption','Standard','fo:text-align="center"',sans+' fo:font-size="9.5pt" fo:font-style="italic" fo:color="#5f676d"','extra')}
${ps('List','Standard','fo:margin-bottom="0.1cm"','','list')}${ps('Table_20_Contents','Standard','fo:margin-bottom="0cm" fo:line-height="115%"','fo:font-size="11pt"','extra')}${ps('TableHead','Table_20_Contents','',sans+' fo:font-weight="bold"','extra')}
${ps('Rule','Standard','fo:border-bottom="0.03cm solid #c9ced3" fo:padding-bottom="0.1cm"','')}${ps('PageBreak','Standard','fo:break-before="page"','')}
${ps('Callout','Standard','fo:background-color="#fff8e6" fo:border="0.03cm solid #e5c98b" fo:padding="0.2cm"','')}
${[1,2,3].map(l=>`<style:style style:name="TOC${l}" style:family="paragraph" style:parent-style-name="Standard" style:class="index"><style:paragraph-properties fo:margin-left="${(l-1)*0.5}cm" fo:margin-bottom="0.08cm"><style:tab-stops><style:tab-stop style:position="${(contentW/10).toFixed(2)}cm" style:type="right" style:leader-style="dotted" style:leader-text="."/></style:tab-stops></style:paragraph-properties><style:text-properties ${sans}/></style:style>`).join('')}${ps('TOCHead','Standard','fo:margin-top="0.2cm" fo:margin-bottom="0.2cm"',sans+' fo:font-weight="bold" fo:font-size="13pt"')}${ps('Check','Standard','fo:margin-left="0.6cm" fo:margin-bottom="0.1cm"','')}
${ps('Header','Standard','fo:text-align="center"',sans+' fo:font-size="9pt" fo:color="#80878d"','extra')}${ps('Footer','Standard','fo:text-align="'+({l:'start',c:'center',r:'end'}[L.pnum]||'start')+'"',sans+' fo:font-size="9pt" fo:color="#80878d"','extra')}
<text:list-style style:name="LBul">${Array.from({length:6},(_,i)=>`<text:list-level-style-bullet text:level="${i+1}" text:bullet-char="${['•','◦','▪'][i%3]}"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.6cm" fo:margin-left="${(1.2+i*0.6).toFixed(1)}cm"/></style:list-level-properties></text:list-level-style-bullet>`).join('')}</text:list-style>
<text:list-style style:name="LNum">${Array.from({length:6},(_,i)=>`<text:list-level-style-number text:level="${i+1}" style:num-suffix="." style:num-format="${['1','a','i'][i%3]}"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" fo:text-indent="-0.6cm" fo:margin-left="${(1.2+i*0.6).toFixed(1)}cm"/></style:list-level-properties></text:list-level-style-number>`).join('')}</text:list-style>
</office:styles><office:automatic-styles><style:page-layout style:name="PL"><style:page-layout-properties fo:page-width="${w}mm" fo:page-height="${h}mm" style:print-orientation="${L.orient==='l'?'landscape':'portrait'}" fo:margin-top="${Math.max(5,m[0]-12)}mm" fo:margin-right="${m[1]}mm" fo:margin-bottom="${Math.max(5,m[2]-12)}mm" fo:margin-left="${m[3]}mm">${L.cols>1?`<style:columns fo:column-count="${L.cols}" fo:column-gap="1cm"/>`:''}</style:page-layout-properties><style:header-style><style:header-footer-properties fo:min-height="0cm" fo:margin-bottom="7mm"/></style:header-style><style:footer-style><style:header-footer-properties fo:min-height="0cm" fo:margin-top="7mm"/></style:footer-style></style:page-layout></office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="PL">${hd?`<style:header><text:p text:style-name="Header">${xe(hd)}</text:p></style:header>`:''}${ft||pn?`<style:footer><text:p text:style-name="Footer">${xe(ft)}${ft&&pn?' · ':''}${pn}</text:p></style:footer>`:''}</style:master-page></office:master-styles></office:document-styles>`);
  z.file('meta.xml',`<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${NSD}><office:meta><dc:title>${xe(D.title)}</dc:title><meta:initial-creator>${xe(author())}</meta:initial-creator><meta:creation-date>${new Date(D.createdAt).toISOString().slice(0,19)}</meta:creation-date><meta:generator>GPlanSiS|Writer</meta:generator></office:meta></office:document-meta>`);
  z.file('META-INF/manifest.xml',`<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${pics.map(([n,mm])=>`<manifest:file-entry manifest:full-path="${n}" manifest:media-type="${mm}"/>`).join('')}</manifest:manifest>`);
  return z.generateAsync({type:'blob',mimeType:'application/vnd.oasis.opendocument.text'})}

/* menu de exportação reorganizado */
function plainText(){const d=document.createElement('div');d.innerHTML=exportHTMLbody().replace(/<\/(p|h\d|li|blockquote|pre)>/g,'$&\n').replace(/<\/t[dh]>/g,'\t').replace(/<\/tr>/g,'\n').replace(/<br>/g,'\n');d.querySelectorAll('.toc a').forEach(a=>{a.textContent=(a.querySelector('span')?.textContent||'')+'  ·  '+(a.querySelector('.pg')?.textContent||'')+'\n'});d.querySelectorAll('.toc .tt').forEach(t=>t.textContent+='\n');d.querySelectorAll('li').forEach(li=>li.insertAdjacentText('afterbegin','• '));return d.textContent.replace(/\t\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()+'\n'}
exportMenu=function(anchor){if(mode==='notes')return NOTES.exportMenu(anchor);
  if(!D||!$('#home').hidden){return menu(anchor,[{label:'Abrir arquivo…',icon:'open',k:'docx, doc, odt, rtf, txt…',run:()=>$('#fileIn').click()},'-',{label:'Backup completo (.json)',icon:'dup',run:backupAll}])}
  const run=(fn)=>async()=>{flushSave();try{await fn()}catch(e){console.error(e);toast('Falha ao exportar: '+e.message,4500)}};
  const m=menu(anchor,[
   {label:'Word (.docx)',icon:'doc',run:()=>exportDocx()},
   {label:'Word 97–2003 (.doc)',icon:'doc',run:run(()=>saveBlob(safeName(D.title)+'.doc','\ufeff'+`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(D.title)}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>${pageCSS().replace(/@(top|bottom)-[a-z]+\{[^}]*\}/g,'')}${DOC_CSS}</style></head><body>${exportHTMLbody()}</body></html>`,'application/msword'))},
   {label:'OpenDocument (.odt)',icon:'doc',run:run(async()=>saveBlob(safeName(D.title)+'.odt',await buildODT()))},
   {label:'Rich Text (.rtf)',icon:'doc',run:run(()=>saveBlob(safeName(D.title)+'.rtf',buildRTF(),'application/rtf'))},
   '-',
   {label:'PDF (imprimir)',icon:'print',k:'Ctrl+P',run:printDoc},
   {label:'Página web (.html)',icon:'code',run:run(()=>saveBlob(safeName(D.title)+'.html',standaloneHTML(),'text/html'))},
   {label:'Markdown (.md)',icon:'lines',run:run(()=>{const d=document.createElement('div');d.innerHTML=exportHTMLbody();saveBlob(safeName(D.title)+'.md',htmlToMd(d),'text/markdown')})},
   {label:'Texto (.txt)',icon:'al',run:run(()=>saveBlob(safeName(D.title)+'.txt','\ufeff'+plainText(),'text/plain;charset=utf-8'))},
   '-',{label:'Abrir arquivo…',icon:'open',k:'docx, doc, odt, rtf, txt…',run:()=>$('#fileIn').click()},{label:'Backup completo (.json)',icon:'dup',run:backupAll}]);
  return m};
"use strict";
/* ================= assistente (IA) ================= */
let SAMPLE;async function getSample(){if(SAMPLE!==undefined)return SAMPLE;try{SAMPLE=window.claude&&claude.use?await claude.use('sample'):null}catch(e){SAMPLE=null}return SAMPLE}
const AI={kind:null,arg:null,range:null,src:'',out:'',busy:false,ctl:null,custom:''};
const AIP={
 melhorar:['Melhorar escrita','Reescreva o texto deixando-o mais claro, direto e bem encadeado, mantendo o sentido, os números e os termos técnicos.'],
 corrigir:['Corrigir','Corrija ortografia, gramática, concordância e pontuação. Não mude o estilo nem o conteúdo além do necessário.'],
 resumir:['Resumir','Resuma o texto em poucos parágrafos curtos, preservando números, decisões e conclusões.'],
 expandir:['Expandir','Desenvolva o texto com mais detalhe e exemplos concretos, sem inventar dados numéricos; onde faltar um dado, escreva [dado a confirmar].'],
 formal:['Tom formal','Reescreva em tom formal e profissional, adequado a documento técnico ou corporativo.'],
 traduzir:['Traduzir','Traduza fielmente o texto para {arg}, preservando a formatação.'],
 topicos:['Tópicos','Transforme o texto em uma lista de tópicos objetiva, agrupada por assunto com subtítulos curtos.'],
 acoes:['Ações da ata','Extraia as ações do texto numa tabela com as colunas Ação, Responsável, Prazo e Situação. Se responsável ou prazo não estiverem no texto, escreva "a definir" — não invente.']
};
function aiScope(){const r=lastRange;if(r&&!r.collapsed&&ed.contains(r.startContainer)){const d=document.createElement('div');d.appendChild(r.cloneContents());d.querySelectorAll('del,.pgsp,.toc').forEach(e=>e.remove());return{range:r.cloneRange(),html:d.innerHTML,sel:true}}
  return{range:null,html:exportHTMLbody(),sel:false}}
function aiRun(kind,arg){if(!D)return;AI.kind=kind;AI.arg=arg||null;AI.custom='';openSide('ai');aiGo()}
async function aiGo(){const s=await getSample();const sc=aiScope();AI.range=sc.range;AI.sel=sc.sel;
  if(!s){AI.out='';AI.err='O Assistente IA não está disponível agora. Um administrador o liga em Configurações › Assistente IA.';renderAIPane($('#sideB'));return}
  const instr=AI.kind==='custom'?AI.custom:AIP[AI.kind][1].replace('{arg}',AI.arg||'inglês');
  const text=sc.html.length>60000?sc.html.slice(0,60000):sc.html;
  const prompt=`Você é o assistente de escrita do GPlanSiS|Writer, um editor de documentos.\nTarefa: ${instr}\n\nRegras:\n- Responda SOMENTE com o resultado, em HTML simples (p, h2, h3, ul, ol, li, strong, em, table, tr, th, td, blockquote). Sem cercas de código, sem comentários antes ou depois.\n- Escreva em português do Brasil, salvo se a tarefa pedir outro idioma.\n- Não invente fatos, números, nomes ou datas que não estejam no texto.\n\nTítulo do documento: ${D.title}\n${sc.sel?'Trecho selecionado':'Documento completo'} (HTML):\n<<<\n${text}\n>>>`;
  AI.ctl&&AI.ctl.abort();AI.ctl=new AbortController();AI.busy=true;AI.out='';AI.err='';renderAIPane($('#sideB'));
  try{const r=await s(prompt,{signal:AI.ctl.signal,modelTier:'default',cache:false,onText:({text})=>{AI.out=text;const o=$('#aiOut');if(o)o.innerHTML=sanitize(clean(text))}});AI.out=r.text;if(r.truncated)AI.err='A resposta foi cortada por tamanho; selecione um trecho menor.'}
  catch(e){if(e&&e.name==='AbortError'){AI.err='Interrompido.'}else AI.err=e&&e.code==='not_granted'?'Permissão para o assistente não concedida.':e&&e.code==='rate_limited'?'Muitas solicitações seguidas. Aguarde um pouco e tente de novo.':'Não foi possível gerar: '+((e&&e.message)||e)}
  AI.busy=false;renderAIPane($('#sideB'))}
const clean=t=>String(t||'').replace(/^```(?:html)?\s*/i,'').replace(/```\s*$/,'').trim();
function renderAIPane(b){if(sideMode!=='ai')return;const k=AI.kind&&AI.kind!=='custom'?AIP[AI.kind][0]:AI.kind==='custom'?'Pedido livre':'';
  b.innerHTML=`<div class="seg" style="margin-bottom:8px">${Object.entries(AIP).filter(([x])=>x!=='traduzir').map(([x,v])=>`<button class="chip${AI.kind===x?' on':''}" data-k="${x}">${v[0]}</button>`).join('')}<button class="chip" data-k="traduzir" data-arg="inglês">Traduzir p/ inglês</button></div>
  <label class="fld"><span>Ou peça algo específico</span><textarea class="inp" id="aiQ" rows="3" placeholder="Ex.: escreva uma introdução para este relatório; transforme em e-mail para o cliente">${esc(AI.custom)}</textarea></label>
  <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px"><button class="tb primary" id="aiGo">${svg('send')}Gerar</button>${AI.busy?'<button class="tb" id="aiStop">Parar</button>':''}<span class="small">${lastRange&&!lastRange.collapsed?'Usa o trecho selecionado':'Usa o documento inteiro'}</span></div>
  ${k?`<div class="small" style="margin-bottom:4px">${esc(k)}${AI.busy?' — escrevendo…':''}</div>`:''}
  ${AI.err?`<div class="card" style="border-color:var(--danger)">${esc(AI.err)}</div>`:''}
  ${AI.out||AI.busy?`<div id="aiOut">${sanitize(clean(AI.out))}</div>`:'<div class="small">Escolha uma ação acima. O resultado aparece aqui para você revisar antes de aplicar.</div>'}
  ${AI.out&&!AI.busy?`<div class="acts" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">${AI.sel&&AI.range?'<button class="tb primary" data-ap="rep">Substituir seleção</button>':''}<button class="tb" data-ap="ins">Inserir abaixo</button><button class="tb" data-ap="note">Salvar como nota</button><button class="tb" data-ap="doc">Novo documento</button><button class="tb" data-ap="copy">Copiar</button></div>`:''}`;
  b.onclick=async e=>{const c=e.target.closest('[data-k]');if(c){aiRun(c.dataset.k,c.dataset.arg);return}
    if(e.target.closest('#aiGo')){const q=$('#aiQ').value.trim();if(q){AI.kind='custom';AI.custom=q}else if(!AI.kind)AI.kind='melhorar';aiGo();return}
    if(e.target.closest('#aiStop')){AI.ctl&&AI.ctl.abort();return}
    const ap=e.target.closest('[data-ap]');if(!ap)return;const html=sanitize(clean(AI.out));
    if(ap.dataset.ap==='rep'&&AI.range){const s=getSelection();ed.focus();s.removeAllRanges();s.addRange(AI.range);lastRange=AI.range;
      if(D.track){const r=AI.range;markDel(r,false)}insertHTML(D.track?`<ins data-a="${esc(author())}" data-t="${now()}">${html}</ins>`:html);toast('Trecho substituído')}
    if(ap.dataset.ap==='ins'){const r=AI.range||(()=>{const x=document.createRange();x.selectNodeContents(ed);x.collapse(false);return x})();let blk=closestIn(r.endContainer,'p,h1,h2,h3,h4,li,blockquote,pre,table,ul,ol,div.callout');while(blk&&blk.parentNode!==ed)blk=blk.parentNode;
      const t=document.createElement('template');t.innerHTML=html;const frag=t.content;if(blk)blk.after(frag);else ed.appendChild(frag);afterEdit();toast('Inserido no documento')}
    if(ap.dataset.ap==='note'){NOTES.create({title:(AIP[AI.kind]?.[0]||'Assistente')+' — '+D.title,html,docId:D.id});toast('Nota criada')}
    if(ap.dataset.ap==='doc'){createDoc({title:(AIP[AI.kind]?.[0]||'Rascunho')+' — '+D.title,html})}
    if(ap.dataset.ap==='copy'){try{await navigator.clipboard.writeText($('#aiOut').innerText);toast('Copiado')}catch(e){toast('Não foi possível copiar')}}};
  const q=$('#aiQ');if(q)q.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();$('#aiGo').click()}}}

/* ================= NOTAS ================= */
const NCOL={'':'transparent',yel:'var(--n-yel)',grn:'var(--n-grn)',blu:'var(--n-blu)',red:'var(--n-red)',vio:'var(--n-vio)'};
const nEd=$('#nEd'),nTitle=$('#nTitle');
const NOTES={view:'all',cur:null,q:'',lastRange:null,
  list(){return Object.values(S.notes)},
  tags(){const m={};this.list().filter(n=>!n.deleted).forEach(n=>(n.tags||[]).forEach(t=>m[t]=(m[t]||0)+1));return Object.entries(m).sort((a,b)=>b[1]-a[1])},
  filtered(){const q=this.q.trim().toLowerCase();let L=this.list();const v=this.view;
    L=L.filter(n=>v==='trash'?n.deleted:!n.deleted);
    if(v==='pinned')L=L.filter(n=>n.pinned);if(v==='docs')L=L.filter(n=>n.docId&&S.docs[n.docId]);
    if(v.startsWith('f:'))L=L.filter(n=>n.folder===v.slice(2));if(v.startsWith('t:'))L=L.filter(n=>(n.tags||[]).includes(v.slice(2)));
    if(q){const tq=q.startsWith('#')?q.slice(1):null;L=L.filter(n=>tq?(n.tags||[]).some(t=>t.toLowerCase().startsWith(tq)):((n.title||'')+' '+textOf(n.html)).toLowerCase().includes(q))}
    const so=$('#nSort').value;L.sort((a,b)=>so==='tit'?(this.tt(a)).localeCompare(this.tt(b),'pt-BR'):so==='cre'?b.createdAt-a.createdAt:b.updatedAt-a.updatedAt);return L},
  tt(n){return(n.title||'').trim()||textOf(n.html).trim().split('\n')[0].slice(0,60)||'Nova nota'},
  create(o={}){const v=this.view;const n={id:uid(),title:o.title||'',html:o.html||'',folder:o.folder??(v.startsWith('f:')?v.slice(2):''),color:o.color||'',pinned:false,docId:o.docId||null,tags:[],createdAt:now(),updatedAt:now(),deleted:false};
    n.tags=extractTags(n.html);S.notes[n.id]=n;persistLocal();Cloud.put('n',n);
    if(mode==='notes'){if(v==='trash'||v==='pinned'||v.startsWith('t:'))this.view='all';this.open(n.id);(n.title?nEd:nTitle).focus()}
    if(sideMode==='notes')refreshPanels();return n},
  open(id){this.flush();this.cur=id;S.settings.lastNote=id;persistLocalD();$('#notes').classList.add('editing');this.renderList();this.renderEditor()},
  get note(){return S.notes[this.cur]},
  save:null,
  flush(){if(!this._dirty)return;const n=this.note;this._dirty=false;if(!n)return;n.html=nEd.innerHTML.replace(/^<br>$/,'');n.title=nTitle.value.trim();n.tags=extractTags(n.html+' '+n.title);n.updatedAt=now();persistLocal();Cloud.put('n',n);this.renderList();this.renderFolders();this.renderMeta()},
  render(){this.renderFolders();this.renderList();this.renderEditor()},
  renderFolders(){const L=this.list(),live=L.filter(n=>!n.deleted);const c=f=>live.filter(f).length;const v=this.view;
    const row=(key,icon,label,count,extra='')=>`<div class="fold${v===key?' on':''}" data-v="${esc(key)}">${svg(icon)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(label)}</span>${extra}<span class="c">${count}</span></div>`;
    const tags=this.tags();
    $('#nFold').innerHTML=`<div style="padding:8px 0;overflow:auto;flex:1">${row('all','all','Todas as notas',live.length)}${row('pinned','pin','Fixadas',c(n=>n.pinned))}${row('docs','doc','Ligadas a documentos',c(n=>n.docId&&S.docs[n.docId]))}
      <div class="fsec">Pastas<button id="nAddF" title="Nova pasta">+</button></div>${S.folders.map(f=>row('f:'+f,'folder',f,c(n=>n.folder===f),`<button class="ib" data-fm="${esc(f)}" title="Opções da pasta" style="min-width:20px;height:20px;padding:0">⋯</button>`)).join('')}
      ${tags.length?`<div class="fsec">Etiquetas</div>`+tags.slice(0,30).map(([t,k])=>row('t:'+t,'tag','#'+t,k)).join(''):''}
      <div class="fsec"></div>${row('trash','trash','Lixeira',L.filter(n=>n.deleted).length)}</div>`;
    const lab={all:'Todas as notas',pinned:'Fixadas',docs:'Ligadas a documentos',trash:'Lixeira'};$('#nListT').textContent=lab[v]||(v.startsWith('f:')?v.slice(2):'#'+v.slice(2))},
  renderList(){const L=this.filtered();const now0=new Date();now0.setHours(0,0,0,0);const d7=now0.getTime()-6*864e5,d30=now0.getTime()-29*864e5;
    const so=$('#nSort').value;const groups=[];const put=(g,n)=>{let x=groups.find(y=>y.g===g);if(!x)groups.push(x={g,items:[]});x.items.push(n)};
    L.forEach(n=>{if(n.pinned&&this.view!=='trash'&&so!=='tit')return put('Fixadas',n);if(so==='tit')return put('',n);const t=so==='cre'?n.createdAt:n.updatedAt;put(t>=now0.getTime()?'Hoje':t>=d7?'Últimos 7 dias':t>=d30?'Últimos 30 dias':new Date(t).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),n)});
    groups.sort((a,b)=>(a.g==='Fixadas'?-1:0)-(b.g==='Fixadas'?-1:0));
    $('#nItems').innerHTML=L.length?groups.map(g=>(g.g?`<div class="ngrp">${esc(g.g)}</div>`:'')+g.items.map(n=>{const s=textOf(n.html).replace(/\s+/g,' ').trim();const first=(n.title||'').trim()?s:s.slice(this.tt(n).length).trim();const doc=n.docId&&S.docs[n.docId];
      return`<div class="nitem${n.id===this.cur?' on':''}" data-n="${n.id}" draggable="true" style="--nc:${NCOL[n.color||'']}"><div class="t">${n.pinned?svg('pin',2):''}${esc(this.tt(n))}</div><div class="s">${esc(first.slice(0,160))||'<i>Sem texto adicional</i>'}</div><div class="d"><span>${fmtDate(n.updatedAt)}</span>${n.folder?`<span>${svg('folder').replace('<svg','<svg style="width:11px;height:11px;vertical-align:-1px"')} ${esc(n.folder)}</span>`:''}${doc?`<span>${svg('doc').replace('<svg','<svg style="width:11px;height:11px;vertical-align:-1px"')} ${esc(doc.title.slice(0,24))}</span>`:''}${(n.tags||[]).slice(0,3).map(t=>`<span class="tag">#${esc(t)}</span>`).join('')}</div></div>`}).join('')).join('')
      :`<div class="empty">${this.q?'Nenhuma nota encontrada.':this.view==='trash'?'A lixeira está vazia.':'Nenhuma nota aqui ainda.<br><br><button class="tb primary" data-newn>Nova nota</button>'}</div>`;
    if(this.view==='trash'&&L.length)$('#nItems').insertAdjacentHTML('afterbegin',`<div style="padding:8px 12px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:6px"><span class="small" style="flex:1">Notas na lixeira podem ser restauradas.</span><button class="tb danger" id="nEmpty">Esvaziar</button></div>`)},
  renderMeta(){const n=this.note;if(!n)return;const doc=n.docId&&S.docs[n.docId];
    $('#nMeta').innerHTML=`<span>Editada ${fmtDate(n.updatedAt).replace(/^(\d)/,'em $1')}</span>${doc?`<button class="chip" data-opendoc="${doc.id}">${svg('doc').replace('<svg','<svg style="width:12px;height:12px;vertical-align:-2px"')} ${esc(doc.title)}</button>`:''}${(n.tags||[]).map(t=>`<button class="chip" data-tagv="${esc(t)}">#${esc(t)}</button>`).join('')}`},
  renderEditor(){const n=this.note;const has=n&&(!n.deleted||this.view==='trash');
    $('#nPaper').style.visibility=n?'':'hidden';
    if(!n){$('#nBar').innerHTML='<button class="ib nback" data-nb="back">'+svg('back')+'</button>';return}
    if(nEd.dataset.id!==n.id){nEd.innerHTML=n.html||'';nTitle.value=n.title||'';nEd.dataset.id=n.id}
    const ro=n.deleted;nEd.contentEditable=ro?'false':'true';nTitle.readOnly=ro;
    const nb=(k,ic,t,on)=>`<button class="ib${on?' on':''}" data-nb="${k}" title="${t}">${svg(ic)}</button>`;
    $('#nBar').innerHTML=nb('back','back','Voltar à lista').replace('class="ib','class="ib nback')+(ro?`<span class="small" style="padding:0 8px">Nota na lixeira</span><button class="tb" data-nb="restore">${svg('restore')}Restaurar</button><button class="tb danger" data-nb="purge">Excluir definitivamente</button>`:
      `<select class="sel" id="nFmt" title="Formato"><option value="">Formato</option><option value="h2">Título</option><option value="h3">Subtítulo</option><option value="p">Corpo</option><option value="blockquote">Citação</option><option value="pre">Monoespaçado</option></select>`+
      nb('bold','bold','Negrito')+nb('italic','italic','Itálico')+nb('underline','under','Sublinhado')+nb('strikeThrough','strike','Tachado')+
      nb('check','check','Lista de tarefas')+nb('ul','ul','Marcadores')+nb('ol','ol','Numeração')+nb('table','table','Tabela')+nb('img','img','Imagem')+nb('link','link','Link')+
      `<span style="width:1px;height:20px;background:var(--line);margin:0 4px"></span>`+
      Object.keys(NCOL).map(c=>`<span class="cdot${(n.color||'')===c?' on':''}" data-col="${c}" title="Cor" style="background:${c?NCOL[c]:'var(--panel)'};${c?'':'background-image:linear-gradient(135deg,transparent 45%,var(--muted) 45%,var(--muted) 55%,transparent 55%)'}"></span>`).join('')+
      `<span style="flex:1"></span>`+nb('pin','pin',n.pinned?'Desafixar':'Fixar',n.pinned)+
      `<select class="sel" id="nFolder" title="Pasta" style="max-width:130px"><option value="">Sem pasta</option>${S.folders.map(f=>`<option ${n.folder===f?'selected':''}>${esc(f)}</option>`).join('')}</select>`+
      `<button class="tb" data-nb="todoc" title="Criar documento a partir desta nota">${svg('doc')}<span class="lbl">Virar documento</span></button>`+
      `<button class="tb" data-nb="todocins" title="Inserir no documento aberto"${D?'':' disabled'}>${svg('plus')}<span class="lbl">No documento</span></button>`+
      `<button class="ib" data-nb="ai" title="Assistente">${svg('ai')}</button>`+nb('trash','trash','Mover para a lixeira'));
    const f=$('#nFmt');if(f)f.onchange=()=>{this.restore();document.execCommand('formatBlock',false,'<'+f.value+'>');f.value='';this.dirty()};
    const fo=$('#nFolder');if(fo)fo.onchange=()=>{n.folder=fo.value;n.updatedAt=now();persistLocal();Cloud.put('n',n);this.renderFolders();this.renderList()};
    this.renderMeta()},
  restore(){if(document.activeElement!==nEd)nEd.focus({preventScroll:true});if(this.lastRange&&nEd.contains(this.lastRange.startContainer)){const s=getSelection();s.removeAllRanges();s.addRange(this.lastRange)}},
  dirty(){this._dirty=true;setSync('busy','Salvando…');this.saveD()},
  saveD:debounce(()=>{NOTES.flush();setSync(Cloud.on?'ok':'ok',Cloud.on?'Sincronizado':'Salvo neste navegador')},500),
  async cmd(k){const n=this.note;if(!n)return;
    if(['bold','italic','underline','strikeThrough'].includes(k)){this.restore();document.execCommand(k);return this.dirty()}
    if(k==='ul'||k==='ol'){this.restore();document.execCommand(k==='ul'?'insertUnorderedList':'insertOrderedList');return this.dirty()}
    if(k==='check'){this.restore();const ul0=closestIn(getSelection().anchorNode,'ul',nEd);if(ul0&&ul0.classList.contains('check')){ul0.classList.remove('check')}else{if(!ul0)document.execCommand('insertUnorderedList');const u=closestIn(getSelection().anchorNode,'ul',nEd);u&&u.classList.add('check')}return this.dirty()}
    if(k==='table'){this.restore();document.execCommand('insertHTML',false,'<table><tbody>'+'<tr><td><br></td><td><br></td><td><br></td></tr>'.repeat(3)+'</tbody></table><p><br></p>');return this.dirty()}
    if(k==='link'){const u=await ask('Link','Endereço','https://');if(u){this.restore();const s=getSelection();if(s.isCollapsed)document.execCommand('insertHTML',false,`<a href="${esc(u)}">${esc(u)}</a>`);else document.execCommand('createLink',false,u);this.dirty()}return}
    if(k==='img'){const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=async()=>{const f=inp.files[0];if(!f)return;let url=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)});if(f.size>300000)url=await downscale(url,1200);this.restore();document.execCommand('insertHTML',false,`<p><img src="${url}" alt=""></p>`);this.dirty()};inp.click();return}
    if(k==='pin'){n.pinned=!n.pinned;n.updatedAt=now();persistLocal();Cloud.put('n',n);this.render();return}
    if(k==='trash'){n.deleted=true;n.deletedAt=now();n.updatedAt=now();persistLocal();Cloud.put('n',n);this.cur=null;$('#notes').classList.remove('editing');this.render();toast('Nota movida para a lixeira');return}
    if(k==='restore'){n.deleted=false;n.updatedAt=now();persistLocal();Cloud.put('n',n);this.render();toast('Nota restaurada');return}
    if(k==='purge'){if(await confirmDlg('Excluir nota','Esta nota será excluída definitivamente.')){delete S.notes[n.id];Cloud.remove('n',n.id);persistLocal();this.cur=null;this.render()}return}
    if(k==='back'){this.flush();$('#notes').classList.remove('editing');return}
    if(k==='todoc'){this.flush();const d=createDoc({title:this.tt(n),html:`<h1>${esc(this.tt(n))}</h1>`+(n.html||'<p><br></p>')});n.docId=d.id;persistLocal();Cloud.put('n',n);toast('Documento criado a partir da nota');return}
    if(k==='todocins'){if(!D)return;this.flush();setMode('docs');showHome(false);insertNote(n.id);return}
    if(k==='ai'){const b=$('[data-nb="ai"]');menu(b,[{label:'Resumir nota',run:()=>this.ai('Resuma esta nota em poucos tópicos objetivos.')},{label:'Transformar em lista de tarefas',run:()=>this.ai('Transforme o conteúdo em uma lista de tarefas acionáveis. Use <ul class="check"><li>…</li></ul>.')},{label:'Organizar e corrigir',run:()=>this.ai('Organize a nota com subtítulos curtos e corrija a escrita, sem mudar o conteúdo.')},{label:'Expandir em rascunho de documento',run:()=>this.ai('Desenvolva a nota num rascunho de documento estruturado, com título e seções. Não invente dados; use [a confirmar] onde faltar.',true)}]);return}
  },
  async ai(instr,asDoc){const s=await getSample();if(!s)return toast('O assistente funciona quando a página está aberta no Claude.',3500);this.flush();const n=this.note;
    toast('Gerando…',8000);try{const r=await s(`Você é o assistente de notas do GPlanSiS|Writer.\nTarefa: ${instr}\nResponda SOMENTE com HTML simples (p, h2, h3, ul, ol, li, strong, em, table). Português do Brasil. Não invente fatos.\n\nTítulo: ${this.tt(n)}\nNota (HTML):\n<<<\n${n.html}\n>>>`,{modelTier:'default',cache:false});
      const html=sanitize(clean(r.text)).replace(/<ul>(?=(?:(?!<\/ul>).)*?<li)/,m=>m);
      if(asDoc){createDoc({title:this.tt(n),html});n.docId=D.id;persistLocal();Cloud.put('n',n)}
      else{const v=await modal({title:'Resultado do assistente',wide:true,body:`<div style="border:1px solid var(--line);border-radius:7px;padding:10px;max-height:55vh;overflow:auto" class="nprev">${html}</div>`,buttons:[{label:'Descartar'},{label:'Adicionar ao fim',value:()=>'add'},{label:'Substituir nota',primary:true,value:()=>'rep'}]});
        if(v==='rep'||v==='add'){nEd.innerHTML=v==='rep'?html:nEd.innerHTML+'<hr>'+html;this.dirty()}}
      toast('Pronto')}catch(e){toast(e&&e.code==='not_granted'?'Permissão para o assistente não concedida.':'Não foi possível gerar.',3000)}},
  async quick(){const r=lastRange&&!lastRange.collapsed&&mode==='docs'&&D?lastRange.toString():'';
    const v=await modal({title:'Nota rápida',body:`<input class="inp" id="qnT" placeholder="Título (opcional)" style="margin-bottom:8px"><textarea class="inp" id="qnB" rows="6" placeholder="Escreva. #etiquetas funcionam aqui.">${esc(r)}</textarea><div class="qn" style="margin-top:8px"><select class="inp" id="qnF"><option value="">Sem pasta</option>${S.folders.map(f=>`<option>${esc(f)}</option>`).join('')}</select></div>${D&&mode==='docs'?`<label class="small"><input type="checkbox" id="qnL" checked> Ligar ao documento “${esc(D.title)}”</label>`:''}`,
      buttons:[{label:'Cancelar'},{label:'Salvar nota',primary:true,value:sc=>({t:$('#qnT',sc).value,b:$('#qnB',sc).value,f:$('#qnF',sc).value,l:$('#qnL',sc)?.checked})}]});
    if(!v||!v.b&&!v.t)return;const html=esc(v.b).split(/\n{2,}/).map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
    const prevMode=mode;mode='x';this.create({title:v.t,html,folder:v.f,docId:v.l&&D?D.id:null});mode=prevMode;if(mode==='notes')this.render();toast('Nota salva')},
  renderSide(b){const q=(this._sq||'').toLowerCase();const live=this.list().filter(n=>!n.deleted&&(!q||(this.tt(n)+' '+textOf(n.html)).toLowerCase().includes(q))).sort((a,b)=>b.updatedAt-a.updatedAt);
    const mine=D?live.filter(n=>n.docId===D.id):[];const other=live.filter(n=>!D||n.docId!==D.id).slice(0,40);
    const card=n=>`<div class="card" data-sn="${n.id}" draggable="true" style="border-left:3px solid ${NCOL[n.color||'']==='transparent'?'var(--line)':NCOL[n.color]}"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.pinned?'📌 ':''}${esc(this.tt(n))}</div><div class="small" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(textOf(n.html).replace(/\s+/g,' ').slice(0,200))}</div><div class="acts"><button data-sa="ins">Inserir aqui</button><button data-sa="open">Abrir</button>${D&&n.docId!==D.id?'<button data-sa="link">Ligar a este doc</button>':''}</div></div>`;
    b.innerHTML=`<div style="display:flex;gap:4px;margin-bottom:8px"><button class="tb primary" id="snSel" style="flex:1">${svg('tonote')}Seleção → nota</button><button class="tb" id="snQ">${svg('plus')}Nota rápida</button></div><input class="inp" id="snQ2" placeholder="Buscar notas" value="${esc(this._sq||'')}" style="margin-bottom:8px">
      <div class="small" style="margin-bottom:6px">Arraste uma nota para o texto ou use “Inserir aqui”.</div>
      ${D?`<div class="small" style="font-weight:500;margin:8px 0 6px;color:var(--text)">Deste documento (${mine.length})</div>${mine.map(card).join('')||'<div class="small" style="margin-bottom:8px">Nenhuma nota ligada ainda.</div>'}`:''}
      <div class="small" style="font-weight:500;margin:10px 0 6px;color:var(--text)">Outras notas</div>${other.map(card).join('')||'<div class="small">Sem notas.</div>'}`;
    $('#snSel').onmousedown=e=>e.preventDefault();$('#snSel').onclick=selToNote;$('#snQ').onclick=()=>this.quick();
    const i2=$('#snQ2');i2.oninput=()=>{this._sq=i2.value;this.renderSide(b);const n=$('#snQ2');n.focus();n.setSelectionRange(n.value.length,n.value.length)};
    b.onmousedown=e=>{if(e.target.closest('[data-sa]'))e.preventDefault()};
    b.onclick=e=>{const c=e.target.closest('[data-sn]');const a=e.target.dataset.sa;if(!c||!a)return;const id=c.dataset.sn;
      if(a==='ins')insertNote(id);if(a==='open'){setMode('notes');this.view='all';this.open(id)}
      if(a==='link'){const n=S.notes[id];n.docId=D.id;n.updatedAt=now();persistLocal();Cloud.put('n',n);this.renderSide(b)}};
    b.ondragstart=e=>{const c=e.target.closest('[data-sn]');if(!c)return;e.dataTransfer.setData('application/x-gpw-note',c.dataset.sn);e.dataTransfer.setData('text/plain',this.tt(S.notes[c.dataset.sn]));e.dataTransfer.effectAllowed='copy'}},
  exportMenu(anchor){const n=this.note;const items=[];
    if(n){items.push({label:'Nota em Markdown (.md)',icon:'lines',run:()=>{this.flush();const d=document.createElement('div');d.innerHTML=(n.title?`<h1>${esc(n.title)}</h1>`:'')+n.html;saveBlob(safeName(this.tt(n))+'.md',htmlToMd(d),'text/markdown')}},
      {label:'Nota em texto (.txt)',icon:'al',run:()=>{this.flush();const d=document.createElement('div');d.innerHTML=n.html.replace(/<\/(p|h\d|li|tr)>/g,'$&\n').replace(/<br>/g,'\n');saveBlob(safeName(this.tt(n))+'.txt',(n.title?n.title+'\n\n':'')+d.textContent,'text/plain')}},
      {label:'Nota como documento',icon:'doc',run:()=>this.cmd('todoc')},'-')}
    items.push({label:'Todas as notas em Markdown (.md)',icon:'lines',run:()=>{this.flush();const all=this.list().filter(x=>!x.deleted).sort((a,b)=>b.updatedAt-a.updatedAt);const d=document.createElement('div');
      saveBlob('notas.md',all.map(x=>{d.innerHTML=x.html;return`# ${this.tt(x)}\n\n_${new Date(x.updatedAt).toLocaleString('pt-BR')}${x.folder?' · '+x.folder:''}_\n\n`+htmlToMd(d)}).join('\n---\n\n'),'text/markdown')}},
      {label:'Importar arquivo como nota…',icon:'open',run:()=>$('#fileIn').click()},{label:'Backup completo (.json)',icon:'dup',run:backupAll});menu(anchor,items)}
};
function extractTags(h){const t=textOf(h);const s=new Set();for(const m of t.matchAll(/(^|[\s(])#([\p{L}\p{N}_\-]{2,30})/gu))s.add(m[2].toLowerCase());return[...s]}
function insertNote(id){const n=S.notes[id];if(!n||!D)return;if(D.locked)return toast('Documento protegido');const t=NOTES.tt(n);
  const html=`<h3>${esc(t)}</h3>`+sanitizeKeep(n.html||'<p><br></p>');insertHTML(html);if(!n.docId){n.docId=D.id;n.updatedAt=now();persistLocal();Cloud.put('n',n)}toast('Nota inserida: '+t);if(sideMode==='notes')refreshPanels()}
function sanitizeKeep(h){const d=document.createElement('div');d.innerHTML=h;const checks=[...d.querySelectorAll('ul.check')].map(u=>[...u.children].map(li=>li.classList.contains('done')));let out=sanitize(h);const d2=document.createElement('div');d2.innerHTML=out;
  const uls=[...d2.querySelectorAll('ul')];let k=0;d.querySelectorAll('ul').forEach((u,i)=>{if(u.classList.contains('check')&&uls[i]){uls[i].classList.add('check');[...uls[i].children].forEach((li,j)=>{if(checks[k]&&checks[k][j])li.classList.add('done')});k++}});return d2.innerHTML}
function selToNote(){if(!D)return;const r=lastRange;if(!r||r.collapsed)return toast('Selecione um trecho do documento');const d=document.createElement('div');d.appendChild(r.cloneContents());d.querySelectorAll('del,.pgsp,.toc').forEach(e=>e.remove());
  const t=r.toString().trim().split(/\n/)[0].slice(0,60);const prev=mode;mode='x';NOTES.create({title:t,html:sanitizeKeep(d.innerHTML),docId:D.id});mode=prev;toast('Nota criada a partir da seleção');if(sideMode==='notes')refreshPanels()}

/* eventos do módulo de notas */
$('#nFold').addEventListener('click',async e=>{const fm=e.target.closest('[data-fm]');if(fm){e.stopPropagation();const f=fm.dataset.fm;
    menu(fm,[{label:'Renomear pasta',run:async()=>{const v=(await ask('Renomear pasta','Nome',f)||'').trim();if(!v||v===f)return;if(S.folders.includes(v))return toast('Já existe uma pasta com esse nome');S.folders=S.folders.map(x=>x===f?v:x);Object.values(S.notes).forEach(n=>{if(n.folder===f){n.folder=v;n.updatedAt=now();Cloud.put('n',n)}});if(NOTES.view==='f:'+f)NOTES.view='f:'+v;persistLocal();Cloud.meta();NOTES.render()}},
      {label:'Excluir pasta (as notas ficam sem pasta)',run:async()=>{if(!await confirmDlg('Excluir pasta',`A pasta “${f}” será removida. As notas continuam em Todas as notas.`))return;S.folders=S.folders.filter(x=>x!==f);Object.values(S.notes).forEach(n=>{if(n.folder===f){n.folder='';n.updatedAt=now();Cloud.put('n',n)}});if(NOTES.view==='f:'+f)NOTES.view='all';persistLocal();Cloud.meta();NOTES.render()}}]);return}
  if(e.target.id==='nAddF'){const v=(await ask('Nova pasta','Nome da pasta')||'').trim();if(v&&!S.folders.includes(v)){S.folders.push(v);persistLocal();Cloud.meta();NOTES.view='f:'+v;NOTES.render()}return}
  const r=e.target.closest('[data-v]');if(r){NOTES.view=r.dataset.v;$('#nFold').classList.remove('show');NOTES.renderFolders();NOTES.renderList()}});
$('#nFold').addEventListener('dragover',e=>{if(e.target.closest('[data-v^="f:"],[data-v="trash"],[data-v="all"]'))e.preventDefault()});
$('#nFold').addEventListener('drop',e=>{const r=e.target.closest('[data-v]');const id=e.dataTransfer.getData('application/x-gpw-note');const n=S.notes[id];if(!r||!n)return;e.preventDefault();const v=r.dataset.v;
  if(v==='trash'){n.deleted=true;n.deletedAt=now()}else if(v==='all'){n.folder=''}else{n.folder=v.slice(2);n.deleted=false}n.updatedAt=now();persistLocal();Cloud.put('n',n);NOTES.render()});
$('#nItems').addEventListener('click',e=>{if(e.target.closest('[data-newn]'))return NOTES.create();if(e.target.id==='nEmpty'){confirmDlg('Esvaziar lixeira','Todas as notas da lixeira serão excluídas definitivamente.').then(ok=>{if(!ok)return;Object.values(S.notes).filter(n=>n.deleted).forEach(n=>{delete S.notes[n.id];Cloud.remove('n',n.id)});persistLocal();NOTES.cur=null;NOTES.render()});return}
  const it=e.target.closest('[data-n]');if(it)NOTES.open(it.dataset.n)});
$('#nItems').addEventListener('dragstart',e=>{const it=e.target.closest('[data-n]');if(it){e.dataTransfer.setData('application/x-gpw-note',it.dataset.n);e.dataTransfer.effectAllowed='move'}});
$('#nItems').addEventListener('contextmenu',e=>{const it=e.target.closest('[data-n]');if(!it)return;e.preventDefault();const n=S.notes[it.dataset.n];
  menu(it,[{label:n.pinned?'Desafixar':'Fixar',icon:'pin',run:()=>{n.pinned=!n.pinned;n.updatedAt=now();persistLocal();Cloud.put('n',n);NOTES.render()}},{label:'Duplicar',icon:'dup',run:()=>{const c={...n,id:uid(),title:NOTES.tt(n)+' (cópia)',createdAt:now(),updatedAt:now(),pinned:false};S.notes[c.id]=c;persistLocal();Cloud.put('n',c);NOTES.render()}},{label:'Virar documento',icon:'doc',run:()=>{NOTES.cur=n.id;NOTES.cmd('todoc')}},'-',{label:'Mover para a lixeira',icon:'trash',run:()=>{n.deleted=true;n.updatedAt=now();persistLocal();Cloud.put('n',n);if(NOTES.cur===n.id)NOTES.cur=null;NOTES.render()}}])});
$('#nNew').onclick=()=>NOTES.create();
$('#nFoldBtn').onclick=()=>$('#nFold').classList.toggle('show');
$('#nSearch').oninput=e=>{NOTES.q=e.target.value;NOTES.renderList()};
$('#nSort').onchange=()=>NOTES.renderList();
$('#nBar').addEventListener('mousedown',e=>{if(e.target.closest('[data-nb],.cdot'))e.preventDefault()});
$('#nBar').addEventListener('click',e=>{const c=e.target.closest('.cdot');if(c){const n=NOTES.note;n.color=c.dataset.col;n.updatedAt=now();persistLocal();Cloud.put('n',n);NOTES.renderEditor();NOTES.renderList();return}
  const b=e.target.closest('[data-nb]');if(b)NOTES.cmd(b.dataset.nb)});
$('#nMeta').addEventListener('click',e=>{const d=e.target.closest('[data-opendoc]');if(d){NOTES.flush();openDoc(d.dataset.opendoc);return}const t=e.target.closest('[data-tagv]');if(t){NOTES.view='t:'+t.dataset.tagv;NOTES.render()}});
nEd.addEventListener('input',()=>NOTES.dirty());nTitle.addEventListener('input',()=>NOTES.dirty());
nTitle.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();nEd.focus()}});
nEd.addEventListener('click',e=>{const li=e.target.closest('ul.check>li');if(li){const r=li.getBoundingClientRect();if(e.clientX-r.left<24){li.classList.toggle('done');NOTES.dirty();e.preventDefault()}}const a=e.target.closest('a[href]');if(a&&(e.ctrlKey||e.metaKey))window.open(a.href,'_blank','noopener')});
nEd.addEventListener('paste',e=>{const cd=e.clipboardData;if(!cd)return;const h=cd.getData('text/html');if(!h)return;e.preventDefault();document.execCommand('insertHTML',false,sanitize(h))});
/* atalhos de digitação estilo markdown */
nEd.addEventListener('keydown',e=>{if(e.key!==' ')return;const s=getSelection();if(!s.isCollapsed)return;const n=s.anchorNode;if(!n||n.nodeType!==3)return;const blk=closestIn(n,'p,div,h2,h3,li',nEd)||nEd;
  const before=n.nodeValue.slice(0,s.anchorOffset);if(blk.firstChild!==n&&blk!==nEd)return;
  const map={'-':'ul','*':'ul','1.':'ol','[]':'check','#':'h2','##':'h3','>':'blockquote'};const k=before.trim();if(!(k in map)||before!==k)return;
  e.preventDefault();n.nodeValue=n.nodeValue.slice(s.anchorOffset);const r=document.createRange();r.setStart(n,0);r.collapse(true);s.removeAllRanges();s.addRange(r);NOTES.lastRange=r;
  const v=map[k];if(v==='ul'||v==='ol'||v==='check')NOTES.cmd(v);else{document.execCommand('formatBlock',false,'<'+v+'>');NOTES.dirty()}});

/* ================= início ================= */
function boot(){
  renderTabs();renderTools();setView('print');
  const last=S.settings.lastDoc&&S.docs[S.settings.lastDoc];
  if(last)openDoc(last.id);else{setMode('docs');showHome(true)}
  if(innerWidth<900&&D)fitWidth();
  if(S.settings.lastNote&&S.notes[S.settings.lastNote])NOTES.cur=S.settings.lastNote;
  setSync('ok','Salvo neste navegador');
  Cloud.init();
  addEventListener('beforeunload',()=>{flushSave();NOTES.flush()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){flushSave();NOTES.flush()}});
  window.__w={S,get D(){return D},layoutNow,NOTES,exportHTMLbody,htmlToMd,mdToHtml};
}
// [servidor] boot() é chamado por plataforma.js depois do login
