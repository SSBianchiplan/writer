/* GPlanSiS|Writer — camada de plataforma sobre o editor (writer.js).
   Acesso por login, documentos e notas guardados no servidor (versões, lixeira, compartilhamento,
   trava de edição), permissões por usuário e modo Configurações com avatar.
   O editor continua o mesmo: aqui se troca a sincronização (objeto Cloud), se embrulham as funções
   globais que gravam, abrem, exportam e importam, e se acrescenta a conta.
   Cópia local por usuário (localStorage `gpw:v1:u<id>`): o que não chegou ao servidor fica marcado
   em S.srv.pend e é reenviado a cada sincronização — uma queda de rede não perde nada. */
'use strict';
{ // escopo próprio: nada daqui colide com os nomes globais do editor

const P={me:null,iniciado:false,cfgAba:'perfil',enviando:false,denovo:false,timer:null,filtro:'todos',
  trava:{id:null,timer:null,outro:null,forcado:new Set()},lixeira:0};

/* ---------------- utilidades ---------------- */
async function api(method,path,body){
  const h={'x-writer':'1'};if(body!==undefined)h['content-type']='application/json';
  let r;try{r=await fetch(path,{method,headers:h,body:body!==undefined?JSON.stringify(body):undefined,credentials:'same-origin'})}
  catch(_){const e=new Error('Sem conexão com o servidor');e.status=0;throw e}
  let j=null;try{j=await r.json()}catch(_){}
  if(!r.ok){const d=j&&j.detail;const e=new Error(typeof d==='string'?d:Array.isArray(d)?d.map(x=>x.msg).join('; '):`Erro ${r.status}`);e.status=r.status;e.body=j;
    if(r.status===401&&!/^\/api\/auth\/(login|me)$/.test(path))sessaoExpirada();throw e}
  return j}
const can=p=>!!(P.me&&P.me.permissoesEfetivas.includes(p));
const isAdmin=()=>!!(P.me&&P.me.papel==='ADMIN');
const iniciais=n=>String(n||'?').replace(/@.*/,'').split(/[\s._-]+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('')||'?';
function av(u,cls=''){return `<span class="pl-av ${cls}" aria-hidden="true">${u&&u.temAvatar?`<img alt="" src="/api/avatar/${u.id}?v=${u.avatarVer}">`:esc(iniciais(u&&(u.nome||u.login)))}</span>`}
function quando(iso){if(!iso)return '—';const d=new Date(iso),s=(Date.now()-d)/1000;
  if(s<60)return 'agora';if(s<3600)return `há ${Math.floor(s/60)} min`;if(s<86400)return `há ${Math.floor(s/3600)} h`;if(s<7*86400)return `há ${Math.floor(s/86400)} d`;
  return d.toLocaleDateString('pt-BR')}
const dataHora=iso=>iso?new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const tamanho=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1).replace('.',',')+' MB';
const papelNome=p=>(P.me&&P.me.papelRotulo&&P.me.papelRotulo[p])||p;
const NIVEL={DONO:'dono',EDITAR:'edição',LER:'leitura'};
function navegador(ua){ua=ua||'';const b=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Navegador';
  const o=/iPhone|iPad/.test(ua)?'iOS':/Android/.test(ua)?'Android':/Mac OS X/.test(ua)?'macOS':/Windows/.test(ua)?'Windows':/Linux/.test(ua)?'Linux':'';return o?`${b} · ${o}`:b}
const IC={
  doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  sliders:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/>',
  files:'<path d="M8 3h7l4 4v11H8z"/><path d="M15 3v4h4M5 7v14h11"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  out:'<path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  sun:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 000 16z" fill="currentColor"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  share:'<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  hist:'<path d="M4 12a8 8 0 108-8 8 8 0 00-6.6 3.5M4 4v4h4M12 8v4l3 2"/>',
  spark:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>'};
const ico=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* Diálogo sobre o modal() do editor. Botão com keep:true não fecha sozinho; fn pode chamar J.fecha(). */
const J={fecha:()=>{}};
function janela(title,html,btns=[],o={}){
  return modal({title,body:html,wide:!!o.wide,buttons:btns.map(b=>({label:b.label,primary:b.primary,danger:b.danger,
    value:sc=>{try{const r=b.fn&&b.fn(sc);if(r&&r.catch)r.catch(e=>toast(e.message))}catch(e){toast(e.message)}return b.keep?false:true}})),
    onOpen:(sc,done)=>{J.fecha=()=>done(null);o.onOpen&&o.onOpen(sc)}})}

/* ---------------- preferências ---------------- */
let _pt=0;
const setMe=me=>{P.me=Object.assign(me,{prefs:P.me?P.me.prefs:me.prefs});return P.me};
function salvaPrefs(p){P.me.prefs=Object.assign({},P.me.prefs,p);clearTimeout(_pt);_pt=setTimeout(()=>api('PATCH','/api/perfil',{prefs:P.me.prefs}).catch(()=>{}),600)}
function aplicaTema(t){S.settings.theme=t==='claro'?'light':t==='escuro'?'dark':'';applyTheme();
  try{S.settings.theme?localStorage.setItem('gpw:theme',S.settings.theme):localStorage.removeItem('gpw:theme')}catch(_){}}
// o botão de tema do editor alterna S.settings.theme; aqui a escolha vai para a conta
$('#bTheme').addEventListener('click',()=>{if(!P.me)return;const t=S.settings.theme==='dark'?'escuro':'claro';aplicaTema(t);salvaPrefs({tema:t})});

/* ---------------- portão de acesso ---------------- */
function gate(modo,msg){const g=$('#plGate');g.hidden=false;$('#plGateLoad').hidden=modo!=='load';$('#plLogin').hidden=modo!=='login';$('#plTroca').hidden=modo!=='troca';
  if(modo==='login'){$('#plLgErr').textContent=msg||'';setTimeout(()=>($('#plLgUser').value?$('#plLgPass'):$('#plLgUser')).focus(),50)}
  if(modo==='troca'){$('#plTrErr').textContent=msg||'';$('#plGateSub').textContent=`Olá, ${P.me.nome.split(' ')[0]}.`;setTimeout(()=>$('#plTrAtual').focus(),50)}
  if(modo==='load'&&msg){$('#plGateLoad').innerHTML=msg}}
$('#plLogin').addEventListener('submit',async e=>{e.preventDefault();const b=$('#plLgBtn');b.disabled=true;b.textContent='Entrando…';
  try{const me=await api('POST','/api/auth/login',{login:$('#plLgUser').value,senha:$('#plLgPass').value});$('#plLgPass').value='';entrou(me)}
  catch(err){$('#plLgErr').textContent=err.message}finally{b.disabled=false;b.textContent='Entrar'}});
$('#plTroca').addEventListener('submit',async e=>{e.preventDefault();const n=$('#plTrNova').value;
  if(n!==$('#plTrNova2').value){$('#plTrErr').textContent='As duas senhas novas não conferem';return}
  try{const me=await api('POST','/api/auth/senha',{atual:$('#plTrAtual').value,nova:n});$('#plTroca').reset();entrou(me);toast('Senha definida. Bem-vindo!')}
  catch(err){$('#plTrErr').textContent=err.message}});
$('#plTrSair').onclick=()=>sair(true);
function sessaoExpirada(){if(!$('#plGate').hidden)return;gate('login','Sua sessão expirou. Entre novamente — o que você escreveu continua guardado neste navegador.')}

function entrou(me){
  if(P.me&&P.me.id!==me.id&&P.iniciado){location.reload();return}
  if(P.me&&P.me.id===me.id)setMe(me);else P.me=me;
  if(me.trocarSenha){gate('troca');return}
  $('#plGate').hidden=true;$('#plGateSub').textContent='Documentos e notas da equipe';
  pintaConta();aplicaPermissoes();
  if(!P.iniciado){P.iniciado=true;preparaLocal();aplicaTema(me.prefs.tema);boot();aplicaPermissoes();agendaEdms();aplicaIdioma()}
  else{reenfileira();sincroniza()}}

async function inicio(){gate('load');
  // entrada vinda do GPlanSiS|Docs: ?sso=<código assinado> vira sessão aqui, sem pedir senha
  const sso=new URLSearchParams(location.search).get('sso');
  if(sso){history.replaceState(null,'',location.pathname+location.hash);
    try{const me=await api('POST','/api/auth/sso',{token:sso});if(me.para&&/^#w[A-Za-z0-9_-]+$/.test(me.para))history.replaceState(null,'',location.pathname+me.para);entrou(me);return}
    catch(e){gate('login','Entrada pelo GPlanSiS|Docs: '+e.message);return}}
  try{entrou(await api('GET','/api/auth/me'))}
  catch(e){if(e.status===401)gate('login');
    else{gate('load',`<p class="pl-err">Servidor indisponível (${esc(e.message)}).</p><button class="tb" id="plRetry">Tentar de novo</button>`);$('#plRetry').onclick=inicio}}}

/* ---------------- cópia local por usuário ---------------- */
const LEGADO='gpw:v1';
function preparaLocal(){
  LS=`gpw:v1:u${P.me.id}`;
  const base={docs:{},notes:{},folders:['Projetos','Reuniões','Ideias'],settings:{author:'',theme:'',lastDoc:null,lastNote:null}};
  let o=null;try{o=JSON.parse(localStorage.getItem(LS)||'null')}catch(_){}
  S=o?{...base,...o,settings:{...base.settings,...(o.settings||{})}}:base;
  S.srv=Object.assign({pend:{},del:{}},S.srv||{});
  S.settings.author=P.me.nome;
  if(S.settings.lastDoc&&!S.docs[S.settings.lastDoc])S.settings.lastDoc=null;
}
const pendentes=()=>Object.keys(S.srv.pend).length+Object.keys(S.srv.del).length;

/* ---------------- sincronização com o servidor (substitui o Cloud do editor) ---------------- */
const CAB=['_v','_nivel','_equipe','_por','_em','_dono','_conv'];
function aplicaCab(d,h){d._v=h.v;d._nivel=h.nivel;d._equipe=h.equipe;d._por=h.por;d._em=h.em;if(h.dono&&h.dono.nome)d._dono=h.dono;if(h.conv!=null)d._conv=h.conv}
const meu=d=>!d._dono||d._dono.id===P.me.id;
const editandoAgora=id=>D&&D.id===id&&(saveT||D._dirty);

Object.assign(Cloud,{
  async init(){this.on=true;setSync('busy','Sincronizando…');await sincroniza(true);
    clearInterval(P.timer);P.timer=setInterval(()=>{if(!document.hidden){reenfileira();sincroniza()}},20000);
    addEventListener('online',()=>{reenfileira();sincroniza()});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){reenfileira();sincroniza()}});
    posSync()},
  put(kind,obj){if(!P.me||!obj)return;
    if(kind==='d'){const d=S.docs[obj.id];if(!d||roMotivo(d))return}
    if(kind==='n'&&!can('notas'))return;
    const k=kind+'_'+obj.id;S.srv.pend[k]=1;this.pend.set(k,1);persistLocalD();this.flush()},
  meta(){if(!P.me||!can('notas'))return;S.metaAt=now();S.srv.pend.meta=1;this.pend.set('meta',1);persistLocalD();this.flush()},
  remove(kind,id){const k=kind+'_'+id;delete S.srv.pend[k];this.pend.delete(k);
    if(kind==='d'&&!P.lixo)return;   // documentos só saem pelo fluxo da lixeira (ver exclusão na tela inicial)
    S.srv.del[k]=1;persistLocalD();apaga(k)},
  flush:debounce(()=>envia(),900)
});
function reenfileira(){for(const k of Object.keys(S.srv.pend))Cloud.pend.set(k,1);if(Cloud.pend.size)Cloud.flush();for(const k of Object.keys(S.srv.del))apaga(k)}
async function apaga(k){const kind=k[0],id=k.slice(2);
  try{await api('DELETE',kind==='n'?`/api/notas/${encodeURIComponent(id)}`:`/api/docs/${encodeURIComponent(id)}`);delete S.srv.del[k]}
  catch(e){if(e.status===404||e.status===403){delete S.srv.del[k];if(e.status===403){toast(e.message);sincroniza()}}}
  persistLocalD()}

async function envia(){
  if(P.enviando){P.denovo=true;return}P.enviando=true;let falha=0,ro=0;
  try{
    const itens=[...Cloud.pend.keys()];Cloud.pend.clear();
    for(const k of itens){
      try{
        if(k==='meta'){await api('PUT','/api/pastas',{lista:S.folders,ms:S.metaAt||now()});delete S.srv.pend.meta;continue}
        const kind=k[0],id=k.slice(2);
        if(kind==='n'){const n=S.notes[id];if(!n){delete S.srv.pend[k];continue}
          await api('PUT',`/api/notas/${encodeURIComponent(id)}`,{nota:n});n._s=1;if(!Cloud.pend.has(k))delete S.srv.pend[k];continue}
        const d=S.docs[id];if(!d){delete S.srv.pend[k];continue}
        if(roMotivo(d)){delete S.srv.pend[k];continue}
        const r=await api('PUT',`/api/docs/${encodeURIComponent(id)}`,{versaoBase:d._v||0,doc:d});
        aplicaCab(d,r.doc);if(!Cloud.pend.has(k))delete S.srv.pend[k];Cloud.tooBig.delete(k);
        if(D===d)pintaDoc();
      }catch(e){
        const b=e.body||{};
        if(e.status===409&&b.detail==='id_em_uso')novoId(k.slice(2));
        else if(e.status===409&&b.detail==='conflito')conflito(k.slice(2),b);
        else if(e.status===413){Cloud.tooBig.add(k);toast(e.message,5000)}
        else if(e.status===403||e.status===404){delete S.srv.pend[k];ro++;toast(e.message,4000)}
        else falha++;   // sem rede ou sessão expirada: continua em S.srv.pend e volta na próxima rodada
      }}
    persistLocal();
    if(Cloud.tooBig.size)setSync('err','Documento grande demais para o servidor — fica salvo neste navegador');
    else if(falha)setSync('err','Sem conexão — salvo neste navegador; envio automático quando voltar');
    else setSync('ok','Sincronizado');
    if(ro)sincroniza();
  }finally{P.enviando=false;if(P.denovo){P.denovo=false;envia()}}}

function semCab(d){const c=JSON.parse(JSON.stringify(d));CAB.forEach(k=>delete c[k]);delete c._dirty;return c}
function novoId(id){const d=S.docs[id];if(!d)return;delete S.docs[id];delete S.srv.pend['d_'+id];
  const n=semCab(d);n.id=uid();S.docs[n.id]=n;if(D===d){D=n;S.settings.lastDoc=n.id}if(S.settings.lastDoc===id)S.settings.lastDoc=n.id;
  Cloud.put('d',n)}
function conflito(id,b){const loc=S.docs[id],srv=b.doc;if(!loc||!srv)return;
  if(loc.html===srv.html&&loc.title===srv.title){aplicaCab(loc,{v:srv._v,nivel:srv._nivel,equipe:srv._equipe,por:srv._por,em:srv._em,dono:srv._dono});delete S.srv.pend['d_'+id];return}
  let copia=null;
  if(can('criar')){copia=semCab(loc);copia.id=uid();copia.title=(loc.title||'Documento')+' (minha versão — conflito)';copia.createdAt=copia.updatedAt=now();S.docs[copia.id]=copia;Cloud.put('d',copia)}
  S.docs[id]=srv;delete S.srv.pend['d_'+id];persistLocal();
  if(D&&D.id===id){D=null;openDoc(id)}if(!$('#home').hidden)renderHome();
  janela('Outra pessoa salvou antes',`<p style="margin-top:0"><b>${esc(b.atualizadoPor||'Outro usuário')}</b> gravou “${esc(srv.title)}” enquanto você editava. A versão do servidor está aberta agora.</p>
    ${copia?`<p>O que você escreveu foi guardado como <b>${esc(copia.title)}</b>. Compare e junte o que precisar.</p>`:'<p class="pl-err">Seu perfil não pode criar documentos, então suas últimas alterações não puderam ser guardadas em separado.</p>'}`,
    [...(copia?[{label:'Abrir minha versão',fn:()=>openDoc(copia.id)}]:[]),{label:'Continuar',primary:true}])}

async function lote(path,ids,chave){const out=[];for(let i=0;i<ids.length;i+=60){const r=await api('POST',path,{ids:ids.slice(i,i+60)});out.push(...r[chave])}return out}
let _sinc=null;
function sincroniza(primeira){if(_sinc)return _sinc;_sinc=(async()=>{try{await _sincroniza(primeira)}catch(e){if(e.status!==401)setSync('err','Sem conexão — salvo neste navegador')}finally{_sinc=null}})();return _sinc}
async function _sincroniza(primeira){
  if(!P.me)return;const r=await api('GET','/api/sync');let mudou=false;
  P.lixeira=r.lixeira;
  {const antes=P.edms&&D?JSON.stringify(P.edms[D.id]||null):null;P.edms=r.edms||{};
   if(D&&antes!==null&&antes!==JSON.stringify(P.edms[D.id]||null))syncEdms(false)}
  // documentos
  const vis=new Map(r.docs.map(h=>[h.id,h])),pedir=[];
  for(const h of r.docs){const l=S.docs[h.id];
    if(S.srv.pend['d_'+h.id]||S.srv.del['d_'+h.id]||editandoAgora(h.id)){if(l&&(l._v||0)>=h.v)aplicaCab(l,h);continue}  // o envio resolve (ou acusa conflito)
    if(!l||(l._v||0)<h.v)pedir.push(h.id);
    else{const antes=l._nivel+'|'+l._equipe+'|'+l._conv;aplicaCab(l,h);if(antes!==l._nivel+'|'+l._equipe+'|'+l._conv)mudou=true}}
  for(const id of Object.keys(S.docs)){if(vis.has(id))continue;const l=S.docs[id];
    if(S.srv.pend['d_'+id]||!l._v){if(can('criar')||l._v){S.srv.pend['d_'+id]=1;Cloud.pend.set('d_'+id,1)}continue}
    delete S.docs[id];mudou=true;if(D&&D.id===id){D=null;toast(`“${l.title}” foi excluído ou deixou de ser compartilhado com você`,5000);showHome(true)}}
  if(pedir.length){for(const d of await lote('/api/docs/lote',pedir,'docs')){if(editandoAgora(d.id))continue;S.docs[d.id]=d;mudou=true}}
  // notas
  if(can('notas')||r.notas.length){
    const nv=new Map(r.notas.map(h=>[h.id,h.ms])),pn=[];
    for(const [id,ms] of nv){const l=S.notes[id];if(S.srv.pend['n_'+id]||S.srv.del['n_'+id])continue;if(!l||(l.updatedAt||0)<ms)pn.push(id);else l._s=1}
    for(const id of Object.keys(S.notes)){if(nv.has(id))continue;const l=S.notes[id];
      if(S.srv.pend['n_'+id]||!l._s){if(can('notas')){S.srv.pend['n_'+id]=1;Cloud.pend.set('n_'+id,1)}continue}
      delete S.notes[id];mudou=true}
    if(pn.length){for(const n of await lote('/api/notas/lote',pn,'notas')){if(NOTES.cur===n.id&&NOTES._dirty)continue;n._s=1;S.notes[n.id]=n;mudou=true}}
    if(r.pastas.ms>(S.metaAt||0)&&!S.srv.pend.meta){S.folders=r.pastas.lista;S.metaAt=r.pastas.ms;mudou=true}
    else if(!r.pastas.ms&&S.metaAt&&can('notas')){S.srv.pend.meta=1;Cloud.pend.set('meta',1)}}
  if(Cloud.pend.size)Cloud.flush();
  persistLocal();
  if(mudou){onCloudMerged()}
  if(D)pintaDoc();if(!$('#home').hidden&&!mudou)pintaRodapeHome();
  if(!Cloud.pend.size&&!pendentes())setSync('ok','Sincronizado')}

/* depois da primeira sincronização: reabrir o último documento num aparelho novo; trazer dados de antes do login */
async function posSync(){
  if(/^#w/.test(location.hash))await abrePorEndereco();
  else if(!D&&P.me.prefs.abrirUltimo!==false){const u=P.me.prefs.ultimoDoc;if(u&&S.docs[u])openDoc(u)}
  let leg=null;try{leg=JSON.parse(localStorage.getItem(LEGADO)||'null')}catch(_){}
  const flag='gpw:legado:u'+P.me.id;let pergunta=true;try{pergunta=!localStorage.getItem(flag)}catch(_){}
  if(!leg||!pergunta||!can('criar'))return;
  const ld=Object.values(leg.docs||{}),ln=Object.values(leg.notes||{});if(!ld.length&&!ln.length)return;
  try{localStorage.setItem(flag,'1')}catch(_){}
  const ok=await confirmDlg('Documentos deste navegador',`Este navegador tem ${ld.length} documento(s) e ${ln.length} nota(s) do Writer usados antes do login. Enviar para a sua conta? Eles continuam também neste navegador.`,'Enviar para a conta');
  if(!ok)return;
  for(const d of ld){if(S.docs[d.id])continue;const c=semCab(d);S.docs[c.id]=c;Cloud.put('d',c)}
  if(can('notas'))for(const n of ln){if(S.notes[n.id])continue;S.notes[n.id]={...n};Cloud.put('n',S.notes[n.id])}
  if(leg.folders&&can('notas')){S.folders=[...new Set([...S.folders,...leg.folders])];Cloud.meta()}
  persistLocal();onCloudMerged();toast('Enviando para a sua conta…')}

/* ---------------- somente leitura e trava de edição ---------------- */
function roMotivo(d){if(!d||!P.me)return null;
  if(d._nivel==='LER')return 'leitura';
  if(!can('editar')&&!(!d._v&&can('criar')))return 'perfil';
  if(P.trava.id===d.id&&P.trava.outro&&!P.trava.forcado.has(d.id))return 'trava';
  return null}
const compartilhado=d=>!!d&&(!meu(d)||!!d._equipe||(d._conv||0)>0);
function pintaDoc(){const chip=$('#plDocChip'),sh=$('#plShareBtn');
  pintaEdms();
  if(!D||!$('#home').hidden||mode!=='docs'){chip.hidden=true;sh.hidden=true;document.body.classList.remove('pl-ro');return}
  const m=roMotivo(D);document.body.classList.toggle('pl-ro',!!m);
  ed.contentEditable=(m||D.locked)?'false':'true';$('#dname').readOnly=!!m;
  sh.hidden=!(meu(D)&&can('compartilhar')&&D._v);
  let h='';
  if(m==='trava')h=`${av(P.trava.outro,'sm')}<span><b>${esc(P.trava.outro.nome.split(' ')[0])}</b> está editando · leitura</span>`;
  else if(!meu(D))h=`${av(D._dono,'sm')}<span>de <b>${esc((D._dono.nome||'').split(' ')[0])}</b> · ${m?'leitura':'edição'}</span>`;
  else if(m==='perfil')h='<span>somente leitura</span>';
  else if(compartilhado(D))h=`<span>${D._equipe?'equipe':''}${D._equipe&&D._conv?' + ':''}${D._conv?D._conv+' pessoa(s)':''}</span>`;
  chip.innerHTML=h;chip.hidden=!h;chip.className='pl-docchip'+(m?' ro':'');
  chip.title=m==='trava'?'Clique para editar mesmo assim':m?'Você tem acesso só de leitura a este documento':'Documento compartilhado — clique para ver quem tem acesso'}
$('#plDocChip').onclick=async()=>{if(!D)return;const m=roMotivo(D);
  if(m==='trava'){const o=P.trava.outro;if(await confirmDlg('Editar mesmo assim',`${o.nome} está com o documento aberto para edição. Se você assumir, ${o.nome.split(' ')[0]} passa a ver o documento só para leitura. Continuar?`,'Assumir a edição')){P.trava.forcado.add(D.id);await pulso(true);await sincroniza();pintaDoc()}return}
  if(meu(D)&&can('compartilhar'))dlgCompartilhar(D.id)};
$('#plShareBtn').onclick=()=>{if(D)dlgCompartilhar(D.id)};

async function pulso(forcar){const id=P.trava.id;if(!id)return;
  try{const r=await api('POST',`/api/docs/${encodeURIComponent(id)}/editando`,{ativo:true,forcar:!!forcar||P.trava.forcado.has(id)});
    if(P.trava.id!==id)return;const antes=P.trava.outro;P.trava.outro=r.outro;
    if(r.outro)P.trava.forcado.delete(id);
    if(r.outro&&!antes){flushSave();toast(`${r.outro.nome} está editando este documento — aberto somente para leitura`,4500)}
    if(!r.outro&&antes){await sincroniza();toast('Documento liberado para edição')}
    else if(r.v&&D&&D.id===id&&(D._v||0)<r.v&&!editandoAgora(id))sincroniza();
    pintaDoc()}catch(_){}}
function largaTrava(){const id=P.trava.id;clearInterval(P.trava.timer);P.trava={...P.trava,id:null,timer:null,outro:null};
  if(id)fetch(`/api/docs/${encodeURIComponent(id)}/editando`,{method:'POST',keepalive:true,credentials:'same-origin',headers:{'x-writer':'1','content-type':'application/json'},body:JSON.stringify({ativo:false})}).catch(()=>{})}
function pegaTrava(d){if(P.trava.id===(d&&d.id))return;largaTrava();
  if(!d||!d._v||d._nivel==='LER'||!can('editar')||!compartilhado(d))return;
  P.trava.id=d.id;pulso();P.trava.timer=setInterval(()=>{if(!document.hidden)pulso()},25000)}
addEventListener('pagehide',largaTrava);

/* ---------------- embrulho das funções do editor ---------------- */
{const _open=openDoc;openDoc=function(id){const r=_open(id);if(D&&D.id===id){pegaTrava(D);pintaDoc();aplicaIdioma();if(DX.id!==id){DX.v=null;DX.id=null;syncEdms(false)}
  if(P.me&&P.me.prefs.ultimoDoc!==id)salvaPrefs({ultimoDoc:id})}return r}}
{const _home=showHome;showHome=function(on=true){const r=_home(on);if(on)largaTrava();else if(D)pegaTrava(D);pintaDoc();return r}}
{const _sm=setMode;setMode=function(m){if(m==='notes'&&!can('notas'))m='docs';const r=_sm(m);if(m==='notes')largaTrava();else if(D&&$('#home').hidden)pegaTrava(D);pintaDoc();return r}}
{const _md=markDirty;markDirty=function(){if(roMotivo(D))return;return _md()}}
{const _fs=flushSave;flushSave=function(){if(roMotivo(D)){clearTimeout(saveT);saveT=null;return}return _fs()}}
{const _cm=onCloudMerged;onCloudMerged=function(){const st=desk.scrollTop;_cm();if(D&&$('#home').hidden)desk.scrollTop=st;pintaDoc()}}
{const _cd=createDoc;createDoc=function(t){if(!can('criar')){toast('Seu perfil não pode criar documentos');return D||{id:null}}
  const p=P.me.prefs,lay={};if(p.pagina&&SIZES[p.pagina])lay.size=p.pagina;if(p.margens&&MARGINS[p.margens])lay.m=[...MARGINS[p.margens]];
  const d=_cd({...t,layout:{...lay,...(t.layout||{})}});
  if(d&&d.id&&!d.lang){d.lang=IDIOMAS[t.lang]?t.lang:idiomaPadrao();aplicaIdioma()}   // idioma de escrita do documento novo
  return d}}
{const _imp=importFiles;importFiles=function(files){
  if(!can('importar')){toast('Seu perfil não pode abrir ou importar arquivos');return}
  if(mode==='notes'?!can('notas'):!can('criar')){toast(mode==='notes'?'Seu perfil não usa o módulo Notas':'Seu perfil não pode criar documentos');return}
  return _imp(files)}}
{const _sb=saveBlob;saveBlob=function(...a){if(!can('exportar')){toast('Seu perfil não pode exportar arquivos');return}return _sb(...a)}}
{const _pd=printDoc;printDoc=function(){if(!can('exportar')){toast('Seu perfil não pode imprimir nem gerar PDF');return}return _pd()}}
{const _nc=NOTES.create.bind(NOTES);NOTES.create=function(o){if(!can('notas')){toast('Seu perfil não usa o módulo Notas');return null}return _nc(o)}}
{const _nq=NOTES.quick.bind(NOTES);NOTES.quick=function(){if(!can('notas'))return;return _nq()}}
{const _cmd=NOTES.cmd.bind(NOTES);NOTES.cmd=function(k){if(k==='todoc'&&!can('criar')){toast('Seu perfil não pode criar documentos');return}return _cmd(k)}}
$('#bExport').onclick=e=>{const a=e.currentTarget;
  const docs=P.me.docs&&can('enviar_docs')&&mode==='docs'&&D&&$('#home').hidden&&!roMotivo(D);
  if(can('exportar')){exportMenu(a);const m=$('.menu');if(docs&&m){const b=document.createElement('button');b.innerHTML=svg('send')+'<span>Enviar ao GPlanSiS|Docs…</span>';
    b.onmousedown=ev=>ev.preventDefault();b.onclick=()=>{closeMenus();dlgEnviarDocs()};m.prepend(document.createElement('hr'));m.prepend(b)}return}
  const it=[];if(docs)it.push({label:'Enviar ao GPlanSiS|Docs…',icon:'send',run:dlgEnviarDocs});
  if(can('importar')&&(mode==='notes'?can('notas'):can('criar')))it.push({label:'Abrir arquivo…',icon:'open',run:()=>$('#fileIn').click()});
  if(it.length)return menu(a,it);
  toast('Seu perfil não exporta nem importa arquivos')};

/* Assistente IA pelo servidor: mesma assinatura do sampler que o editor espera (prompt, {signal, onText}) */
getSample=async function(){if(!can('ia')||!P.me.ia)return null;
  return async(prompt,o={})=>{
    const r=await fetch('/api/ia/texto',{method:'POST',signal:o.signal,credentials:'same-origin',headers:{'x-writer':'1','content-type':'application/json'},body:JSON.stringify({prompt,acao:AI.kind||''})});
    if(!r.ok){let d=`Erro ${r.status}`;try{d=(await r.json()).detail||d}catch(_){}if(r.status===401)sessaoExpirada();throw new Error(d)}
    const rd=r.body.getReader(),dec=new TextDecoder();let buf='',txt='',fim=null;
    for(;;){const{value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
      while((i=buf.indexOf('\n\n'))>=0){const bloco=buf.slice(0,i);buf=buf.slice(i+2);
        const ev=(/^event: (.*)$/m.exec(bloco)||[])[1],dd=(/^data: (.*)$/m.exec(bloco)||[])[1];if(!ev||!dd)continue;const j=JSON.parse(dd);
        if(ev==='txt'){txt+=j.t;o.onText&&o.onText({text:txt})}
        else if(ev==='erro')throw new Error(j.detail);
        else if(ev==='fim')fim=j}}
    if(!fim)throw new Error('A conexão caiu antes do fim da resposta');
    return{text:txt,truncated:fim.truncado}}};

/* ---------------- permissões na interface ---------------- */
function aplicaPermissoes(){const B=document.body.classList;
  B.toggle('pl-sem-notas',!can('notas'));
  B.toggle('pl-sem-ia',!can('ia')||(!P.me.ia&&!isAdmin()));
  B.toggle('pl-sem-arquivo',!can('exportar')&&!(can('importar')&&(can('criar')||can('notas')))&&!(P.me.docs&&can('enviar_docs')));
  $('#plDocsLink').hidden=!P.me.docs;
  if(P.iniciado&&mode==='notes'&&!can('notas'))setMode('docs');
  if(P.iniciado&&D)pintaDoc();if(P.iniciado&&!$('#home').hidden)renderHome()}

/* ---------------- tela inicial (substitui a do editor) ---------------- */
renderHome=function(){const q=(S._hq||'').toLowerCase(),f=P.filtro;
  const todos=Object.values(S.docs).sort((a,b)=>b.updatedAt-a.updatedAt);
  const docs=todos.filter(d=>(f==='todos'||(f==='meus'?meu(d):!meu(d)))&&(!q||d.title.toLowerCase().includes(q)||textOf(d.html).toLowerCase().includes(q)));
  const nComp=todos.filter(d=>!meu(d)).length,nome=P.me.nome.split(' ')[0];
  $('#homeIn').innerHTML=`<h2>Olá, ${esc(nome)}</h2><div class="small">Documentos com páginas, estilos, revisão e notas integradas. Tudo é salvo sozinho no servidor${can('compartilhar')?' e pode ser compartilhado com a equipe':''}.</div>
  ${can('criar')?`<h3>Começar um documento</h3><div class="tpls">${Object.entries(TPL).map(([k,t])=>`<button class="tpl" data-tpl="${k}"><div class="th">${t.thumb}</div><div class="nm">${t.name}</div><div class="ds">${t.desc}</div></button>`).join('')}</div>`:''}
  <div class="pl-hbar"><nav class="pl-seg" id="plHF">${[['todos','Todos'],['meus','Meus'],['comp','Compartilhados comigo']].map(([k,n])=>`<button data-hf="${k}" aria-selected="${f===k}">${n}${k==='comp'&&nComp?`<i>${nComp}</i>`:''}</button>`).join('')}</nav>
    <input class="inp" id="hq" placeholder="Buscar documentos" value="${esc(S._hq||'')}">
    ${can('importar')&&can('criar')?`<button class="tb" id="hOpen">${svg('open')}<span class="lbl">Abrir arquivo</span></button>`:''}
    ${can('excluir')?`<button class="tb" id="plLix" title="Documentos excluídos ficam 30 dias na lixeira">${svg('trash')}<span class="lbl">Lixeira</span><span id="plLixN" class="pl-n">${P.lixeira||''}</span></button>`:''}</div>
  <div class="dlist">${docs.length?docs.map(linhaDoc).join(''):`<div class="empty">${q?'Nenhum documento encontrado.':f==='comp'?'Ninguém compartilhou documentos com você ainda.':can('criar')?'Nenhum documento ainda. Escolha um modelo acima ou abra um arquivo .docx, .odt, .md, .html ou .txt.':'Nenhum documento ainda. Quando alguém compartilhar um documento com você, ele aparece aqui.'}</div>`}</div>`;
  const hq=$('#hq');hq.oninput=()=>{S._hq=hq.value;renderHome();const n=$('#hq');n.focus();n.setSelectionRange(n.value.length,n.value.length)};
  if($('#hOpen'))$('#hOpen').onclick=()=>$('#fileIn').click();
  if($('#plLix'))$('#plLix').onclick=dlgLixeira;
  $('#plHF').onclick=e=>{const b=e.target.closest('[data-hf]');if(b){P.filtro=b.dataset.hf;renderHome()}}};
function linhaDoc(d){const m=meu(d),dono=d._dono||{};
  const sel=!m?`<span class="pl-who-s">${av(dono,'sm')}<span>${esc((dono.nome||'').split(' ')[0])}</span></span><span class="pl-badge${d._nivel==='EDITAR'?' ok':''}">${NIVEL[d._nivel]||'leitura'}</span>`
    :compartilhado(d)?`<span class="pl-badge ac" title="Compartilhado">${svgI('share')}${d._equipe?'equipe':''}${d._equipe&&d._conv?' + ':''}${d._conv?d._conv:''}</span>`:'';
  const ed=(P.edms||{})[d.id],edms=ed?`<span class="pl-badge${ed.abertos?' dg':''}" title="GPlanSiS|Docs · ${esc(stDocs(ed.status)[0])}${ed.abertos?` · ${ed.abertos} comentário(s) aberto(s)`:''}">${esc(ed.codigo||'')} · R${esc(ed.rev||'')}</span>`:'';
  const pend=S.srv.pend['d_'+d.id]?'<span class="pl-badge" title="Ainda não chegou ao servidor">não enviado</span>':'';
  return `<div class="drow" data-d="${d.id}">${svg('doc')}<span class="t">${esc(d.title)}</span>${sel}${edms}${pend}<span class="m pl-hide-sm">${(d.words||0).toLocaleString('pt-BR')} palavras</span><span class="m" title="${d._por?'por '+esc(d._por):''}">${fmtDate(d.updatedAt||Date.parse(d._em)||now())}</span>
    ${m&&can('compartilhar')&&d._v?`<button class="ib" data-share="${d.id}" title="Compartilhar">${svgI('share')}</button>`:''}
    ${d._v?`<button class="ib" data-ver="${d.id}" title="Histórico de versões">${svgI('hist')}</button>`:''}
    ${can('criar')?`<button class="ib" data-dup="${d.id}" title="Duplicar">${svg('dup')}</button>`:''}
    ${m&&can('excluir')?`<button class="ib" data-del="${d.id}" title="Mover para a lixeira">${svg('trash')}</button>`:''}</div>`}
const svgI=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
function pintaRodapeHome(){const n=$('#plLixN');if(n)n.textContent=P.lixeira||''}
// ações da lista tratadas aqui (antes do ouvinte do editor): duplicar sem herdar o vínculo, excluir para a lixeira
$('#homeIn').addEventListener('click',async e=>{
  const sh=e.target.closest('[data-share]');if(sh){e.stopPropagation();dlgCompartilhar(sh.dataset.share);return}
  const vr=e.target.closest('[data-ver]');if(vr){e.stopPropagation();dlgVersoes(vr.dataset.ver);return}
  const du=e.target.closest('[data-dup]');if(du){e.stopPropagation();const s=S.docs[du.dataset.dup];if(!s)return;
    const n=semCab(s);n.id=uid();n.title=s.title+' (cópia)';n.createdAt=n.updatedAt=now();S.docs[n.id]=n;persistLocal();Cloud.put('d',n);renderHome();toast('Cópia criada');return}
  const dl=e.target.closest('[data-del]');if(dl){e.stopPropagation();const d=S.docs[dl.dataset.del];if(!d)return;
    if(!await confirmDlg('Mover para a lixeira',`“${d.title}” vai para a lixeira e pode ser restaurado por 30 dias.${compartilhado(d)?' As pessoas com quem ele está compartilhado perdem o acesso.':''}`,'Mover para a lixeira'))return;
    delete S.docs[d.id];if(D&&D.id===d.id)D=null;persistLocal();
    if(d._v){P.lixo=true;Cloud.remove('d',d.id);P.lixo=false;P.lixeira=(P.lixeira||0)+1}else{delete S.srv.pend['d_'+d.id]}
    renderHome();return}},true);

/* ---------------- lixeira, versões e compartilhamento ---------------- */
async function dlgLixeira(){let L;try{L=(await api('GET','/api/lixeira')).docs}catch(e){toast(e.message);return}
  P.lixeira=L.length;pintaRodapeHome();
  janela('Lixeira',`<p class="small" style="margin-top:0">Documentos excluídos ficam aqui por 30 dias e depois são apagados de vez.</p>
    <div class="pl-scroll">${L.length?`<table class="pl-tbl"><tbody>${L.map(d=>`<tr><td><b>${esc(d.titulo)}</b><br><span class="small">${(d.palavras||0).toLocaleString('pt-BR')} palavras · excluído ${quando(d.excluidoEm)}</span></td>
      <td style="text-align:right;white-space:nowrap"><button class="tb" data-rest="${esc(d.id)}">Restaurar</button> <button class="tb danger" data-purga="${esc(d.id)}">Excluir de vez</button></td></tr>`).join('')}</tbody></table>`:'<p class="small" style="padding:12px">A lixeira está vazia.</p>'}</div>`,
    [{label:'Fechar',primary:true}],{wide:true,onOpen:sc=>{$('.mb',sc).onclick=async e=>{
      const r=e.target.closest('[data-rest]'),p=e.target.closest('[data-purga]');
      try{if(r){const x=await api('POST',`/api/docs/${encodeURIComponent(r.dataset.rest)}/restaurar`,{});S.docs[x.doc.id]=x.doc;persistLocal();J.fecha();renderHome();toast('Documento restaurado');P.lixeira=Math.max(0,P.lixeira-1)}
        if(p&&await confirmDlg('Excluir de vez','O documento e todo o histórico de versões serão apagados. Não há como desfazer.')){await api('DELETE',`/api/docs/${encodeURIComponent(p.dataset.purga)}/definitivo`);J.fecha();dlgLixeira()}}
      catch(err){toast(err.message)}}}})}

async function dlgVersoes(id){const d=S.docs[id];if(!d)return;let V;try{V=(await api('GET',`/api/docs/${encodeURIComponent(id)}/versoes`)).versoes}catch(e){toast(e.message);return}
  const pode=!roMotivo(d);
  janela('Histórico — '+d.title,`<p class="small" style="margin-top:0">Um retrato a cada 10 minutos de edição e sempre que outra pessoa grava; os 40 mais recentes. Restaurar grava uma nova versão por cima da atual — nada se perde.</p>
    <div class="pl-scroll"><table class="pl-tbl"><thead><tr><th>Versão</th><th>Quando</th><th>Por</th><th class="pl-hide-sm">Palavras</th><th></th></tr></thead><tbody>${V.map(v=>`<tr><td class="mono">v${v.versao}</td><td>${dataHora(v.salvoEm)}</td><td class="small">${esc(v.salvoPor||'')}</td><td class="pl-hide-sm mono">${(v.palavras||0).toLocaleString('pt-BR')}</td>
      <td style="text-align:right;white-space:nowrap">${pode?`<button class="tb" data-vr="${v.versao}">Restaurar</button>`:''}${can('criar')?` <button class="tb" data-vc="${v.versao}">Abrir cópia</button>`:''}</td></tr>`).join('')}</tbody></table></div>`,
    [{label:'Fechar',primary:true}],{wide:true,onOpen:sc=>{$('.mb',sc).onclick=async e=>{const r=e.target.closest('[data-vr]'),c=e.target.closest('[data-vc]');if(!r&&!c)return;
      try{const x=await api('GET',`/api/docs/${encodeURIComponent(id)}/versoes/${(r||c).dataset[r?'vr':'vc']}`),v=x.dados;
        if(r){if(!await confirmDlg('Restaurar versão',`Substituir o conteúdo atual pela versão ${x.versao} (${dataHora(x.salvoEm)})? A versão atual continua no histórico.`,'Restaurar'))return;
          const cur=S.docs[id];if(!cur)return;Object.assign(cur,{title:v.title,html:v.html,layout:v.layout,comments:v.comments||[],fns:v.fns||{},words:v.words||0,updatedAt:now()});
          persistLocal();Cloud.put('d',cur);J.fecha();if(D&&D.id===id){D=null}openDoc(id);toast(`Versão ${x.versao} restaurada`)}
        else{const n={...v,id:uid(),title:(v.title||'Documento')+` (v${x.versao})`,createdAt:now(),updatedAt:now()};S.docs[n.id]=n;persistLocal();Cloud.put('d',n);J.fecha();openDoc(n.id)}}
      catch(err){toast(err.message)}}}})}

async function dlgCompartilhar(id){const d=S.docs[id];if(!d)return;let c,dir;
  try{[c,dir]=await Promise.all([api('GET',`/api/docs/${encodeURIComponent(id)}/compartilhamento`),api('GET','/api/diretorio')])}catch(e){toast(e.message);return}
  let conv=c.usuarios.map(u=>({...u}));const outros=dir.usuarios.filter(u=>u.id!==c.donoId);
  const lista=()=>conv.length?conv.map(u=>`<div class="pl-share-row" data-u="${u.id}"><div class="pl-who">${av(u)}<div><b>${esc(u.nome)}</b><small>${esc(u.login)}</small></div></div>
      <select class="pl-sel" data-nv="${u.id}"><option value="LER"${u.nivel==='LER'?' selected':''}>Pode ler</option><option value="EDITAR"${u.nivel==='EDITAR'?' selected':''}>Pode editar</option></select>
      <button class="ib" data-rm="${u.id}" title="Remover">×</button></div>`).join(''):'<p class="small">Ninguém convidado individualmente.</p>';
  const opcoes=()=>`<option value="">Convidar pessoa…</option>${outros.filter(u=>!conv.some(x=>x.id===u.id)).map(u=>`<option value="${u.id}">${esc(u.nome)} — ${esc(u.login)}</option>`).join('')}`;
  janela('Compartilhar — '+d.title,`<div class="fld"><span>Toda a equipe</span><select class="inp" id="plShE"><option value="">Ninguém além dos convidados</option><option value="LER"${c.equipe==='LER'?' selected':''}>Todos podem ler</option><option value="EDITAR"${c.equipe==='EDITAR'?' selected':''}>Todos podem editar</option></select></div>
    <div class="fld"><span>Pessoas</span><div style="display:flex;gap:6px"><select class="inp" id="plShAdd" style="flex:1">${opcoes()}</select><select class="pl-sel" id="plShNv"><option value="LER">Pode ler</option><option value="EDITAR">Pode editar</option></select></div></div>
    <div id="plShL">${lista()}</div>
    <p class="small">Quem tem “Pode editar” precisa também da permissão de editar documentos no perfil. Duas pessoas não editam ao mesmo tempo: a segunda abre em leitura e pode assumir a edição.</p>`,
    [{label:'Cancelar'},{label:'Salvar',primary:true,keep:true,fn:async sc=>{
      try{await api('PUT',`/api/docs/${encodeURIComponent(id)}/compartilhamento`,{equipe:$('#plShE',sc).value||null,usuarios:conv.map(u=>({id:u.id,nivel:u.nivel}))});
        J.fecha();toast('Compartilhamento salvo');await sincroniza();if(!$('#home').hidden)renderHome();pintaDoc()}catch(e){toast(e.message)}}}],
    {onOpen:sc=>{const re=()=>{$('#plShL',sc).innerHTML=lista();$('#plShAdd',sc).innerHTML=opcoes()};
      $('#plShAdd',sc).onchange=e=>{const u=outros.find(x=>x.id===+e.target.value);if(!u)return;conv.push({...u,nivel:$('#plShNv',sc).value});re()};
      $('#plShL',sc).onclick=e=>{const b=e.target.closest('[data-rm]');if(b){conv=conv.filter(u=>u.id!==+b.dataset.rm);re()}};
      $('#plShL',sc).onchange=e=>{const s=e.target.closest('[data-nv]');if(s){const u=conv.find(x=>x.id===+s.dataset.nv);if(u)u.nivel=s.value}}}})}

/* ---------------- conta na barra superior ---------------- */
function pintaConta(){const u=P.me;$('#plTopAv').outerHTML=av(u).replace('class="pl-av ','id="plTopAv" class="pl-av ');$('#plUserBtn').title=`${u.nome} — conta e configurações`}
$('#plUserBtn').onclick=e=>{e.stopPropagation();const m=$('#plMenu');if(!m.hidden){m.hidden=true;return}const u=P.me;
  m.innerHTML=`<div class="pl-menu-who">${av(u,'md')}<div><b>${esc(u.nome)}</b><small>${esc(u.login)}</small><small>${esc(papelNome(u.papel))}${u.master?' · master':''}</small></div></div>
  <button data-m="docs">${ico('doc')}Meus documentos</button>
  <button data-m="perfil">${ico('user')}Perfil e avatar</button>
  <button data-m="cfg">${ico('gear')}Configurações</button>
  ${can('usuarios')?`<button data-m="usuarios">${ico('users')}Usuários e permissões</button>`:''}
  ${can('excluir')?`<button data-m="lixeira">${ico('trash')}Lixeira</button>`:''}
  <button data-m="tema">${ico('sun')}Alternar tema claro/escuro</button><hr>
  <button data-m="sair">${ico('out')}Sair</button>`;m.hidden=false};
$('#plMenu').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;$('#plMenu').hidden=true;const a=b.dataset.m;
  if(a==='docs'){$('#plCfg').hidden=true;setMode('docs');showHome(true)}
  if(a==='perfil')abreCfg('perfil');if(a==='cfg')abreCfg('prefs');if(a==='usuarios')abreCfg('usuarios');if(a==='lixeira')dlgLixeira();if(a==='sair')sair();
  if(a==='tema'){const dark=S.settings.theme?S.settings.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;const t=dark?'claro':'escuro';aplicaTema(t);salvaPrefs({tema:t})}};
document.addEventListener('pointerdown',e=>{const m=$('#plMenu');if(!m.hidden&&!m.contains(e.target)&&!e.target.closest('#plUserBtn'))m.hidden=true});
document.addEventListener('click',e=>{const b=e.target.closest('[data-pl-close]');if(b)$('#'+b.dataset.plClose).hidden=true});
async function sair(semPerguntar){
  if(P.iniciado){flushSave();NOTES.flush();for(const k of Object.keys(S.srv.pend))Cloud.pend.set(k,1);await envia().catch(()=>{})}
  const go=async()=>{largaTrava();try{await api('POST','/api/auth/logout',{})}catch(_){}
    // tudo enviado: a cópia local sai junto (computador compartilhado não guarda os documentos de ninguém)
    if(P.iniciado&&!pendentes()){try{localStorage.removeItem(LS)}catch(_){}}location.reload()};
  if(!semPerguntar&&P.iniciado&&pendentes()){if(await confirmDlg('Sair',`Há ${pendentes()} alteração(ões) que ainda não chegaram ao servidor. Elas ficam guardadas neste navegador e são enviadas quando você entrar de novo. Sair mesmo assim?`,'Sair'))go()}
  else go()}

/* ---------------- configurações ---------------- */
const ABAS=[['perfil','Perfil e avatar','user'],['seguranca','Senha e sessões','lock'],['prefs','Preferências','sliders'],
  ['usuarios','Usuários e permissões','users','usuarios'],['documentos','Todos os documentos','files','usuarios'],['ia','Assistente IA','spark','usuarios'],
  ['auditoria','Registro de acessos','list','auditoria'],['sobre','Sobre','info']];
function abreCfg(aba){if(aba)P.cfgAba=aba;$('#plMenu').hidden=true;$('#plCfg').hidden=false;flushSave();
  $('#plCfgWho').textContent=`${P.me.nome} · ${papelNome(P.me.papel)}${P.me.master?' (master)':''}`;
  $('#plCfgNav').innerHTML=ABAS.filter(a=>!a[3]||can(a[3])).map(([k,n,i])=>`<button role="tab" data-c="${k}" aria-selected="${P.cfgAba===k}">${ico(i)}${n}</button>`).join('');
  ({perfil:cfgPerfil,seguranca:cfgSeg,prefs:cfgPrefs,usuarios:cfgUsuarios,documentos:cfgDocs,ia:cfgIA,auditoria:cfgAud,sobre:cfgSobre})[P.cfgAba]();$('#plCfgBody').scrollTop=0}
$('#plCfgNav').onclick=e=>{const b=e.target.closest('[data-c]');if(b)abreCfg(b.dataset.c)};
const corpo=h=>{$('#plCfgBody').innerHTML=h};

function cfgPerfil(){const u=P.me,PM=u.perms;
  corpo(`<h2>Perfil e avatar</h2><p class="small">Seu nome e sua foto aparecem no menu da conta, nos documentos compartilhados, nos comentários e nas alterações controladas.</p>
  <div class="pl-box"><div class="pl-prof">${av(u,'lg')}<div class="pl-prof-t"><b>${esc(u.nome)}</b><span class="small">${esc(u.login)}</span>
    <div class="pl-actions"><button class="tb primary" id="plAvUp">${u.temAvatar?'Trocar foto':'Enviar foto'}</button>${u.temAvatar?'<button class="tb" id="plAvDel">Remover foto</button>':''}</div>
    <p class="small" style="margin:6px 0 0">PNG, JPEG ou WebP. Você enquadra a foto antes de salvar.</p></div></div></div>
  <div class="pl-box"><div class="pl-row"><span>Nome</span><input class="pl-in" id="plPfNome" value="${esc(u.nome)}" maxlength="120"></div>
    <div class="pl-row"><span>Cargo / função</span><input class="pl-in" id="plPfCargo" value="${esc(u.cargo||'')}" maxlength="120" placeholder="Ex.: Analista de planejamento"></div>
    <div class="pl-row"><span>E-mail (login)</span><input class="pl-in" value="${esc(u.login)}" readonly></div>
    <div class="pl-actions"><button class="tb primary" id="plPfSave">Salvar perfil</button><span class="pl-ok" id="plPfOk"></span></div></div>
  <div class="pl-box"><div class="pl-row"><span>Papel</span><div><span class="pl-badge ac">${esc(papelNome(u.papel))}</span>${u.master?' <span class="pl-badge dg">administrador master</span>':''}</div></div>
    <div class="pl-row" style="align-items:start"><span>Suas permissões</span><div class="pl-chips">${Object.entries(PM).map(([k,n])=>`<span class="pl-chip${u.permissoesEfetivas.includes(k)?'':' off'}">${esc(n)}</span>`).join('')}</div></div>
    <p class="small">Papel e permissões são definidos por um administrador.</p></div>`);
  $('#plAvUp').onclick=()=>{const i=$('#plAvatarIn');i.dataset.uid='';i.click()};
  if($('#plAvDel'))$('#plAvDel').onclick=async()=>{try{setMe(await api('DELETE','/api/perfil/avatar'));pintaConta();cfgPerfil()}catch(e){toast(e.message)}};
  $('#plPfSave').onclick=async()=>{try{setMe(await api('PATCH','/api/perfil',{nome:$('#plPfNome').value.trim(),cargo:$('#plPfCargo').value}));
    S.settings.author=P.me.nome;persistLocalD();pintaConta();$('#plPfOk').textContent='Perfil salvo';$('#plCfgWho').textContent=`${P.me.nome} · ${papelNome(P.me.papel)}`}catch(e){toast(e.message)}}}

/* avatar: enquadrar (arrastar + zoom) e reduzir a 256×256 no próprio navegador */
$('#plAvatarIn').onchange=e=>{const f=e.target.files[0],uid=e.target.dataset.uid;e.target.value='';if(!f)return;
  if(!/^image\/(png|jpeg|webp)$/.test(f.type)){toast('Use uma imagem PNG, JPEG ou WebP');return}
  const img=new Image(),url=URL.createObjectURL(f);img.onload=()=>enquadra(img,uid,()=>URL.revokeObjectURL(url));img.onerror=()=>{toast('Não foi possível ler a imagem');URL.revokeObjectURL(url)};img.src=url};
function enquadra(img,uid,fim){const T=240;let z=1,ox=0,oy=0;const base=T/Math.min(img.width,img.height);
  function desenha(ctx,N){const k=N/T,s=base*z*k;ctx.clearRect(0,0,N,N);ctx.drawImage(img,ox*k,oy*k,img.width*s,img.height*s)}
  janela('Enquadrar foto',`<div style="display:flex;flex-direction:column;align-items:center;gap:10px"><canvas id="plCrop" width="${T}" height="${T}" style="border-radius:50%;touch-action:none;cursor:grab;background:var(--panel2);width:${T}px;height:${T}px"></canvas>
    <label class="small" style="display:flex;gap:8px;align-items:center;width:${T}px">Zoom<input id="plCropZ" type="range" min="1" max="4" step="0.01" value="1" style="flex:1;accent-color:var(--accent)"></label><p class="small" style="margin:0">Arraste a foto para enquadrar o rosto.</p></div>`,
    [{label:'Cancelar',fn:()=>fim()},{label:'Salvar foto',primary:true,keep:true,fn:async()=>{
      const o=document.createElement('canvas');o.width=o.height=256;desenha(o.getContext('2d'),256);
      let d=o.toDataURL('image/webp',.86);if(!d.startsWith('data:image/webp'))d=o.toDataURL('image/jpeg',.88);
      try{if(uid){await api('PUT',`/api/usuarios/${uid}/avatar`,{dataUrl:d});cfgUsuarios()}else{setMe(await api('PUT','/api/perfil/avatar',{dataUrl:d}));pintaConta();cfgPerfil()}J.fecha();toast('Foto atualizada');fim()}catch(e){toast(e.message)}}}],
    {onOpen:sc=>{const cv=$('#plCrop',sc),g=cv.getContext('2d');
      const lim=()=>{const s=base*z,w=img.width*s,h=img.height*s;ox=Math.min(0,Math.max(T-w,ox));oy=Math.min(0,Math.max(T-h,oy))};
      const s0=base;ox=(T-img.width*s0)/2;oy=(T-img.height*s0)/2;desenha(g,T);
      $('#plCropZ',sc).oninput=e=>{const cx=T/2-ox,cy=T/2-oy,z0=z;z=+e.target.value;ox=T/2-cx*z/z0;oy=T/2-cy*z/z0;lim();desenha(g,T)};
      let p=null;cv.onpointerdown=e=>{p={x:e.clientX,y:e.clientY,ox,oy};cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing'};
      cv.onpointermove=e=>{if(!p)return;ox=p.ox+e.clientX-p.x;oy=p.oy+e.clientY-p.y;lim();desenha(g,T)};
      cv.onpointerup=cv.onpointercancel=()=>{p=null;cv.style.cursor='grab'}}})}

async function cfgSeg(){corpo(`<h2>Senha e sessões</h2><p class="small">Ao trocar a senha, as outras sessões abertas são encerradas.</p>
  <div class="pl-box"><form id="plSgF" autocomplete="on"><input type="email" autocomplete="username" value="${esc(P.me.login)}" hidden>
    <div class="pl-row"><span>Senha atual</span><input class="pl-in" type="password" id="plSgA" autocomplete="current-password" required></div>
    <div class="pl-row"><span>Nova senha</span><input class="pl-in" type="password" id="plSgN" autocomplete="new-password" required minlength="10"></div>
    <div class="pl-row"><span>Repita a nova</span><input class="pl-in" type="password" id="plSgN2" autocomplete="new-password" required minlength="10"></div>
    <p class="small">Mínimo de 10 caracteres, com maiúsculas, minúsculas e ao menos um número.</p>
    <div class="pl-actions"><button class="tb primary" type="submit">Trocar senha</button><span class="pl-err" id="plSgE"></span><span class="pl-ok" id="plSgOk"></span></div></form></div>
  <h3>Sessões ativas</h3><div id="plSgS" class="pl-scroll"><p class="small" style="padding:10px">Carregando…</p></div>
  <div class="pl-actions"><button class="tb" id="plSgX">Encerrar as outras sessões</button></div>`);
  $('#plSgF').onsubmit=async e=>{e.preventDefault();$('#plSgE').textContent='';$('#plSgOk').textContent='';if($('#plSgN').value!==$('#plSgN2').value){$('#plSgE').textContent='As senhas novas não conferem';return}
    try{setMe(await api('POST','/api/auth/senha',{atual:$('#plSgA').value,nova:$('#plSgN').value}));e.target.reset();$('#plSgOk').textContent='Senha alterada';sessoes()}catch(err){$('#plSgE').textContent=err.message}};
  $('#plSgX').onclick=async()=>{try{const r=await api('DELETE','/api/auth/sessoes');toast(`${r.encerradas} sessão(ões) encerrada(s)`);sessoes()}catch(e){toast(e.message)}};
  sessoes()}
async function sessoes(){try{const s=(await api('GET','/api/auth/sessoes')).sessoes;
  $('#plSgS').innerHTML=`<table class="pl-tbl"><thead><tr><th>Aparelho</th><th>IP</th><th class="pl-hide-sm">Entrou</th><th>Último uso</th></tr></thead><tbody>${s.map(x=>`<tr><td>${esc(navegador(x.ua))}${x.atual?' <span class="pl-badge ok">esta</span>':''}</td><td class="mono">${esc(x.ip||'')}</td><td class="pl-hide-sm">${dataHora(x.criadoEm)}</td><td>${quando(x.ultimoUso)}</td></tr>`).join('')}</tbody></table>`}catch(e){$('#plSgS').innerHTML=`<p class="pl-err" style="padding:10px">${esc(e.message)}</p>`}}

function cfgPrefs(){const p=P.me.prefs,tema=p.tema||'sistema';
  corpo(`<h2>Preferências</h2><p class="small">Ficam na sua conta e acompanham você em qualquer aparelho.</p>
  <div class="pl-box"><div class="pl-row"><span>Tema</span><div class="pl-seg" id="plPrT" style="width:max-content">${[['sistema','Do sistema'],['claro','Claro'],['escuro','Escuro']].map(([k,n])=>`<button data-t="${k}" aria-selected="${tema===k}">${n}</button>`).join('')}</div></div>
    <div class="pl-row"><span>Ao entrar</span><label class="chk"><input type="checkbox" id="plPrU" ${p.abrirUltimo!==false?'checked':''}> Reabrir o último documento em aparelho novo</label></div></div>
  <div class="pl-box"><div class="pl-row"><span>Página padrão</span><select class="pl-in" id="plPrP" style="max-width:220px">${Object.keys(SIZES).map(k=>`<option${(p.pagina||'A4')===k?' selected':''}>${k}</option>`).join('')}</select></div>
    <div class="pl-row"><span>Margens padrão</span><select class="pl-in" id="plPrM" style="max-width:220px">${Object.entries(MARGINS).map(([k,m])=>`<option value="${k}"${(p.margens||'Normal')===k?' selected':''}>${k} — ${m.map(x=>String(x).replace('.',',')).join(' / ')} mm</option>`).join('')}</select></div>
    <p class="small">Valem para documentos novos em branco. Os modelos (ABNT, ata, carta…) mantêm o próprio layout.</p></div>
  <div class="pl-box"><div class="pl-row"><span>Este navegador</span><div class="small" id="plPrL"></div></div>
    <div class="pl-actions"><button class="tb" id="plPrS">Sincronizar agora</button></div>
    <p class="small">Uma cópia de trabalho fica neste navegador para você continuar escrevendo se a conexão cair; ela é enviada sozinha quando a rede volta e é apagada quando você sai com tudo enviado.</p></div>`);
  const loc=()=>{let b=0;try{b=(localStorage.getItem(LS)||'').length*2}catch(_){}$('#plPrL').textContent=`${Object.keys(S.docs).length} documento(s), ${Object.keys(S.notes).length} nota(s) · ${tamanho(b)} guardados aqui · ${pendentes()?pendentes()+' alteração(ões) aguardando envio':'tudo enviado ao servidor'}`};loc();
  $('#plPrT').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;aplicaTema(b.dataset.t);salvaPrefs({tema:b.dataset.t});$$('#plPrT button').forEach(x=>x.setAttribute('aria-selected',x===b))};
  $('#plPrU').onchange=e=>salvaPrefs({abrirUltimo:e.target.checked});
  $('#plPrP').onchange=e=>{salvaPrefs({pagina:e.target.value});toast('Página padrão salva')};
  $('#plPrM').onchange=e=>{salvaPrefs({margens:e.target.value});toast('Margens padrão salvas')};
  $('#plPrS').onclick=async()=>{reenfileira();await sincroniza();await envia();loc();toast('Sincronizado')}}

async function cfgUsuarios(){corpo(`<h2>Usuários e permissões</h2><p class="small">O papel define as permissões padrão; você pode ajustar permissão por permissão em cada usuário. O administrador master não pode ser rebaixado nem desativado.</p>
  <div class="pl-actions" style="margin:0 0 12px"><button class="tb primary" id="plUsNew">Novo usuário</button><input class="pl-search" id="plUsQ" type="search" placeholder="Buscar nome ou e-mail"></div>
  <div class="pl-scroll" id="plUsT"><p class="small" style="padding:10px">Carregando…</p></div>
  <h3>Papéis</h3><div class="pl-scroll"><table class="pl-tbl"><thead><tr><th>Permissão</th>${Object.keys(P.me.papeis).map(p=>`<th>${esc(papelNome(p))}</th>`).join('')}</tr></thead><tbody>
  ${Object.entries(P.me.perms).map(([k,n])=>`<tr><td>${esc(n)}</td>${Object.values(P.me.papeis).map(l=>`<td>${l.includes(k)?'●':'<span class="small">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <p class="small">Todos os papéis leem os documentos compartilhados com eles. Editor cria e compartilha; Revisor edita o que recebe com permissão de edição (use Revisão › Controlar alterações); Leitor só lê.</p>`);
  $('#plUsNew').onclick=()=>dlgUsuario(null);
  let us=[];try{us=(await api('GET','/api/usuarios')).usuarios}catch(e){$('#plUsT').innerHTML=`<p class="pl-err" style="padding:10px">${esc(e.message)}</p>`;return}
  const pinta=()=>{const q=($('#plUsQ').value||'').toLowerCase(),L=us.filter(u=>!q||u.nome.toLowerCase().includes(q)||u.login.includes(q));
    $('#plUsT').innerHTML=`<table class="pl-tbl"><thead><tr><th>Usuário</th><th>Papel</th><th>Situação</th><th class="pl-hide-sm">Documentos</th><th class="pl-hide-sm">Último acesso</th></tr></thead><tbody>${L.map(u=>{
      const bl=u.bloqueadoAte&&new Date(u.bloqueadoAte)>new Date();
      return `<tr class="cl" data-u="${u.id}"><td><div class="pl-who">${av(u,'md')}<div><b>${esc(u.nome)}${u.id===P.me.id?' <span class="small">(você)</span>':''}</b><small>${esc(u.login)}${u.cargo?' · '+esc(u.cargo):''}</small></div></div></td>
      <td><span class="pl-badge ${u.papel==='ADMIN'?'ac':''}">${esc(papelNome(u.papel))}</span>${u.master?' <span class="pl-badge dg">master</span>':''}${u.permissoes?' <span class="pl-badge" title="Permissões ajustadas">personalizado</span>':''}</td>
      <td>${!u.ativo?'<span class="pl-badge">inativo</span>':bl?'<span class="pl-badge dg">bloqueado</span>':u.trocarSenha?'<span class="pl-badge">aguardando 1º acesso</span>':'<span class="pl-badge ok">ativo</span>'}</td>
      <td class="pl-hide-sm mono">${u.documentos} · ${u.notas} notas · ${tamanho(u.bytes)}</td><td class="pl-hide-sm">${quando(u.ultimoLogin)}</td></tr>`}).join('')}</tbody></table>`};
  pinta();$('#plUsQ').oninput=pinta;$('#plUsT').onclick=e=>{const r=e.target.closest('[data-u]');if(r)dlgUsuario(us.find(u=>u.id===+r.dataset.u))}}

function dlgUsuario(u){const novo=!u,PM=P.me.perms,PD=P.me.papeis,m=u&&u.master;
  const efetivas=u?u.permissoesEfetivas:PD.EDITOR;
  const acoes=novo?[]:[{label:'Redefinir senha',keep:true,fn:async()=>{if(!await confirmDlg('Redefinir senha',`Gerar uma senha temporária para ${u.nome}? As sessões abertas serão encerradas.`,'Gerar senha'))return;
      try{const r=await api('POST',`/api/usuarios/${u.id}/senha`,{});J.fecha();mostraSenha(u.login,r.senhaTemporaria)}catch(e){toast(e.message)}}},
    ...(u.bloqueadoAte&&new Date(u.bloqueadoAte)>new Date()?[{label:'Desbloquear',keep:true,fn:async()=>{await api('POST',`/api/usuarios/${u.id}/desbloquear`,{});toast('Desbloqueado');J.fecha();cfgUsuarios()}}]:[]),
    ...(u.sessoes&&u.id!==P.me.id?[{label:'Encerrar sessões',keep:true,fn:async()=>{const r=await api('POST',`/api/usuarios/${u.id}/sessoes/encerrar`,{});toast(`${r.encerradas} sessão(ões) encerrada(s)`);J.fecha();cfgUsuarios()}}]:[])];
  janela(novo?'Novo usuário':'Usuário — '+u.nome,`${novo?'':`<div class="pl-who" style="margin-bottom:10px">${av(u,'lg')}<div><b>${esc(u.nome)}</b><small>${esc(u.login)}</small><small>criado ${dataHora(u.criadoEm)} · ${u.sessoes} sessão(ões) ativa(s)</small><div class="pl-actions" style="margin-top:6px"><button class="tb" id="plUAv" type="button">Trocar foto</button></div></div></div>`}
    <label class="fld"><span>E-mail</span><input class="inp" id="plUL" type="email" value="${esc(u?u.login:'')}" ${novo?'':'readonly'} placeholder="nome@empresa.com.br"></label>
    <label class="fld"><span>Nome</span><input class="inp" id="plUN" value="${esc(u?u.nome:'')}" maxlength="120"></label>
    <label class="fld"><span>Cargo</span><input class="inp" id="plUC" value="${esc(u&&u.cargo||'')}" maxlength="120"></label>
    <label class="fld"><span>Papel</span><select class="inp" id="plUP" ${m?'disabled':''}>${Object.keys(PD).map(p=>`<option value="${p}"${(u?u.papel:'EDITOR')===p?' selected':''}>${esc(papelNome(p))}</option>`).join('')}</select></label>
    ${novo?'':`<label class="chk" style="display:flex;gap:8px;margin-bottom:10px"><input type="checkbox" id="plUA" ${u.ativo?'checked':''} ${m||u.id===P.me.id?'disabled':''}> Ativo (pode entrar)</label>`}
    <div class="pl-sub">Permissões</div>
    <label class="chk" style="display:flex;gap:8px;margin-bottom:6px"><input type="checkbox" id="plUPad" ${!u||!u.permissoes?'checked':''} ${m?'disabled':''}> Usar as permissões padrão do papel</label>
    <div class="pl-perm" id="plUPerm">${Object.entries(PM).map(([k,n])=>`<label><input type="checkbox" data-p="${k}" ${efetivas.includes(k)?'checked':''}> ${esc(n)}</label>`).join('')}</div>
    <div class="pl-err" id="plUE" style="margin-top:8px"></div>`,
    [...acoes,{label:'Cancelar'},{label:novo?'Criar usuário':'Salvar',primary:true,keep:true,fn:async sc=>{
      const pad=$('#plUPad',sc).checked,perms=$$('#plUPerm [data-p]',sc).filter(c=>c.checked).map(c=>c.dataset.p);
      const b={nome:$('#plUN',sc).value.trim(),cargo:$('#plUC',sc).value.trim(),papel:$('#plUP',sc).value};
      try{if(novo){const r=await api('POST','/api/usuarios',{...b,login:$('#plUL',sc).value.trim(),permissoes:pad?null:perms});J.fecha();mostraSenha(r.usuario.login,r.senhaTemporaria,true)}
        else{await api('PATCH',`/api/usuarios/${u.id}`,{...b,ativo:$('#plUA',sc).checked,usarPadrao:pad,permissoes:pad?null:perms});J.fecha();toast('Usuário salvo');
          if(u.id===P.me.id){setMe(await api('GET','/api/auth/me'));pintaConta();aplicaPermissoes()}cfgUsuarios()}}
      catch(e){$('#plUE',sc).textContent=e.message}}}],
    {wide:true,onOpen:sc=>{const syncPad=()=>{const pad=$('#plUPad',sc).checked;$$('#plUPerm input',sc).forEach(c=>{c.disabled=pad||m;if(pad)c.checked=PD[$('#plUP',sc).value].includes(c.dataset.p)})};
      $('#plUPad',sc).onchange=syncPad;$('#plUP',sc).onchange=syncPad;syncPad();
      if($('#plUAv',sc))$('#plUAv',sc).onclick=()=>{J.fecha();const i=$('#plAvatarIn');i.dataset.uid=u.id;i.click()}}})}
function mostraSenha(login,senha,novo){janela(novo?'Usuário criado':'Senha temporária',`<p style="margin-top:0">Envie ao usuário por um canal seguro. Ela vale para um único acesso: no primeiro login, a pessoa define a própria senha.</p>
  <label class="fld"><span>Endereço</span><input class="inp" readonly value="${esc(location.origin)}"></label><label class="fld"><span>E-mail</span><input class="inp" readonly value="${esc(login)}"></label>
  <div class="pl-sub">Senha temporária</div><div class="pl-secret">${esc(senha)}</div><p class="small">Esta senha não será mostrada de novo.</p>`,
  [{label:'Copiar acesso',keep:true,fn:()=>{navigator.clipboard&&navigator.clipboard.writeText(`GPlanSiS|Writer\n${location.origin}\nE-mail: ${login}\nSenha temporária: ${senha}`).then(()=>toast('Copiado'),()=>toast('Não foi possível copiar'))}},
   {label:'Concluir',primary:true,fn:()=>{if(P.cfgAba==='usuarios'&&!$('#plCfg').hidden)cfgUsuarios()}}])}

async function cfgDocs(){corpo(`<h2>Todos os documentos</h2><p class="small">Visão de governança: título, dono, tamanho e compartilhamento de cada documento do servidor. O conteúdo só é aberto por quem tem acesso a ele.</p>
  <div class="pl-actions" style="margin:0 0 12px"><input class="pl-search" id="plDcQ" type="search" placeholder="Buscar título ou dono"></div>
  <div class="pl-scroll" id="plDcT"><p class="small" style="padding:10px">Carregando…</p></div>`);
  let L=[];try{L=(await api('GET','/api/admin/documentos')).documentos}catch(e){$('#plDcT').innerHTML=`<p class="pl-err" style="padding:10px">${esc(e.message)}</p>`;return}
  const pinta=()=>{const q=($('#plDcQ').value||'').toLowerCase(),F=L.filter(d=>!q||d.titulo.toLowerCase().includes(q)||(d.dono||'').toLowerCase().includes(q)||d.donoLogin.includes(q));
    $('#plDcT').innerHTML=F.length?`<table class="pl-tbl"><thead><tr><th>Documento</th><th>Dono</th><th class="pl-hide-sm">Tamanho</th><th>Acesso</th><th class="pl-hide-sm">Atualizado</th></tr></thead><tbody>${F.map(d=>`<tr><td><b>${esc(d.titulo)}</b>${d.excluidoEm?' <span class="pl-badge dg">lixeira</span>':''}<br><span class="small mono">v${d.versao} · ${(d.palavras||0).toLocaleString('pt-BR')} palavras</span></td>
      <td>${esc(d.dono)}<br><span class="small">${esc(d.donoLogin)}</span></td><td class="pl-hide-sm mono">${tamanho(d.bytes)}</td>
      <td>${d.equipe?`<span class="pl-badge ac">equipe: ${NIVEL[d.equipe]}</span> `:''}${d.convidados?`<span class="pl-badge">${d.convidados} convidado(s)</span>`:''}${!d.equipe&&!d.convidados?'<span class="small">privado</span>':''}</td>
      <td class="pl-hide-sm">${quando(d.atualizadoEm)}<br><span class="small">${esc(d.atualizadoPor||'')}</span></td></tr>`).join('')}</tbody></table>`:'<p class="small" style="padding:10px">Nenhum documento.</p>'};
  pinta();$('#plDcQ').oninput=pinta}

async function cfgIA(){corpo(`<h2>Assistente IA</h2><p class="small">O assistente de escrita melhora, corrige, resume, expande, traduz e extrai ações de documentos — o resultado aparece para a pessoa revisar antes de aplicar. Ele usa a API da Anthropic com a chave da sua organização (console.anthropic.com › API Keys).</p>
  <div class="pl-box" id="plIaSt"><p class="small">Carregando…</p></div>
  <div class="pl-box"><form id="plIaF" autocomplete="off">
    <div class="pl-row"><span>Chave da API</span><input class="pl-in pl-key" id="plIaK" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-api03-…"></div>
    <div class="pl-row"><span>Modelo</span><select class="pl-in" id="plIaM"></select></div>
    <div class="pl-row"><span>Situação</span><label class="chk"><input type="checkbox" id="plIaA"> Assistente ligado para quem tem a permissão “Usar o Assistente IA”</label></div>
    <p class="small">A chave fica cifrada no banco do servidor e nunca volta para o navegador — aqui aparecem só os 4 últimos caracteres. Deixe o campo em branco para manter a chave atual.</p>
    <div class="pl-actions"><button class="tb primary" type="submit">Salvar</button><button class="tb" type="button" id="plIaT">Testar conexão</button><button class="tb" type="button" id="plIaX" hidden>Remover chave</button><span class="pl-err" id="plIaE"></span></div>
    <div class="pl-teste" id="plIaR"></div></form></div>`);
  let c;try{c=await api('GET','/api/admin/ia')}catch(e){$('#plIaSt').innerHTML=`<p class="pl-err">${esc(e.message)}</p>`;return}
  const pinta=c=>{$('#plIaSt').innerHTML=`<div class="pl-row"><span>Situação</span><div>${c.pronta?'<span class="pl-badge ok">ligado</span>':c.configurada?'<span class="pl-badge">desligado</span>':'<span class="pl-badge dg">sem chave</span>'}</div></div>
    <div class="pl-row"><span>Chave</span><div class="pl-key">${c.final?'sk-ant-…'+esc(c.final):'—'} <span class="small">${c.origem==='painel'?'(definida neste painel)':c.origem==='env'?'(do arquivo .env do servidor)':''}</span></div></div>
    <div class="pl-row"><span>Modelo</span><div class="pl-key">${esc(c.modelo)}</div></div>
    ${c.atualizadoEm?`<div class="pl-row"><span>Alterado</span><div class="small">${dataHora(c.atualizadoEm)} por ${esc(c.atualizadoPor||'')}</div></div>`:''}
    ${c.cifragem?'':'<p class="pl-err">O servidor está sem WRITER_SEGREDO no .env: não é possível guardar uma chave por aqui.</p>'}`;
    const ids=new Set(c.modelos.map(m=>m.id));$('#plIaM').innerHTML=c.modelos.map(m=>`<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join('')+(ids.has(c.modelo)?'':`<option value="${esc(c.modelo)}">${esc(c.modelo)}</option>`);
    $('#plIaM').value=c.modelo;$('#plIaA').checked=c.ativo;$('#plIaX').hidden=c.origem!=='painel'};
  pinta(c);
  const atualizaMe=async()=>{setMe(await api('GET','/api/auth/me'));aplicaPermissoes()};
  $('#plIaT').onclick=async()=>{const b=$('#plIaT');b.disabled=true;$('#plIaR').textContent='Testando…';$('#plIaE').textContent='';
    try{const r=await api('POST','/api/admin/ia/testar',{chave:$('#plIaK').value.trim()||null,modelo:$('#plIaM').value});
      if(r.modelos&&r.modelos.length){const atual=$('#plIaM').value,ja=new Set([...$('#plIaM').options].map(o=>o.value));for(const m of r.modelos)if(!ja.has(m))$('#plIaM').insertAdjacentHTML('beforeend',`<option value="${esc(m)}">${esc(m)}</option>`);$('#plIaM').value=atual}
      $('#plIaR').innerHTML=r.ok?`<span class="pl-ok">Conexão funcionando.</span> ${esc(r.modelo)} respondeu “${esc(r.resposta)}” em ${(r.ms/1000).toFixed(1).replace('.',',')} s. A chave enxerga ${r.modelos.length} modelo(s).`:`<span class="pl-err">${esc(r.erro)}</span>`}
    catch(e){$('#plIaR').innerHTML=`<span class="pl-err">${esc(e.message)}</span>`}finally{b.disabled=false}};
  $('#plIaF').onsubmit=async e=>{e.preventDefault();$('#plIaE').textContent='';
    try{const c2=await api('PUT','/api/admin/ia',{chave:$('#plIaK').value.trim()||null,modelo:$('#plIaM').value,ativo:$('#plIaA').checked});$('#plIaK').value='';pinta(c2);
      await atualizaMe();toast(c2.pronta?'Assistente IA ligado':'Configuração salva — assistente desligado')}catch(err){$('#plIaE').textContent=err.message}};
  $('#plIaX').onclick=async()=>{if(!await confirmDlg('Remover chave','Remover a chave da Anthropic guardada neste painel? O assistente para de funcionar (a não ser que haja chave no .env do servidor).','Remover chave'))return;
    try{pinta(await api('DELETE','/api/admin/ia/chave'));await atualizaMe();toast('Chave removida')}catch(e){toast(e.message)}}}

const EVT={LOGIN:'Entrou',LOGOUT:'Saiu',LOGIN_FALHA:'Senha errada',LOGIN_BLOQUEADO:'Bloqueado',SENHA_ALTERADA:'Trocou a senha',SENHA_REDEFINIDA:'Senha redefinida',USUARIO_CRIADO:'Usuário criado',USUARIO_ALTERADO:'Usuário alterado',
  USUARIO_DESBLOQUEADO:'Desbloqueio',SESSOES_ENCERRADAS:'Sessões encerradas',PERFIL_ALTERADO:'Perfil alterado',DOC_CRIADO:'Documento criado',DOC_SOBRESCRITO:'Documento sobrescrito',
  DOC_NA_LIXEIRA:'Para a lixeira',DOC_RESTAURADO:'Restaurado',DOC_EXCLUIDO_DEFINITIVO:'Excluído de vez',DOC_COMPARTILHADO:'Compartilhado',IA:'Assistente IA',ADMIN_CLI:'Admin pela linha de comando',IA_CONFIGURADA:'IA configurada',IA_CHAVE_REMOVIDA:'Chave da IA removida',DOCS_DOCUMENTO_CRIADO:'Criado no Docs',DOCS_ENVIADO:'Enviado ao Docs',LOGIN_SSO:'Entrou pelo Docs'};
async function cfgAud(ev){corpo(`<h2>Registro de acessos</h2><p class="small">Entradas, falhas de senha, mudanças de usuários e operações em documentos. Os 300 eventos mais recentes.</p>
  <div class="pl-actions" style="margin:0 0 12px"><select class="pl-in" id="plAuE" style="max-width:260px"><option value="">Todos os eventos</option>${Object.entries(EVT).map(([k,n])=>`<option value="${k}"${ev===k?' selected':''}>${n}</option>`).join('')}</select><button class="tb" id="plAuR">Atualizar</button></div>
  <div class="pl-scroll" id="plAuT"><p class="small" style="padding:10px">Carregando…</p></div>`);
  $('#plAuE').onchange=e=>cfgAud(e.target.value);$('#plAuR').onclick=()=>cfgAud($('#plAuE').value);
  try{const r=(await api('GET','/api/auditoria?limite=300'+(ev?'&evento='+encodeURIComponent(ev):''))).eventos;
    $('#plAuT').innerHTML=r.length?`<table class="pl-tbl"><thead><tr><th>Quando</th><th>Usuário</th><th>Evento</th><th class="pl-hide-sm">IP</th><th>Detalhe</th></tr></thead><tbody>${r.map(x=>`<tr><td class="mono" style="white-space:nowrap">${dataHora(x.ts)}</td><td>${esc(x.login||'—')}</td><td><span class="pl-badge ${/FALHA|BLOQ|DEFINITIVO/.test(x.evento)?'dg':''}">${esc(EVT[x.evento]||x.evento)}</span></td><td class="pl-hide-sm mono">${esc(x.ip||'')}</td><td class="small">${esc(x.detalhe||'')}</td></tr>`).join('')}</tbody></table>`:'<p class="small" style="padding:10px">Nenhum evento.</p>'}
  catch(e){$('#plAuT').innerHTML=`<p class="pl-err" style="padding:10px">${esc(e.message)}</p>`}}

async function cfgSobre(){let s=null;try{s=await api('GET','/api/saude')}catch(_){}
  corpo(`<h2>Sobre</h2><div class="pl-box"><div class="pl-brand" style="font-size:17px">${$('.pl-brand svg').outerHTML}<div><b>GPlanSiS</b><span>|Writer</span></div></div>
    <p class="small">Editor de documentos no estilo Word com módulo de Notas: páginas, estilos, sumário, notas de rodapé, comentários, controle de alterações, modelos e exportação .docx, .odt, .rtf, PDF, Markdown e HTML.</p>
    <div class="pl-row"><span>Servidor</span><div>${s&&s.ok?'<span class="pl-badge ok">em operação</span>':'<span class="pl-badge dg">sem resposta</span>'}</div></div>
    <div class="pl-row"><span>Assistente IA</span><div>${s&&s.ia?'<span class="pl-badge ok">ligado</span>':'<span class="pl-badge">desligado ou sem chave</span>'}${can('usuarios')?' <button class="tb" id="plSbIA" style="min-height:24px;padding:2px 8px">Configurar</button>':''}</div></div>
    <div class="pl-row"><span>Armazenamento</span><div class="small">Documentos e notas no servidor (40 versões por documento, lixeira de 30 dias). Uma cópia de trabalho fica neste navegador para não perder nada se a conexão cair.</div></div>
    <div class="pl-row"><span>Bibliotecas</span><div class="small">IBM Plex (SIL OFL 1.1), JSZip 3.10.1 (MIT), Mammoth 1.6.0 (BSD-2-Clause)</div></div></div>`);
  if($('#plSbIA'))$('#plSbIA').onclick=()=>abreCfg('ia')}

/* ---------------- integração GPlanSiS|Docs ----------------
   Enviar ao Docs cria o documento na lista mestra (1º envio) ou usa/abre a revisão; vão o PDF (gerado no servidor
   do Docs pelo Chromium, a partir do mesmo HTML de impressão, com código e revisão no cabeçalho), o Word (.docx)
   e o arquivo nativo. Revisões e comentários voltam por evento assinado e aparecem no selo da barra superior. */
const DX={id:null,v:null,assin:'',timer:null};
const ST_DOCS={EM_ELABORACAO:['Em elaboração',''],EM_VERIFICACAO:['Em verificação','warn'],APROVADA_INTERNA:['Aprovada internamente','info'],EMITIDA:['Emitida','info'],
  APROVADA:['Aprovada (A)','ok'],APROVADA_COM_COMENTARIOS:['Aprovada c/ comentários (B)','warn'],REPROVADA:['Reprovada','bad'],SUPERADA:['Superada',''],CANCELADA:['Cancelada','bad']};
const FIN={PI:'Para informação',PA:'Para aprovação',PC:'Para construção',CE:'Conforme construído',CA:'Cancelamento'};
const stDocs=s=>ST_DOCS[s]||[s||'—',''];
function abrirNoDocs(para){// a aba abre já no clique (senão o navegador bloqueia), o endereço chega depois
  const w=window.open('about:blank','_blank');
  api('POST','/api/gpdocs/sso',{para:para||''}).then(r=>{if(w)w.location.href=r.url;else location.href=r.url}).catch(e=>{if(w)w.close();toast(e.message,5000)})}
$('#plDocsLink').onclick=()=>abrirNoDocs('/writer');
const ligadoDocs=()=>!!(P.me&&P.me.docs&&D&&D._v&&$('#home').hidden&&mode==='docs');
function pintaEdms(){const el=$('#plEdmsChip'),v=DX.v;el.hidden=!(ligadoDocs()&&v&&DX.id===D.id);if(el.hidden)return;
  const[st,tom]=stDocs(v.revisao.status);
  el.innerHTML=`<span class="dot ${tom}"></span><b>${esc(v.codigo||'')}</b><span> · Rev. ${esc(v.revisao.label||'—')} · ${esc(st)}${v.comentariosAbertos?` · ${v.comentariosAbertos} coment.`:''}</span>`;
  el.title=`GPlanSiS|Docs — ${v.titulo||''}. Clique para ver revisões e comentários.`}
$('#plEdmsChip').onclick=()=>dlgEdms();
async function syncEdms(forcar){if(!ligadoDocs()){DX.v=null;DX.id=null;pintaEdms();return}
  const id=D.id;
  try{const r=await api('GET',`/api/gpdocs/vinculo/${encodeURIComponent(id)}${forcar?'?atualizar=1':''}`);if(!D||D.id!==id)return;
    const v=r.vinculo,ant=DX.id===id?DX.v:null;DX.v=v;DX.id=id;
    const assin=v?`${v.revisao.id}|${v.revisao.status}|${v.comentarios.map(c=>c.id+c.status).join(',')}`:'';
    if(ant&&v&&DX.assin&&assin!==DX.assin){// aviso do que mudou no Docs
      if(ant.revisao.status!==v.revisao.status||ant.revisao.label!==v.revisao.label)toast(`Docs: ${v.codigo} rev. ${v.revisao.label} — ${stDocs(v.revisao.status)[0]}`,5000);
      else if(v.comentariosAbertos>ant.comentariosAbertos)toast(`Docs: ${v.comentariosAbertos-ant.comentariosAbertos} comentário(s) novo(s) em ${v.codigo}`,5000)}
    DX.assin=assin;pintaEdms()}
  catch(e){if(forcar)toast('Docs: '+e.message,4000)}}
function agendaEdms(){clearInterval(DX.timer);if(P.me&&P.me.docs)DX.timer=setInterval(()=>{if(!document.hidden&&DX.v)syncEdms(false)},20000)}

function dlgEdms(){const v=DX.v;if(!v)return;const[st]=stDocs(v.revisao.status);
  janela('GPlanSiS|Docs — '+v.codigo,`<label class="fld"><span>Documento</span><input class="inp" readonly value="${esc(v.codigo)} · ${esc(v.titulo||'')}"></label>
    <label class="fld"><span>Projeto</span><input class="inp" readonly value="${esc(v.projeto.codigo||'')}${v.projeto.nome?' · '+esc(v.projeto.nome):''}"></label>
    <label class="fld"><span>Revisão</span><input class="inp" readonly value="${esc(v.revisao.label||'')} · ${esc(st)}${v.revisao.finalidade?' · '+esc(FIN[v.revisao.finalidade]||v.revisao.finalidade):''}${v.revisao.retornoCliente?' · retorno do cliente '+esc(v.revisao.retornoCliente):''}"></label>
    <p class="small">Enviado ${v.enviadoEm?quando(v.enviadoEm):'—'}${v.enviadoPor?' por '+esc(v.enviadoPor):''}${v.versaoEnviada?` · versão ${v.versaoEnviada} do documento`:''}${(D._v||0)>(v.versaoEnviada||0)?' <span class="pl-badge ac">há alterações não enviadas</span>':''}</p>
    <div class="pl-sub">Comentários (${v.comentarios.length}${v.comentariosAbertos?`, ${v.comentariosAbertos} aberto(s)`:''})</div>
    ${v.comentarios.length?v.comentarios.map((c,i)=>`<div class="pl-com${c.status==='ABERTO'?'':' res'}"><span class="n">${i+1}</span><div><b>${esc(c.author||'')}</b> <span class="small">· ${esc(c.category||'')} · rev. ${esc(c.revision_label||'')}${c.page?` · pág. ${c.page}`:''} · ${quando(c.created_at)}</span>
      <p>${esc(c.body)}</p>${c.resolution?`<p class="small">Resolução: ${esc(c.resolution)}</p>`:''}</div>
      <span class="pl-badge ${c.status==='ABERTO'?'dg':'ok'}">${c.status==='ABERTO'?'aberto':c.status==='RESOLVIDO'?'resolvido':'n/a'}</span></div>`).join(''):'<p class="small">Nenhum comentário.</p>'}
    <div class="pl-sub">Revisões</div><div class="pl-scroll"><table class="pl-tbl"><thead><tr><th>Rev.</th><th>Situação</th><th>Finalidade</th><th class="pl-hide-sm">Descrição</th><th>Data</th></tr></thead><tbody>
    ${v.revisoes.slice().reverse().map(r=>`<tr><td class="mono">${esc(r.label)}</td><td>${esc(stDocs(r.status)[0])}</td><td>${esc(FIN[r.purpose]||r.purpose||'—')}</td><td class="small pl-hide-sm">${esc(r.description||'')}</td><td class="mono">${dataHora(r.issued_at||r.created_at)}</td></tr>`).join('')}</tbody></table></div>`,
    [{label:'Atualizar',keep:true,fn:async()=>{await syncEdms(true);J.fecha();dlgEdms()}},{label:'Abrir no Docs',keep:true,fn:()=>abrirNoDocs('/documentos/'+v.docId)},
     ...(can('enviar_docs')&&!roMotivo(D)?[{label:'Enviar nova versão',fn:()=>setTimeout(dlgEnviarDocs,40)}]:[]),{label:'Fechar',primary:true}],{wide:true})}

const blobB64=b=>new Promise((ok,ko)=>{const fr=new FileReader();fr.onload=()=>ok(String(fr.result).split(',')[1]);fr.onerror=()=>ko(new Error('Falha ao ler o arquivo'));fr.readAsDataURL(b)});
/* HTML de impressão para o Chromium do Docs: o mesmo @page do Writer (papel, margens, cabeçalho, rodapé, "Página X de Y")
   e o código/revisão do Docs no canto superior direito de cada página. */
function htmlParaPdf(codigo,rev){const L=D.layout;
  const pc=pageCSS().replace(/\}$/,`@top-right{content:${JSON.stringify(codigo+' · Rev. '+rev)};font:9pt 'IBM Plex Sans',Arial;color:#80878d}}`);
  const wm=L.wm?`body::before{content:${JSON.stringify(L.wm)};position:fixed;top:45%;left:0;right:0;text-align:center;transform:rotate(-38deg);font:600 76pt 'IBM Plex Sans',Arial;color:rgba(120,130,140,.15)}`:'';
  return `<!DOCTYPE html><html lang="${idiomaDe(D)}"><head><meta charset="utf-8"><title>${esc(codigo+' — '+D.title)}</title><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet"><style>${pc}${DOC_CSS}${L.cols>1?`.body{column-count:${L.cols};column-gap:10mm}`:''}html,body{margin:0;background:#fff}${wm}</style></head><body><div class="body">${exportHTMLbody()}</div></body></html>`}

async function dlgEnviarDocs(){
  if(!P.me.docs){toast('A integração com o GPlanSiS|Docs não está configurada no servidor');return}
  if(!can('enviar_docs')){toast('Seu perfil não permite enviar documentos ao GPlanSiS|Docs');return}
  if(!D||mode!=='docs'||!$('#home').hidden){toast('Abra o documento que vai para o Docs');return}
  if(roMotivo(D)){toast('Você está com este documento só para leitura');return}
  // o Docs recebe a versão do servidor: grava o que estiver pendente antes
  flushSave();reenfileira();await envia();
  if(!D._v||S.srv.pend['d_'+D.id]){toast('O documento ainda não chegou ao servidor — confira a conexão e tente de novo',5000);return}
  await syncEdms(true);const v=DX.id===D.id?DX.v:null;let op=null;
  if(!v){try{op=await api('GET','/api/gpdocs/opcoes')}catch(e){toast(e.message,5000);return}
    if(!op.projetos.length){janela('Enviar ao GPlanSiS|Docs','<p style="margin-top:0">Você não é Autor, Controlador nem Administrador de nenhum projeto no Docs.</p><p class="small">Peça a um controlador do projeto para incluir você na equipe.</p>',[{label:'Fechar',primary:true}]);return}}
  const[stA]=v?stDocs(v.revisao.status):[''];
  const acao=v?(v.revisao.status==='EM_ELABORACAO'?`Os arquivos da revisão <b>${esc(v.revisao.label)}</b> (em elaboração) serão substituídos por esta versão.`:`A revisão ${esc(v.revisao.label)} está “${esc(stA)}”: o Docs abrirá a <b>próxima revisão</b> com esta versão.`):'O Docs vai criar o documento na lista mestra, numerado pela máscara do projeto, na revisão inicial.';
  janela('Enviar ao GPlanSiS|Docs',`<p class="small" style="margin-top:0">${acao} Vão juntos: PDF (páginas como na impressão, com código e revisão no cabeçalho), Word (.docx) e o arquivo nativo do Writer.</p>
    ${v?`<label class="fld"><span>Documento</span><input class="inp" readonly value="${esc(v.codigo)} · ${esc(v.titulo||'')}"></label>
      ${v.revisao.status!=='EM_ELABORACAO'?'<label class="fld"><span>O que mudou</span><input class="inp" id="dxDesc" maxlength="300" placeholder="Descrição da nova revisão (ex.: atende comentários 1 a 3)"></label>':''}`
     :`<label class="fld"><span>Projeto</span><select class="inp" id="dxProj">${op.projetos.map(p=>`<option value="${p.id}">${esc(p.code)} · ${esc(p.name)}</option>`).join('')}</select></label>
      <label class="fld"><span>Disciplina</span><select class="inp" id="dxDisc"></select></label>
      <label class="fld"><span>Tipo</span><select class="inp" id="dxTipo">${op.tipos.map(t=>`<option value="${t.code}"${t.code==='RT'?' selected':''}>${esc(t.code)} · ${esc(t.name)}</option>`).join('')}</select></label>
      <label class="fld"><span>Título</span><input class="inp" id="dxTit" maxlength="200" value="${esc(D.title)}"></label>`}
    <label class="chk" style="display:flex;gap:8px;margin:6px 0"><input type="checkbox" id="dxFluxo"> Enviar para verificação no Docs</label><div id="dxFluxoBox" hidden></div>
    <div id="dxProg" class="pl-teste" hidden></div><div class="pl-err" id="dxErr"></div>`,
    [{label:'Cancelar'},{label:'Enviar ao Docs',primary:true,keep:true,fn:sc=>enviaDocs(sc,v)}],
    {wide:true,onOpen:sc=>{
      const projetoAtual=()=>v?v.projeto.id:$('#dxProj',sc).value;
      const pintaDisc=()=>{if(v)return;const pid=$('#dxProj',sc).value,hab=op.disciplinasProjeto.filter(x=>x.project_id===pid).map(x=>x.code);
        const L=op.disciplinas.filter(d=>!hab.length||hab.includes(d.code));$('#dxDisc',sc).innerHTML=L.map(d=>`<option value="${d.code}"${d.code==='GER'?' selected':''}>${esc(d.code)} · ${esc(d.name)}</option>`).join('')};
      let fluxos=op?op.fluxos:null;
      const pintaFluxo=async()=>{const box=$('#dxFluxoBox',sc);box.hidden=false;box.innerHTML='<p class="small">Carregando a equipe do projeto…</p>';
        try{if(!fluxos)fluxos=(await api('GET','/api/gpdocs/opcoes')).fluxos;const pid=projetoAtual();const T=fluxos.filter(t=>!t.project_id||t.project_id===pid);
          if(!T.length){box.innerHTML='<p class="small">Nenhum fluxo de verificação disponível para este projeto no Docs.</p>';return}
          const mem=await api('GET',`/api/gpdocs/projetos/${pid}/membros`);
          const pode=(papel,req)=>papel==='ADMIN'||papel===req||(req==='REVISOR'&&papel==='CONTROLADOR');
          const desenha=t=>`<label class="fld"><span>Fluxo</span><select class="inp" id="dxTpl">${T.map(x=>`<option value="${x.id}"${x.id===t.id?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
            ${t.steps.map(s=>{const ok=mem.filter(m=>pode(m.role,s.role_required)&&m.email.toLowerCase()!==P.me.login).sort((x,y)=>(y.role===s.role_required)-(x.role===s.role_required));
              return `<label class="fld"><span>${s.step_order}. ${esc(s.name)}</span><select class="inp" data-step="${s.step_order}">${ok.length?ok.map(m=>`<option value="${m.id}">${esc(m.name)} · ${esc(m.role)}</option>`).join(''):'<option value="">ninguém com perfil '+esc(s.role_required)+' no projeto</option>'}</select></label>`}).join('')}
            <p class="small">Prazo e regras seguem o fluxo do Docs; quem envia não pode aprovar a própria revisão.</p>`;
          box.innerHTML=desenha(T[0]);box.onchange=e=>{if(e.target.id==='dxTpl')box.innerHTML=desenha(T.find(x=>x.id===e.target.value))}}
        catch(e){box.innerHTML=`<p class="pl-err">${esc(e.message)}</p>`}};
      if(!v){pintaDisc();$('#dxProj',sc).onchange=()=>{pintaDisc();if($('#dxFluxo',sc).checked)pintaFluxo()}}
      $('#dxFluxo',sc).onchange=e=>{if(e.target.checked)pintaFluxo();else $('#dxFluxoBox',sc).hidden=true}}})}

async function enviaDocs(sc,v){const prog=$('#dxProg',sc),err=$('#dxErr',sc),btn=$('.tb.primary',sc);
  const passo=t=>{prog.hidden=false;prog.textContent=t};err.textContent='';
  let fluxo=null;if($('#dxFluxo',sc).checked){const t=$('#dxTpl',sc);if(!t){err.textContent='Escolha o fluxo de verificação';return}
    const as={};for(const s of $$('#dxFluxoBox [data-step]',sc)){if(!s.value){err.textContent='Falta responsável numa etapa do fluxo';return}as[s.dataset.step]=s.value}fluxo={template_id:t.value,assignees:as}}
  const id=D.id;btn.disabled=true;
  try{passo('Preparando o documento no Docs…');
    const p=await api('POST',`/api/gpdocs/preparar/${encodeURIComponent(id)}`,v?{descricao:($('#dxDesc',sc)||{}).value||null}:{projetoId:$('#dxProj',sc).value,disciplina:$('#dxDisc',sc).value,tipo:$('#dxTipo',sc).value,titulo:$('#dxTit',sc).value.trim()});
    if(!D||D.id!==id)throw new Error('O documento aberto mudou durante o envio');
    passo(`${p.codigo} · rev. ${p.revisaoLabel}: gerando o Word…`);
    await loadScript('/vendor/jszip.min.js');const docx=await blobB64(await buildDocx());
    passo(`${p.codigo} · rev. ${p.revisaoLabel}: gerando o PDF e enviando PDF, Word e arquivo nativo…`);
    const r=await api('POST',`/api/gpdocs/enviar/${encodeURIComponent(id)}`,{revisaoId:p.revisaoId,html:htmlParaPdf(p.codigo,p.revisaoLabel),docx,paginas:D._pages||null,fluxo});
    DX.v=r.vinculo;DX.id=id;DX.assin='';pintaEdms();J.fecha();sincroniza();
    toast(`Enviado ao Docs: ${p.codigo} rev. ${p.revisaoLabel}${fluxo?' — em verificação':''}`,5000)}
  catch(e){err.textContent=e.message;prog.hidden=true;syncEdms(true)}finally{btn.disabled=false}}

/* endereço #w<id>: abre o documento (vindo do Docs ou de um link) */
async function abrePorEndereco(){const m=/^#w([A-Za-z0-9_-]{4,64})$/.exec(location.hash);if(!m||!P.iniciado)return;
  history.replaceState(null,'',location.pathname);const id=m[1];
  if(!S.docs[id])await sincroniza();
  if(S.docs[id]){if(!D||D.id!==id)openDoc(id)}else toast('Documento não encontrado ou sem acesso para a sua conta',5000)}
addEventListener('hashchange',abrePorEndereco);

/* ---------------- idioma de escrita e tradutor automático ----------------
   Cada documento guarda o idioma (D.lang): vale para o corretor do navegador, a leitura em voz alta e o Word.
   O tradutor usa o Assistente IA do servidor: traduz a seleção no lugar (respeitando o controle de alterações)
   ou cria uma cópia traduzida do documento inteiro, em partes, preservando a formatação, imagens e notas de fim. */
const IDIOMAS={'pt-BR':{nome:'Português (Brasil)',ia:'português do Brasil (pt-BR)'},'en-US':{nome:'English (US)',ia:'inglês dos Estados Unidos (en-US)'},
  'es-ES':{nome:'Español (España)',ia:'espanhol da Espanha (es-ES)'},'zh-CN':{nome:'中文（简体）',ia:'chinês mandarim em caracteres simplificados (zh-CN)'}};
const idiomaPadrao=()=>IDIOMAS[P.me&&P.me.prefs.idioma]?P.me.prefs.idioma:'pt-BR';
const idiomaDe=d=>d&&IDIOMAS[d.lang]?d.lang:idiomaPadrao();
function aplicaIdioma(){const l=idiomaDe(D);ed.lang=l;nEd.lang=idiomaPadrao();$('#stLang').textContent=IDIOMAS[l].nome;
  ed.spellcheck=false;requestAnimationFrame(()=>{ed.spellcheck=true})}   // o corretor relê com o idioma novo
$('#stLang').onclick=e=>{const atual=idiomaDe(D);
  menu(e.currentTarget,Object.entries(IDIOMAS).map(([k,v])=>({label:(k===atual?'✓  ':'     ')+v.nome,k:k,run:()=>trocaIdioma(k)})))};
function trocaIdioma(k){salvaPrefs({idioma:k});
  if(D&&$('#home').hidden){if(roMotivo(D)){toast('Documento só para leitura: o idioma dele não muda');aplicaIdioma();return}D.lang=k;touch()}
  aplicaIdioma();toast(`Idioma de escrita: ${IDIOMAS[k].nome}. O corretor usa os dicionários instalados no navegador.`,4000)}

$('#stTrad').onclick=e=>{if(!D)return;const atual=idiomaDe(D),outros=Object.entries(IDIOMAS).filter(([k])=>k!==atual);
  const sel=lastRange&&!lastRange.collapsed&&ed.contains(lastRange.startContainer)&&lastRange.toString().trim();
  menu(e.currentTarget,[...(sel?outros.map(([k,v])=>({label:`Traduzir a seleção → ${v.nome}`,icon:'repl',run:()=>traduz(k,true)})):[]),...(sel?['-']:[]),
    ...outros.map(([k,v])=>({label:`Cópia traduzida do documento → ${v.nome}`,icon:'dup',run:()=>traduz(k,false)}))])};

// a resposta da IA volta ao documento: tira só o que executa código e mantém a estrutura do editor
// (notas de fim, sumário, comentários e alterações controladas dependem de classes e atributos data-*)
function limpaTraducao(h){const t=document.createElement('template');t.innerHTML=h;
  t.content.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button,textarea,select').forEach(e=>e.remove());
  t.content.querySelectorAll('*').forEach(e=>{for(const a of [...e.attributes]){const n=a.name.toLowerCase(),v=a.value.trim().toLowerCase();
    if(n.startsWith('on')||((n==='href'||n==='src'||n==='xlink:href')&&(v.startsWith('javascript:')||(n==='src'&&!v.startsWith('data:image/')&&!/^https?:/.test(v)))))e.removeAttribute(a.name)}});
  const d=document.createElement('div');d.appendChild(t.content);return d.innerHTML}
// divide o HTML em partes de até `max` caracteres sem cortar blocos (cada parte é uma chamada à IA)
function fatia(html,max){const d=document.createElement('template');d.innerHTML=html;const out=[];let cur='';   // template: conteúdo inerte, não baixa imagens
  for(const n of [...d.content.childNodes]){const h=n.nodeType===1?n.outerHTML:esc(n.textContent||'');if(cur&&cur.length+h.length>max){out.push(cur);cur=''}cur+=h}
  if(cur.trim())out.push(cur);return out}
const promptTraducao=(ia,h)=>`Você é um tradutor profissional de documentos técnicos e corporativos. Traduza o fragmento HTML abaixo para ${ia}.
Regras:
- Preserve exatamente todas as tags, atributos, classes, estilos e a estrutura; traduza apenas o texto visível (e os atributos alt e title).
- Não traduza nomes próprios, siglas, códigos de documento, números, unidades, fórmulas nem marcadores como __IMG_0__.
- Use a terminologia técnica correta no idioma de destino e mantenha o tom do original.
- Responda SOMENTE com o HTML traduzido, sem comentários e sem cercas de código.
<<<
${h}
>>>`;

async function traduz(alvo,soSel){const nomeAlvo=IDIOMAS[alvo].nome;
  if(!can('ia')){toast('O tradutor usa o Assistente IA, e seu perfil não tem essa permissão');return}
  const s=await getSample();
  if(!s){if(isAdmin())janela('Tradutor automático','<p style="margin-top:0">O tradutor usa o Assistente IA, que ainda não foi configurado neste servidor.</p><p class="small">Cole a chave da Anthropic em Configurações › Assistente IA e ligue o assistente.</p>',[{label:'Agora não'},{label:'Configurar',primary:true,fn:()=>abreCfg('ia')}]);
    else toast('Tradutor indisponível: o Assistente IA ainda não foi configurado pelo administrador',5000);return}
  if(soSel&&roMotivo(D)){toast('Documento só para leitura: use “Cópia traduzida”');return}
  if(!soSel&&!can('criar')){toast('Seu perfil não cria documentos — selecione um trecho para traduzir no lugar');return}
  flushSave();const doc=D,range=soSel?lastRange.cloneRange():null;
  let html;if(soSel){const d=document.createElement('div');d.appendChild(range.cloneContents());d.querySelectorAll('.pgsp,.selimg').forEach(x=>x.classList.remove('selimg'));html=d.innerHTML}else html=cleanHTML();
  // imagens (data:) ficam fora do texto enviado e voltam no lugar depois
  const imgs=[];html=html.replace(/(<img\b[^>]*?\bsrc=")(data:[^"]+)(")/gi,(m,a,src,c)=>{imgs.push(src);return a+'__IMG_'+(imgs.length-1)+'__'+c});
  const fns=soSel?[]:Object.entries(doc.fns||{}).filter(([,v])=>typeof v==='string'&&v.trim());
  const partes=fatia(html,12000);if(fns.length)partes.push(fns.map(([k,v])=>`<p data-fnid="${esc(k)}">${esc(v)}</p>`).join(''));
  const ctl=new AbortController();let cancelado=false;
  janela('Tradutor automático',`<p style="margin-top:0">${soSel?'Traduzindo a seleção':'Criando uma cópia traduzida de “'+esc(doc.title)+'”'} para <b>${esc(nomeAlvo)}</b>…</p>
    <div class="pl-teste" id="trP">Parte 1 de ${partes.length}</div><div class="pl-trprev" id="trV"></div>`,[{label:'Cancelar',fn:()=>{cancelado=true;ctl.abort()}}]);
  try{const out=[];
    for(let i=0;i<partes.length;i++){const p=$('#trP');if(p)p.textContent=`Parte ${i+1} de ${partes.length}${partes.length>1?` · ${Math.round(i/partes.length*100)}%`:''}`;
      const r=await s(promptTraducao(IDIOMAS[alvo].ia,partes[i]),{signal:ctl.signal,onText:({text})=>{const v=$('#trV');if(v)v.textContent=textOf(clean(text).replace(/<img\b[^>]*>/gi,'')).slice(-600)}});
      if(r.truncated)throw new Error('a resposta foi cortada por tamanho — tente traduzir por partes, selecionando trechos');
      out.push(clean(r.text))}
    let res=out.join('');let fnsTrad={};
    if(fns.length){const t=document.createElement('template');t.innerHTML=out[out.length-1];t.content.querySelectorAll('[data-fnid]').forEach(e=>{fnsTrad[e.dataset.fnid]=e.textContent.trim()});res=out.slice(0,-1).join('')}
    res=res.replace(/__IMG_(\d+)__/g,(m,n)=>imgs[+n]||'');
    if(soSel){J.fecha();if(D!==doc){toast('O documento aberto mudou durante a tradução');return}
      const sl=getSelection();ed.focus();sl.removeAllRanges();sl.addRange(range);lastRange=range;
      if(D.track){markDel(range,false);insertHTML(`<ins data-a="${esc(author())}" data-t="${now()}">${limpaTraducao(res)}</ins>`)}else insertHTML(limpaTraducao(res));
      toast(`Seleção traduzida para ${nomeAlvo}${D.track?' (como alteração controlada)':''}`);return}
    const pt=$('#trP');if(pt)pt.textContent='Traduzindo o título…';
    let titulo=doc.title;try{titulo=clean((await s(`Traduza para ${IDIOMAS[alvo].ia} apenas este título de documento. Responda só com o título traduzido, sem aspas: ${doc.title}`,{signal:ctl.signal})).text).split('\n')[0].trim()||doc.title}catch(e){if(e.name==='AbortError')throw e}
    J.fecha();
    const n=createDoc({title:titulo,html:limpaTraducao(res),layout:JSON.parse(JSON.stringify(doc.layout||{}))});
    if(n&&n.id&&D===n){n.lang=alvo;n.fns={...(doc.fns||{}),...fnsTrad};n.comments=JSON.parse(JSON.stringify(doc.comments||[]));touch();aplicaIdioma();layoutNow();
      toast(`Cópia traduzida criada: ${titulo}`,4500)}}
  catch(e){J.fecha();toast(cancelado||e.name==='AbortError'?'Tradução cancelada':'Não foi possível traduzir: '+e.message,5000)}}

/* ---------------- menu de contexto, seleção com o mouse e atalhos de teclado ----------------
   Clique direito no documento abre um menu que muda conforme o que está sob o mouse (seleção, tabela, link,
   imagem, comentário, alteração controlada). Shift + clique direito abre o menu do navegador (sugestões do corretor). */
// no Mac os atalhos usam ⌘ (Ctrl+A/E já movem o cursor e Ctrl+clique é o clique direito); nos demais, Ctrl
const MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);const modDe=e=>MAC?e.metaKey:e.ctrlKey;
const tecla=k=>MAC?k.replace(/Ctrl\+clique/g,'⌘+clique').replace(/Ctrl/g,'⌘').replace(/Alt/g,'⌥'):k;
const ancoraEm=(x,y)=>({getBoundingClientRect:()=>({left:x,right:x,top:y,bottom:y,width:0,height:0})});
const temSel=()=>!!(lastRange&&!lastRange.collapsed&&ed.contains(lastRange.startContainer)&&lastRange.toString().trim());
const iaOk=()=>can('ia')&&(P.me.ia||isAdmin());
function selecionaNo(n){const r=document.createRange();r.selectNodeContents(n);const s=getSelection();ed.focus({preventScroll:true});s.removeAllRanges();s.addRange(r);lastRange=r.cloneRange()}
const BLOCOS='p,h1,h2,h3,h4,li,blockquote,pre,td,th,div.callout';
function blocoDe(n){let b=closestIn(n&&n.nodeType===3?n.parentNode:n,BLOCOS);return b}
function selecionaParagrafo(){const b=blocoDe(lastRange&&lastRange.startContainer);if(b)selecionaNo(b)}
function selecionaFrase(no,off){const b=blocoDe(no);if(!b)return;
  // limites da frase no texto do bloco: depois de . ! ? … seguido de espaço, até o próximo
  const w=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);const ns=[];let t='',pos=0,n;
  while(n=w.nextNode()){if(n===no)pos=t.length+off;ns.push([n,t.length]);t+=n.nodeValue}
  if(!ns.length)return;let a=0,z=t.length;
  for(let i=pos-1;i>0;i--){if(/[.!?…]/.test(t[i-1])&&/\s/.test(t[i])){a=i+1;break}}
  for(let i=pos;i<t.length;i++){if(/[.!?…]/.test(t[i])){z=i+1;break}}
  while(a<z&&/\s/.test(t[a]))a++;
  const loc=k=>{let r=ns[0];for(const x of ns){if(x[1]<=k)r=x;else break}return[r[0],Math.min(k-r[1],r[0].nodeValue.length)]};
  const r=document.createRange();r.setStart(...loc(a));r.setEnd(...loc(z));const s=getSelection();s.removeAllRanges();s.addRange(r);lastRange=r.cloneRange()}
async function colar(simples){restoreSel();
  try{let html='',txt='';
    if(!simples&&navigator.clipboard.read){for(const it of await navigator.clipboard.read()){if(it.types.includes('text/html')){html=await (await it.getType('text/html')).text();break}if(it.types.includes('text/plain'))txt=await (await it.getType('text/plain')).text()}}
    if(!html&&!txt)txt=await navigator.clipboard.readText();
    let h=html?sanitize(html):esc(txt).split(/\r?\n\r?\n/).map(p=>`<p>${p.replace(/\r?\n/g,'<br>')}</p>`).join('');
    if(!html&&!/\n/.test(txt))h=esc(txt);if(!h)return;
    if(D.track)h=`<ins data-a="${esc(author())}" data-t="${now()}">${h}</ins>`;exec('insertHTML',h)}
  catch(_){toast(`O navegador bloqueou o acesso à área de transferência — use ${simples?'Ctrl+Shift+V':'Ctrl+V'}`,4000)}}
function moveParagrafo(dir){const b0=blocoDe(lastRange&&lastRange.startContainer);if(!b0)return;let b=b0;while(b.parentNode!==ed&&b.tagName!=='LI')b=b.parentNode;
  const viz=n=>dir<0?n.previousElementSibling:n.nextElementSibling;let x=viz(b);while(x&&x.classList.contains('pgsp'))x=viz(x);if(!x)return;   // pula os espaçadores de página
  const r=lastRange.cloneRange();dir<0?x.before(b):x.after(b);const s=getSelection();s.removeAllRanges();s.addRange(r);lastRange=r;afterEdit();b.scrollIntoView({block:'nearest'})}
let _caso=0;function alternaCaso(){if(!temSel())return toast('Selecione o texto');restoreSel();changeCase(['up','low','title','sent'][_caso++%4])}

// a seleção no instante do botão direito: o Chrome no Mac troca a seleção pela palavra sob o mouse
let selAntes=null;
ed.addEventListener('mousedown',e=>{if(e.button===2){const s=getSelection();selAntes=s.rangeCount&&!s.isCollapsed&&ed.contains(s.anchorNode)?s.getRangeAt(0).cloneRange():null}},true);
const dentro=(r,x,y)=>[...r.getClientRects()].some(q=>x>=q.left-2&&x<=q.right+2&&y>=q.top-2&&y<=q.bottom+2);
ed.addEventListener('contextmenu',e=>{if(e.shiftKey||!D)return;   // Shift + clique direito: menu do navegador
  e.preventDefault();
  if(selAntes&&dentro(selAntes,e.clientX,e.clientY)){const s=getSelection();s.removeAllRanges();s.addRange(selAntes);lastRange=selAntes.cloneRange()}
  selAntes=null;const t=e.target,ro=!!(roMotivo(D)||D.locked),sel=temSel(),it=[];
  const img=t.tagName==='IMG'?t:null,ln=t.closest('a[href]'),cm=t.closest('.cm'),ch=t.closest('ins,del'),cel=t.closest('td,th');
  if(!sel&&!img){const p=document.caretRangeFromPoint?document.caretRangeFromPoint(e.clientX,e.clientY):null;   // cursor onde o clique caiu
    if(p&&ed.contains(p.startContainer)){const s=getSelection();s.removeAllRanges();s.addRange(p);lastRange=p.cloneRange()}}
  const sep=()=>{if(it.length&&it[it.length-1]!=='-')it.push('-')};
  if(sel&&!ro)it.push({label:'Recortar',icon:'trash',k:'Ctrl+X',run:()=>{restoreSel();document.execCommand('cut');afterEdit()}});
  if(sel)it.push({label:'Copiar',icon:'dup',k:'Ctrl+C',run:()=>{restoreSel();document.execCommand('copy');toast('Copiado')}});
  if(!ro)it.push({label:'Colar',icon:'open',k:'Ctrl+V',run:()=>colar(false)},{label:'Colar sem formatação',icon:'al',k:'Ctrl+Shift+V',run:()=>colar(true)});
  // Assistente IA: edita o documento direto (alterações controladas + desfazer)
  if(iaOk()&&!ro&&!img){sep();
    if(sel)it.push({label:'IA · Corrigir a seleção',icon:'spell',run:()=>iaAcao('corrigir')},{label:'IA · Melhorar a escrita',icon:'ai',run:()=>iaAcao('melhorar')},
      {label:'IA · Tom formal',icon:'ai',run:()=>iaAcao('formal')},{label:'IA · Resumir',icon:'ai',run:()=>iaAcao('resumir')},{label:'IA · Expandir',icon:'ai',run:()=>iaAcao('expandir')},
      {label:'IA · Editar a seleção com um pedido…',icon:'draw',k:'Ctrl+Shift+E',run:()=>dlgIAPedido('editar')});
    else it.push({label:'IA · Escrever aqui…',icon:'draw',k:'Ctrl+Shift+J',run:()=>dlgIAPedido('escrever')},{label:'IA · Continuar o texto',icon:'ai',run:()=>iaAcao('continuar')},
      {label:'IA · Corrigir o documento inteiro',icon:'spell',run:()=>iaAcao('corrigir')},{label:'IA · Editar o documento com um pedido…',icon:'draw',k:'Ctrl+Shift+E',run:()=>dlgIAPedido('editar')});
    if(IAE.desfazer&&IAE.desfazer.doc===D)it.push({label:'IA · Desfazer a última edição',icon:'undo',run:()=>$('#plIaBar [data-ia="desfazer"]')?$('#plIaBar [data-ia="desfazer"]').click():(ed.innerHTML=IAE.desfazer.html,IAE.desfazer=null,afterEdit(),layoutNow(),refreshPanels())})}
  if(img){sep();it.push({label:'Ajustar imagem…',icon:'img',run:()=>selectImg(img)});if(!ro)it.push({label:'Excluir imagem',icon:'trash',run:()=>{img.remove();selectImg(null);afterEdit()}})}
  if(ln){sep();it.push({label:'Abrir link',icon:'link',k:'Ctrl+clique',run:()=>window.open(ln.href,'_blank','noopener')},{label:'Copiar endereço do link',icon:'dup',run:()=>navigator.clipboard.writeText(ln.href).then(()=>toast('Endereço copiado'))});
    if(!ro)it.push({label:'Editar link…',icon:'link',k:'Ctrl+K',run:()=>{selecionaNo(ln);insertLink()}},{label:'Remover link',icon:'clear',run:()=>{selecionaNo(ln);exec('unlink')}})}
  if(cm){sep();const id=cm.dataset.c;it.push({label:'Ver comentário',icon:'cmt',run:()=>{openSide('comments');focusComment(id)}});if(!ro)it.push({label:'Resolver comentário',icon:'accept',run:()=>{delComment(id,true);refreshPanels()}})}
  if(ch&&!ro){sep();it.push({label:'Aceitar esta alteração',icon:'accept',run:()=>{resolveChange(ch,true);ed.normalize();afterEdit();refreshPanels()}},{label:'Rejeitar esta alteração',icon:'reject',run:()=>{resolveChange(ch,false);ed.normalize();afterEdit();refreshPanels()}})}
  if(sel&&!ro){sep();it.push({label:'Negrito',icon:'bold',k:'Ctrl+B',run:()=>exec('bold')},{label:'Itálico',icon:'italic',k:'Ctrl+I',run:()=>exec('italic')},{label:'Sublinhado',icon:'under',k:'Ctrl+U',run:()=>exec('underline')},
    {label:'Tachado',icon:'strike',k:'Ctrl+Shift+X',run:()=>exec('strikeThrough')},{label:'Maiúsculas / minúsculas',icon:'sym',k:'Shift+F3',run:alternaCaso},{label:'Limpar formatação',icon:'clear',k:'Ctrl+Espaço',run:()=>exec('removeFormat')},
    {label:'Link…',icon:'link',k:'Ctrl+K',run:insertLink},{label:'Comentar',icon:'cmt',k:'Ctrl+Alt+M',run:addComment})}
  if(cel&&!ro){sep();it.push({label:'Inserir linha acima',icon:'rowa',run:()=>tblOp('rowa')},{label:'Inserir linha abaixo',icon:'rowb',run:()=>tblOp('rowb')},
    {label:'Inserir coluna à esquerda',icon:'cola',run:()=>tblOp('cola')},{label:'Inserir coluna à direita',icon:'colb',run:()=>tblOp('colb')},
    ...(sel?[{label:'Mesclar células',icon:'merge',run:()=>tblOp('merge')}]:[]),
    {label:'Excluir linha',icon:'minus',run:()=>tblOp('delrow')},{label:'Excluir coluna',icon:'minus',run:()=>tblOp('delcol')},{label:'Excluir tabela',icon:'trash',run:()=>tblOp('deltbl')})}
  if(!sel&&!cel&&!img&&!ro){sep();it.push({label:'Título 1',icon:'doc',k:'Ctrl+Alt+1',run:()=>setBlock('h1')},{label:'Título 2',icon:'doc',k:'Ctrl+Alt+2',run:()=>setBlock('h2')},{label:'Texto normal',icon:'al',k:'Ctrl+Alt+0',run:()=>setBlock('p')},
    {label:'Lista com marcadores',icon:'ul',k:'Ctrl+Shift+8',run:()=>listStyle('disc')},{label:'Lista numerada',icon:'ol',k:'Ctrl+Shift+7',run:()=>listStyle('decimal')},
    {label:'Mover parágrafo para cima',icon:'outd',k:'Alt+Shift+↑',run:()=>moveParagrafo(-1)},{label:'Mover parágrafo para baixo',icon:'ind',k:'Alt+Shift+↓',run:()=>moveParagrafo(1)},
    {label:'Quebra de página',icon:'pb',k:'Ctrl+Enter',run:()=>{restoreSel();insertHTML('<div class="pb" contenteditable="false"></div><p><br></p>')}})}
  if(sel){sep();
    if(iaOk())it.push({label:'Traduzir…',icon:'repl',run:()=>setTimeout(()=>$('#stTrad').onclick({currentTarget:ancoraEm(e.clientX,e.clientY)}),30)});
    if(can('notas'))it.push({label:'Criar nota com a seleção',icon:'tonote',run:selToNote});
    it.push({label:'Localizar no documento',icon:'find',k:'Ctrl+F',run:()=>{const q=lastRange.toString().trim().slice(0,80);openSide('find');setTimeout(()=>{const f=$('#fq');if(f){f.value=q;f.dispatchEvent(new Event('input',{bubbles:true}))}},40)}})}
  sep();it.push({label:'Selecionar parágrafo',icon:'al',k:'3 cliques',run:selecionaParagrafo},{label:'Selecionar tudo',icon:'all',k:'Ctrl+A',run:()=>{selecionaNo(ed)}},
    {label:'Atalhos do teclado…',icon:'sym',k:'Ctrl+/',run:dlgAtalhos});
  it.forEach(x=>{if(x&&x.k)x.k=tecla(x.k)});const m=menu(ancoraEm(e.clientX,e.clientY),it);
  const dica=document.createElement('div');dica.className='pl-menudica';dica.textContent='Shift + clique direito: menu do navegador e corretor';m.appendChild(dica);
  // reposiciona com a dica já dentro (o menu sobe se não couber embaixo)
  const mh=m.offsetHeight;if(e.clientY+mh>innerHeight-6)m.style.top=Math.max(6,e.clientY-mh)+'px'});

/* seleção com o mouse: Ctrl+clique seleciona a frase; clique na margem esquerda seleciona o parágrafo */
function naMargem(e){if(e.target!==ed)return false;const r=ed.getBoundingClientRect(),k=r.width/ed.offsetWidth||1;return e.clientX<r.left+parseFloat(getComputedStyle(ed).paddingLeft)*k}
// bloco de topo mais próximo da altura y (o clique pode cair no vão entre dois parágrafos)
function blocoNaAltura(y){let melhor=null,dist=1e9;for(const c of ed.children){if(c.classList.contains('pgsp'))continue;const r=c.getBoundingClientRect();
    if(y>=r.top&&y<=r.bottom)return c;const d=Math.min(Math.abs(y-r.top),Math.abs(y-r.bottom));if(d<dist){dist=d;melhor=c}}return melhor}
function selecionaBlocos(a,b){const ord=a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_PRECEDING?[b,a]:[a,b];
  const r=document.createRange();r.setStart(ord[0],0);r.setEnd(ord[1],ord[1].childNodes.length);
  const s=getSelection();s.removeAllRanges();s.addRange(r);lastRange=r.cloneRange()}
ed.addEventListener('mousedown',e=>{if(e.button!==0||!D)return;
  // margem esquerda (como no Word): clique seleciona o parágrafo, arrastar seleciona parágrafos inteiros, Shift estende
  if(naMargem(e)){const b=blocoNaAltura(e.clientY);if(!b)return;e.preventDefault();ed.focus({preventScroll:true});
    let ancora=b;if(e.shiftKey&&lastRange&&ed.contains(lastRange.startContainer)){let a=lastRange.startContainer;while(a&&a.parentNode!==ed)a=a.parentNode;if(a&&a.nodeType===1)ancora=a}
    selecionaBlocos(ancora,b);
    const move=ev=>{const c=blocoNaAltura(ev.clientY);if(c)selecionaBlocos(ancora,c)};
    const solta=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',solta)};
    document.addEventListener('mousemove',move);document.addEventListener('mouseup',solta);return}
  if(modDe(e)&&!e.target.closest('a[href],.toc,sup.fn')&&e.detail===1){const p=document.caretRangeFromPoint&&document.caretRangeFromPoint(e.clientX,e.clientY);
    if(p&&p.startContainer.nodeType===3&&ed.contains(p.startContainer)){e.preventDefault();selecionaFrase(p.startContainer,p.startOffset)}}});
ed.addEventListener('mousemove',e=>{ed.classList.toggle('pl-margem',naMargem(e))});

/* palavras selecionadas na barra de status ("12 de 340 palavras"); a repaginação também passa por aqui */
function contaSel(){const s=getSelection();if(!D||mode!=='docs'||!s.rangeCount||s.isCollapsed||!ed.contains(s.anchorNode))return false;
  $('#stWords').textContent=`${countWords(s.toString()).toLocaleString('pt-BR')} de ${countWords(textOf(ed.innerHTML)).toLocaleString('pt-BR')} palavras`;return true}
{const _st=stats;stats=function(){_st();contaSel()}}
document.addEventListener('selectionchange',debounce(()=>{if(!D||mode!=='docs')return;if(!contaSel()&&/ de /.test($('#stWords').textContent))stats()},120));

/* atalhos de teclado (padrão Word / Google Docs) */
const ATALHOS=[
  ['Texto',[['Ctrl+B / I / U','Negrito, itálico, sublinhado'],['Ctrl+Shift+X','Tachado'],['Ctrl+=','Subscrito'],['Ctrl+Shift+=','Sobrescrito'],['Ctrl+Shift+> / <','Aumentar / diminuir fonte'],
    ['Shift+F3','Alternar maiúsculas / minúsculas'],['Ctrl+Espaço ou Ctrl+\\','Limpar formatação'],['Ctrl+Shift+C','Copiar formatação (pincel)'],['Ctrl+K','Link']]],
  ['Parágrafo',[['Ctrl+Alt+1 / 2 / 3','Título 1, 2, 3'],['Ctrl+Alt+0','Texto normal'],['Ctrl+L / E / R / J','Alinhar à esquerda, centro, direita, justificar'],
    ['Ctrl+Shift+8 ou Ctrl+Shift+L','Lista com marcadores'],['Ctrl+Shift+7','Lista numerada'],['Ctrl+Shift+9','Lista de tarefas'],['Ctrl+M / Ctrl+Shift+M','Aumentar / diminuir recuo'],
    ['Alt+Shift+↑ / ↓','Mover parágrafo para cima / baixo'],['Ctrl+Enter','Quebra de página']]],
  ['Seleção',[['Shift+setas','Estender a seleção'],['Ctrl+Shift+← / →','Selecionar palavra a palavra'],['Ctrl+A','Selecionar tudo'],['2 cliques','Selecionar a palavra'],
    ['3 cliques ou clique na margem esquerda','Selecionar o parágrafo'],['Shift+clique na margem','Estender a seleção por parágrafos'],['Ctrl+clique','Selecionar a frase']]],
  ['Editar',[['Ctrl+Z / Ctrl+Y','Desfazer / refazer'],['Ctrl+X / C / V','Recortar, copiar, colar'],['Ctrl+Shift+V','Colar sem formatação'],['Ctrl+F / Ctrl+H','Localizar / substituir'],
    ['Ctrl+Alt+M','Comentário'],['Ctrl+Shift+E','IA: editar o documento ou a seleção com um pedido'],['Ctrl+Shift+J','IA: escrever no ponto do cursor'],['Ctrl+S','Salvar e enviar ao servidor agora'],['Ctrl+P','Imprimir / PDF']]],
  ['Geral',[['Clique direito','Menu de contexto'],['Shift+clique direito','Menu do navegador (corretor)'],['Ctrl+Shift+N','Nota rápida'],['Ctrl+/','Esta lista'],['Esc','Sair do modo foco / fechar menus']]]];
function dlgAtalhos(){janela('Atalhos do teclado',`<div class="pl-atalhos">${ATALHOS.map(([g,L])=>`<section><div class="pl-sub">${g}</div><table class="pl-tbl"><tbody>${L.map(([k,d])=>`<tr><td>${tecla(k).split(/( \/ | ou |\+)/).map(x=>/^( \/ | ou |\+)$/.test(x)?esc(x.trim()==='+'?'+':' '+x.trim()+' '):`<kbd>${esc(x)}</kbd>`).join('')}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table></section>`).join('')}</div>
  <p class="small">${MAC?'Neste Mac: ⌘ no lugar de Ctrl e ⌥ no lugar de Alt.':'No Mac, use ⌘ no lugar de Ctrl e ⌥ no lugar de Alt.'}</p>`,[{label:'Fechar',primary:true}],{wide:true})}
document.addEventListener('keydown',e=>{
  if(!P.iniciado||!$('#plGate').hidden)return;const mod=modDe(e);
  if(mod&&(e.key==='/'||e.code==='Slash')&&!e.altKey){e.preventDefault();dlgAtalhos();return}
  if(mode!=='docs'||!D||!$('#home').hidden)return;
  const noEd=document.activeElement===ed||ed.contains(document.activeElement);if(!noEd)return;
  const ro=!!(roMotivo(D)||D.locked),k=e.key.toLowerCase(),c=e.code;const faz=f=>{e.preventDefault();e.stopPropagation();if(ro)return toast('Documento só para leitura');f()};
  if(e.key==='F3'&&e.shiftKey&&!mod)return faz(alternaCaso);
  if(e.altKey&&e.shiftKey&&!mod&&(e.key==='ArrowUp'||e.key==='ArrowDown'))return faz(()=>moveParagrafo(e.key==='ArrowUp'?-1:1));
  if(!mod||e.altKey)return;
  if(e.shiftKey){
    if(c==='KeyX')return faz(()=>exec('strikeThrough'));
    if(c==='Digit8'||c==='KeyL')return faz(()=>listStyle('disc'));
    if(c==='Digit7')return faz(()=>listStyle('decimal'));
    if(c==='Digit9')return faz(toggleChecklist);
    if(c==='KeyM')return faz(()=>indentBlocks(-1));
    if(c==='KeyC')return faz(()=>{startPainter();toast('Pincel: selecione o texto que vai receber a formatação')});
    if(c==='Equal')return faz(()=>exec('superscript'));
    if(c==='KeyE'&&iaOk())return faz(()=>dlgIAPedido('editar'));
    if(c==='KeyJ'&&iaOk())return faz(()=>dlgIAPedido('escrever'));
    return}
  if(c==='KeyE')return faz(()=>exec('justifyCenter'));
  if(c==='KeyL')return faz(()=>exec('justifyLeft'));
  if(c==='KeyR')return faz(()=>exec('justifyRight'));
  if(c==='KeyJ')return faz(()=>exec('justifyFull'));
  if(c==='KeyM'||c==='BracketRight')return faz(()=>indentBlocks(1));
  if(c==='BracketLeft')return faz(()=>indentBlocks(-1));
  if(c==='Equal')return faz(()=>exec('subscript'));
  if(c==='Space'||c==='Backslash')return faz(()=>exec('removeFormat'));
},true);

/* ---------------- Assistente IA editando o documento aberto ----------------
   A IA recebe o documento em blocos numerados e devolve operações (substituir, inserir, excluir) com esquema
   validado no servidor. Aqui elas são aplicadas como ALTERAÇÕES CONTROLADAS do autor "Assistente IA"
   (aceitar/rejeitar em Revisão), com um Desfazer que volta o documento ao estado anterior.
   Trecho dentro de um parágrafo: a IA reescreve só o trecho e ele é trocado no lugar. */
const AUTOR_IA='Assistente IA';
const IAE={ctl:null,ocupado:false,desfazer:null};
const revisarIA=()=>P.me.prefs.iaRevisar!==false;
const marca=(tag,h)=>`<${tag} data-a="${esc(AUTOR_IA)}" data-t="${now()}">${h}</${tag}>`;
const blocosDoc=()=>[...ed.children].filter(e=>!e.classList.contains('pgsp'));
const blocoTopo=n=>{while(n&&n.parentNode!==ed)n=n.parentNode;return n&&n.nodeType===1?n:null};

// documento para a IA: blocos numerados, sem marcas de revisão (texto como ficaria se tudo fosse aceito), imagens fora
function documentoParaIA(){const imgs=[],bl=blocosDoc(),linhas=[];
  bl.forEach((b,i)=>{if(b.classList.contains('toc')){linhas.push(`[[B${i+1}]] <div>(sumário automático)</div>`);return}
    const c=b.cloneNode(true);c.querySelectorAll('del').forEach(x=>x.remove());c.querySelectorAll('ins').forEach(x=>x.replaceWith(...x.childNodes));
    c.querySelectorAll('.cm').forEach(x=>x.replaceWith(...x.childNodes));c.querySelectorAll('[contenteditable]').forEach(x=>x.removeAttribute('contenteditable'));
    let h=c.outerHTML.replace(/(<img\b[^>]*?\bsrc=")(data:[^"]+)(")/gi,(m,a,src,z)=>{imgs.push(src);return a+'__IMG_'+(imgs.length-1)+'__'+z});
    linhas.push(`[[B${i+1}]] ${h}`)});
  return{texto:linhas.join('\n'),blocos:bl,imgs}}

// diferença palavra a palavra (LCS) para parágrafos de texto simples: só o que mudou fica marcado
const simples=el=>[...el.childNodes].every(n=>n.nodeType===3||(n.nodeType===1&&n.tagName==='BR'));
function diffPalavras(a,b){const A=a.split(/(\s+)/).filter(x=>x!==''),B=b.split(/(\s+)/).filter(x=>x!=='');if(A.length*B.length>4e6)return null;
  const m=A.length,n=B.length,L=Array.from({length:m+1},()=>new Uint16Array(n+1));
  for(let i=m-1;i>=0;i--)for(let j=n-1;j>=0;j--)L[i][j]=A[i]===B[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  let i=0,j=0,out='',del='',ins='';const solta=()=>{if(del)out+=marca('del',esc(del));if(ins)out+=marca('ins',esc(ins));del=ins=''};
  while(i<m||j<n){if(i<m&&j<n&&A[i]===B[j]){solta();out+=esc(A[i]);i++;j++}else if(j<n&&(i===m||L[i][j+1]>=L[i+1][j])){ins+=B[j++]}else{del+=A[i++]}}
  solta();return out}

function aplicaOperacoes(r,doc,escopo){const novo=h=>limpaTraducao(h.replace(/__IMG_(\d+)__/g,(m,k)=>doc.imgs[+k]||''));
  const rev=revisarIA(),ops=(r.operacoes||[]).filter(o=>o&&Number.isInteger(o.bloco));let feitas=0,ignoradas=0;
  // de trás para frente: índices de blocos posteriores não mudam quando um anterior cresce
  ops.sort((a,b)=>b.bloco-a.bloco);
  for(const o of ops){const alvo=o.bloco===0?null:doc.blocos[o.bloco-1];
    if(o.bloco!==0&&(!alvo||!alvo.isConnected||alvo.classList.contains('toc'))){ignoradas++;continue}
    if(escopo&&o.bloco!==0&&!escopo.has(o.bloco)){ignoradas++;continue}
    const t=document.createElement('template');t.innerHTML=novo(o.html||'');const els=[...t.content.childNodes].filter(n=>n.nodeType===1||n.textContent.trim());
    const embrulha=frag=>{const out=[];for(const n of frag){let e=n;if(e.nodeType===3){const p=document.createElement('p');p.textContent=e.textContent;e=p}
        if(rev&&!['TABLE','UL','OL'].includes(e.tagName))e.innerHTML=marca('ins',e.innerHTML||'<br>');else if(rev)e.querySelectorAll('td,th,li').forEach(c=>c.innerHTML=marca('ins',c.innerHTML));out.push(e)}return out};
    if(o.op==='excluir'){if(rev){if(['TABLE','UL','OL'].includes(alvo.tagName))alvo.querySelectorAll('td,th,li').forEach(c=>c.innerHTML=marca('del',c.innerHTML));else alvo.innerHTML=marca('del',alvo.innerHTML)}else alvo.remove();feitas++;continue}
    if(!els.length){ignoradas++;continue}
    if(o.op==='inserir_depois'||o.op==='inserir_antes'){const novos=embrulha(els);
      if(!alvo){ed.prepend(...novos)}else if(o.op==='inserir_depois')alvo.after(...novos);else alvo.before(...novos);feitas++;continue}
    // substituir
    if(!rev){alvo.replaceWith(...els.map(e=>{if(e.nodeType===3){const p=document.createElement('p');p.textContent=e.textContent;return p}return e}));feitas++;continue}
    const um=els.length===1&&els[0].nodeType===1?els[0]:null;
    if(um&&um.tagName===alvo.tagName&&simples(um)&&simples(alvo)&&!alvo.querySelector('ins,del')){const d=diffPalavras(alvo.textContent,um.textContent);if(d!==null){alvo.innerHTML=d;feitas++;continue}}
    if(um&&um.tagName===alvo.tagName&&!['TABLE','UL','OL'].includes(um.tagName)){alvo.innerHTML=marca('del',alvo.innerHTML)+marca('ins',um.innerHTML);feitas++;continue}
    alvo.innerHTML=marca('del',alvo.innerHTML);alvo.after(...embrulha(els));feitas++}
  return{feitas,ignoradas}}

async function chamaEdicao(corpo,aoPulso,sinal){
  const r=await fetch('/api/ia/editar',{method:'POST',signal:sinal,credentials:'same-origin',headers:{'x-writer':'1','content-type':'application/json'},body:JSON.stringify(corpo)});
  if(!r.ok){let d=`Erro ${r.status}`;try{d=(await r.json()).detail||d}catch(_){}if(r.status===401)sessaoExpirada();throw new Error(d)}
  const rd=r.body.getReader(),dec=new TextDecoder();let buf='';
  for(;;){const{value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
    while((i=buf.indexOf('\n\n'))>=0){const bloco=buf.slice(0,i);buf=buf.slice(i+2);
      const ev=(/^event: (.*)$/m.exec(bloco)||[])[1],dd=(/^data: (.*)$/m.exec(bloco)||[])[1];if(!ev||!dd)continue;const j=JSON.parse(dd);
      if(ev==='pulso')aoPulso&&aoPulso(j);else if(ev==='erro')throw new Error(j.detail);else if(ev==='final')return j}}
  throw new Error('A conexão caiu antes do fim da resposta')}

function podeIAEditar(){if(!D)return false;if(!can('ia')){toast('Seu perfil não usa o Assistente IA');return false}
  if(!P.me.ia){if(isAdmin())janela('Assistente IA','<p style="margin-top:0">O Assistente IA ainda não está configurado.</p>',[{label:'Agora não'},{label:'Configurar',primary:true,fn:()=>abreCfg('ia')}]);else toast('O Assistente IA ainda não foi configurado pelo administrador');return false}
  if(roMotivo(D)||D.locked){toast('Documento só para leitura — a IA não pode alterá-lo');return false}
  if(IAE.ocupado){toast('A IA ainda está trabalhando no pedido anterior');return false}return true}

/* Edição por blocos. opts: {escopo:'selecao'|'cursor'|null, rotulo} */
async function iaEditar(pedido,opts={}){if(!podeIAEditar())return;flushSave();
  const doc=documentoParaIA();let escopo=null,txtEscopo='';
  const r0=lastRange&&ed.contains(lastRange.startContainer)?lastRange:null;
  if(opts.escopo==='selecao'&&r0&&!r0.collapsed){const a=doc.blocos.indexOf(blocoTopo(r0.startContainer))+1,z=doc.blocos.indexOf(blocoTopo(r0.endContainer))+1;
    if(a>0&&z>0){escopo=new Set();for(let k=a;k<=z;k++)escopo.add(k);txtEscopo=`altere apenas os blocos B${a} a B${z} (o trecho que a pessoa selecionou)`}}
  if(opts.escopo==='cursor'){const k=r0?doc.blocos.indexOf(blocoTopo(r0.startContainer))+1:doc.blocos.length;
    txtEscopo=k>0?`o cursor está no bloco B${k}: insira o texto novo logo depois dele (inserir_depois ${k}); não altere os outros blocos`:'o documento está vazio: insira no início (inserir_depois 0)';
    escopo=new Set(k>0?[k]:[])}
  if(doc.texto.length>380000){toast('Documento grande demais para a IA editar de uma vez — selecione um trecho',5000);return}
  const antes=ed.innerHTML,docRef=D;IAE.ocupado=true;IAE.ctl=new AbortController();
  barraIA(`<b>${esc(opts.rotulo||'Assistente IA')}</b> · trabalhando no documento…`,true);
  try{const r=await chamaEdicao({pedido,documento:doc.texto,escopo:txtEscopo,titulo:D.title,idioma:idiomaDe(D)},j=>barraIA(`<b>${esc(opts.rotulo||'Assistente IA')}</b> · trabalhando no documento… ${j.s} s`,true),IAE.ctl.signal);
    if(D!==docRef)throw new Error('O documento aberto mudou enquanto a IA trabalhava');
    if(!(r.operacoes||[]).length){barraIA(`<b>Assistente IA:</b> ${esc(r.resumo||'Nada a alterar.')}`);return}
    const{feitas,ignoradas}=aplicaOperacoes(r,doc,opts.escopo==='cursor'?null:escopo);
    if(!feitas){barraIA(`<b>Assistente IA:</b> não aplicou nada${ignoradas?` (${ignoradas} alteração(ões) fora do trecho selecionado foram ignoradas)`:''}. ${esc(r.resumo||'')}`);return}
    IAE.desfazer={doc:docRef,html:antes};ed.normalize();afterEdit();layoutNow();refreshPanels();
    barraIA(`<b>Assistente IA:</b> ${esc(r.resumo||'Documento alterado.')}${revisarIA()?' <span class="small">Alterações marcadas para revisão.</span>':''}`,false,true)}
  catch(e){barraIA(e.name==='AbortError'?'Pedido à IA cancelado.':`<span class="pl-err">Não foi possível: ${esc(e.message)}</span>`)}
  finally{IAE.ocupado=false;IAE.ctl=null}}

/* Trecho dentro de um parágrafo: reescreve só a seleção e troca no lugar */
async function iaTrecho(pedido,rotulo){if(!podeIAEditar())return;const r0=lastRange;
  if(!r0||r0.collapsed||!ed.contains(r0.startContainer))return toast('Selecione o trecho');
  const s=await getSample();if(!s)return;const range=r0.cloneRange(),docRef=D,antes=ed.innerHTML;
  const d=document.createElement('div');d.appendChild(range.cloneContents());d.querySelectorAll('del').forEach(x=>x.remove());
  IAE.ocupado=true;IAE.ctl=new AbortController();barraIA(`<b>${esc(rotulo)}</b> · reescrevendo o trecho…`,true);
  try{const r=await s(`Você é o assistente de escrita do GPlanSiS|Writer. Tarefa: ${pedido}\nAplique a tarefa ao TRECHO abaixo, que fica no meio de um parágrafo de um documento em ${IDIOMAS[idiomaDe(D)].ia}.\nRegras: responda SOMENTE com o trecho reescrito, em HTML inline (texto, strong, em, u, a, br) — sem p, sem títulos, sem listas, sem aspas e sem comentários. Não invente fatos, números, nomes ou datas.\nContexto (título do documento): ${D.title}\nTRECHO:\n<<<\n${d.innerHTML}\n>>>`,{signal:IAE.ctl.signal});
    if(D!==docRef)throw new Error('O documento aberto mudou enquanto a IA trabalhava');
    const h=limpaTraducao(clean(r.text).replace(/^<p>([\s\S]*)<\/p>$/i,'$1'));if(!h.trim())throw new Error('a IA não devolveu texto');
    {const t=document.createElement('template');t.innerHTML=h;if(t.content.textContent.trim()===d.textContent.trim()){barraIA(`<b>${esc(rotulo)}:</b> o trecho já estava adequado — nada foi alterado.`);return}}
    const sl=getSelection();ed.focus({preventScroll:true});sl.removeAllRanges();sl.addRange(range);lastRange=range;
    if(revisarIA()){const au=S.settings.author;S.settings.author=AUTOR_IA;try{markDel(range,false)}finally{S.settings.author=au}insertHTML(marca('ins',h))}else insertHTML(h);   // o apagado também fica em nome da IA
    IAE.desfazer={doc:docRef,html:antes};afterEdit();refreshPanels();barraIA(`<b>${esc(rotulo)}:</b> trecho reescrito.${revisarIA()?' <span class="small">Alteração marcada para revisão.</span>':''}`,false,true)}
  catch(e){barraIA(e.name==='AbortError'?'Pedido à IA cancelado.':`<span class="pl-err">Não foi possível: ${esc(e.message)}</span>`)}
  finally{IAE.ocupado=false;IAE.ctl=null}}

/* seleção dentro de um único parágrafo e menor que ele → trecho; senão, blocos */
function iaNaSelecao(pedido,rotulo){const r=lastRange;if(!r||r.collapsed)return iaEditar(pedido,{rotulo});
  const a=blocoTopo(r.startContainer),z=blocoTopo(r.endContainer);
  if(a&&a===z&&r.toString().trim().length<a.textContent.trim().length*0.9&&!['TABLE','UL','OL'].includes(a.tagName))return iaTrecho(pedido,rotulo);
  return iaEditar(pedido,{escopo:'selecao',rotulo})}

/* barra de resultado (rodapé do papel): resumo, ver alterações, desfazer */
function barraIA(html,trabalhando,comDesfazer){let b=$('#plIaBar');if(!b){b=document.createElement('div');b.id='plIaBar';b.className='pl-iabar';document.body.appendChild(b)}
  b.innerHTML=`<span class="pl-iabar-ic">${svg('ai')}</span><div class="pl-iabar-t">${html}</div>
    ${trabalhando?'<button class="tb" data-ia="parar">Parar</button>':''}
    ${comDesfazer&&revisarIA()?'<button class="tb" data-ia="ver">Ver alterações</button><button class="tb" data-ia="aceitar">Aceitar tudo</button>':''}
    ${comDesfazer?'<button class="tb" data-ia="desfazer">Desfazer</button>':''}${trabalhando?'':'<button class="ib" data-ia="x" title="Fechar">×</button>'}`;
  b.hidden=false;b.classList.toggle('busy',!!trabalhando);clearTimeout(barraIA._t);if(!trabalhando&&!comDesfazer)barraIA._t=setTimeout(()=>{b.hidden=true},9000)}
document.addEventListener('click',e=>{const k=e.target.closest('#plIaBar [data-ia]');if(!k)return;const a=k.dataset.ia,b=$('#plIaBar');
  if(a==='parar'){IAE.ctl&&IAE.ctl.abort();return}
  if(a==='x'){b.hidden=true;return}
  if(a==='ver'){openSide('changes');return}
  if(a==='aceitar'){$$('ins,del',ed).filter(x=>x.dataset.a===AUTOR_IA).forEach(x=>resolveChange(x,true));ed.normalize();afterEdit();refreshPanels();b.hidden=true;IAE.desfazer=null;toast('Alterações da IA aceitas');return}
  if(a==='desfazer'){const u=IAE.desfazer;if(!u||u.doc!==D){toast('Nada para desfazer neste documento');b.hidden=true;return}
    ed.innerHTML=u.html;IAE.desfazer=null;afterEdit();layoutNow();refreshPanels();b.hidden=true;toast('Edição da IA desfeita')}});

/* pedido livre (clique direito, painel) */
function dlgIAPedido(modo){const sel=temSel();
  const T={escrever:['Escrever com a IA','O que escrever aqui?','Ex.: um parágrafo de introdução sobre o objetivo deste relatório; uma tabela com cronograma de 4 etapas'],
    editar:[sel?'Editar a seleção com a IA':'Editar o documento com a IA',sel?'O que fazer com o trecho selecionado?':'O que mudar no documento?',sel?'Ex.: transformar em lista; deixar mais objetivo; corrigir a concordância':'Ex.: padronizar os títulos; corrigir todo o texto; acrescentar uma conclusão; trocar "cliente" por "contratante"']}[modo];
  janela(T[0],`<label class="fld"><span>${esc(T[1])}</span><textarea class="inp" id="iaPedido" rows="4" placeholder="${esc(T[2])}"></textarea></label>
    <label class="chk" style="display:flex;gap:8px"><input type="checkbox" id="iaRev" ${revisarIA()?'checked':''}> Marcar como alterações controladas (aceitar / rejeitar depois)</label>`,
    [{label:'Cancelar'},{label:modo==='escrever'?'Escrever':'Aplicar',primary:true,fn:sc=>{const q=$('#iaPedido',sc).value.trim();if(!q){toast('Escreva o pedido');return}
      const rv=$('#iaRev',sc).checked;if(rv!==revisarIA())salvaPrefs({iaRevisar:rv});
      if(modo==='escrever')iaEditar(q,{escopo:'cursor',rotulo:'Escrever'});else if(sel)iaNaSelecao(q,'Editar');else iaEditar(q,{rotulo:'Editar'})}}],
    {onOpen:sc=>{const t=$('#iaPedido',sc);t.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();$('.tb.primary',sc).click()}}}})}

const IA_ACOES={corrigir:['Corrigir','Corrija ortografia, gramática, concordância e pontuação. Não mude o estilo nem o conteúdo além do necessário.'],
  melhorar:['Melhorar escrita','Reescreva deixando o texto mais claro, direto e bem encadeado, mantendo o sentido, os números e os termos técnicos.'],
  formal:['Tom formal','Reescreva em tom formal e profissional, adequado a documento técnico ou corporativo.'],
  resumir:['Resumir','Resuma em poucas frases, preservando números, decisões e conclusões.'],
  expandir:['Expandir','Desenvolva com mais detalhe e exemplos concretos, sem inventar dados numéricos; onde faltar um dado, escreva [dado a confirmar].'],
  continuar:['Continuar o texto','Continue o texto a partir do ponto do cursor, no mesmo tom e assunto, com um ou dois parágrafos.']};
function iaAcao(k){const[rot,instr]=IA_ACOES[k];
  if(k==='continuar')return iaEditar(instr,{escopo:'cursor',rotulo:rot});
  if(temSel())return iaNaSelecao(instr,rot);
  return iaEditar(instr+' Aplique ao documento inteiro, bloco a bloco, alterando só os blocos que precisam.',{rotulo:rot+' (documento)'})}

/* painel do Assistente: botão "Aplicar no documento" ao lado de Gerar */
{const _rp=renderAIPane;renderAIPane=function(b){const r=_rp(b);if(sideMode!=='ai')return r;const go=$('#aiGo',b);
  if(go&&!$('#aiApl',b)){go.parentElement.style.flexWrap='wrap';go.insertAdjacentHTML('afterend',`<button class="tb" id="aiApl" title="A IA altera o documento aberto (como alterações controladas, com desfazer)">${svg('accept')}Aplicar no documento</button>`);
    $('#aiApl',b).onclick=e=>{e.stopPropagation();const q=($('#aiQ',b)||{}).value?.trim();const k=AI.kind&&AI.kind!=='custom'&&AIP[AI.kind]?AI.kind:null;
      if(q)return temSel()?iaNaSelecao(q,'Editar'):iaEditar(q,{rotulo:'Editar'});
      if(k&&IA_ACOES[k])return iaAcao(k);if(k)return temSel()?iaNaSelecao(AIP[k][1].replace('{arg}',AI.arg||'inglês'),AIP[k][0]):iaEditar(AIP[k][1].replace('{arg}',AI.arg||'inglês'),{rotulo:AIP[k][0]});
      toast('Escreva um pedido ou escolha uma ação acima')};
    if(!$('#aiRevChk',b))go.parentElement.insertAdjacentHTML('afterend',`<label class="chk" style="display:flex;gap:8px;margin:-4px 0 10px"><input type="checkbox" id="aiRevChk" ${revisarIA()?'checked':''}> Alterações da IA como alterações controladas</label>`);
    const c=$('#aiRevChk',b);if(c)c.onchange=()=>salvaPrefs({iaRevisar:c.checked})}
  return r}}

/* Ctrl+S também envia já ao servidor (o editor só grava localmente e agenda o envio) */
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&P.iniciado)setTimeout(()=>{reenfileira();envia()},50)});

inicio();
}
