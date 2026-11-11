/* Aprendizaje local por perfil. Sin red, textos de consulta, audio ni inferencias persistentes. */
const PCROPS=['papa','maiz','tomate','cafe','trigo','otro'];
const PEMOTIONS={tranquilo:'😊 Tranquilo',normal:'😐 Normal',preocupado:'😟 Preocupado',frustrado:'😠 Frustrado'};
const pempty=()=>({version:1,modalities:{text:0,voice:0},crops:{},bands:{manana:0,tarde:0,noche:0},sessions:[],edits:0,microphoneErrors:0,retries:0,feedback:[],emotion:null,seen:[],voiceOfferDismissed:false});
const ptop=counts=>{const entries=Object.entries(counts).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);return !entries.length?null:entries.length>1&&entries[0][1]===entries[1][1]?'tie':entries[0][0];};
const pcount=n=>Number.isSafeInteger(n)&&n>=0;
const pvalid=p=>p?.version===1&&p.modalities&&['text','voice'].every(k=>pcount(p.modalities[k]))&&
 p.crops&&Object.entries(p.crops).every(([k,n])=>PCROPS.includes(k)&&pcount(n))&&
 p.bands&&['manana','tarde','noche'].every(k=>pcount(p.bands[k]))&&
 Array.isArray(p.sessions)&&p.sessions.length<=100&&p.sessions.every(s=>typeof s.id==='string'&&pcount(s.count))&&
 ['edits','microphoneErrors','retries'].every(k=>pcount(p[k]))&&Array.isArray(p.seen)&&p.seen.length<=100&&p.seen.every(id=>typeof id==='string')&&
 Array.isArray(p.feedback)&&p.feedback.length<=100&&p.feedback.every(f=>typeof f.id==='string'&&['positive','negative'].includes(f.value))&&
 (p.emotion===null||p.emotion&&Object.hasOwn(PEMOTIONS,p.emotion.value)&&Number.isFinite(Date.parse(p.emotion.date)));
export function weeklySummary(events=[],now=new Date(),enabled=true){
 if(!enabled)return null;
 const end=now.getTime(),start=end-7*24*60*60*1000;
 const recent=events.filter(e=>e&&Number.isFinite(Date.parse(e.date))&&Date.parse(e.date)>=start&&Date.parse(e.date)<=end);
 const queries=recent.filter(e=>e.kind==='query'&&PCROPS.includes(e.crop)&&['text','voice'].includes(e.mode));
 const votes=recent.filter(e=>e.kind==='feedback'&&['positive','negative'].includes(e.value));
 const crops={},modes={text:0,voice:0};for(const e of queries){crops[e.crop]=(crops[e.crop]||0)+1;modes[e.mode]++;}
 return {count:queries.length,crop:ptop(crops),mode:ptop(modes),positive:votes.filter(e=>e.value==='positive').length,negative:votes.filter(e=>e.value==='negative').length,sufficient:queries.length>0};
}
export function createPersonalization({accounts,save,sessionId,now=()=>new Date()}){
 const runtime=new Map();
 const state=id=>{if(!runtime.has(id))runtime.set(id,{streak:0,dismissed:false});return runtime.get(id);};
 let migrated=false;
 for(const account of Object.values(accounts))if(!account.personalization){account.personalization=pempty();migrated=true;}
 if(migrated)save(); // Añade esquema vacío, sin convertir el historial anterior en eventos inventados.
 function data(id){const p=accounts[id]?.personalization;return pvalid(p)?p:null;}
 function changed(){return save();}
 function record(id,type,payload={}){
  const a=accounts[id],p=data(id);if(!a||a.learning!==true||!p){runtime.delete(id);return false;}
  const rt=state(id);
  const dated=event=>{if(!Array.isArray(p.events))p.events=[];p.events.push({...event,date:now().toISOString()});if(p.events.length>500){p.events=p.events.slice(-500);p.eventsTruncated=true;}};
  if(type==='query'){
   if(!['text','voice'].includes(payload.mode)||!PCROPS.includes(payload.crop)||typeof payload.id!=='string'||p.seen.includes(payload.id))return false;
   p.seen.push(payload.id);p.seen=p.seen.slice(-100);
   if(payload.real===true)dated({id:payload.id,kind:'query',crop:payload.crop,mode:payload.mode});
   p.modalities[payload.mode]++;p.crops[payload.crop]=(p.crops[payload.crop]||0)+1;
   const hour=now().getHours();p.bands[hour>=6&&hour<12?'manana':hour>=12&&hour<19?'tarde':'noche']++;
   let session=p.sessions.find(s=>s.id===sessionId);
   if(!session){session={id:sessionId,count:0};p.sessions.push(session);p.sessions=p.sessions.slice(-100);}session.count++;
   rt.streak=0;rt.dismissed=false;
  }else if(type==='edit')p.edits++;
  else if(type==='microphoneError'||type==='retry'||type==='error'){
   if(type==='microphoneError')p.microphoneErrors++;
   if(type==='retry')p.retries++;
   rt.streak++;
  }else if(type==='success'){rt.streak=0;rt.dismissed=false;return true;}
  else if(type==='emotion'){
   if(!Object.hasOwn(PEMOTIONS,payload.value))return false;
   p.emotion={value:payload.value,date:now().toISOString()};
  }else if(type==='feedback'){
   if(typeof payload.id!=='string'||!['positive','negative'].includes(payload.value))return false;
   const old=p.feedback.find(v=>v.id===payload.id);
   if(payload.real===true){if(Array.isArray(p.events))p.events=p.events.filter(e=>!(e.kind==='feedback'&&e.id===payload.id));dated({id:payload.id,kind:'feedback',value:payload.value});}
   if(old)old.value=payload.value;else p.feedback.push({id:payload.id,value:payload.value});p.feedback=p.feedback.slice(-100);
  }else if(type==='dismissVoice')p.voiceOfferDismissed=true;
  else return false;
  return changed();
 }
 function forget(id,category){
  const p=data(id);if(!p)return false;
  if(category==='all'){accounts[id].personalization=pempty();runtime.delete(id);}
  else if(category==='modalities'){p.modalities={text:0,voice:0};p.voiceOfferDismissed=false;}
  else if(category==='crops')p.crops={};
  else if(category==='sessions')p.sessions=[];
  else if(category==='bands')p.bands={manana:0,tarde:0,noche:0};
  else if(category==='edits')p.edits=0;
  else if(category==='errors'){p.microphoneErrors=0;p.retries=0;runtime.delete(id);}
  else if(category==='feedback')p.feedback=[];
  else if(category==='emotion')p.emotion=null;
  else return false;
  if(Array.isArray(p.events)){if(category==='feedback')p.events=p.events.filter(e=>e.kind!=='feedback');if(['modalities','crops','sessions','bands'].includes(category))p.events=p.events.filter(e=>e.kind!=='query');}
  return changed();
 }
 function summary(id){
  if(accounts[id]?.learning!==true)runtime.delete(id);
  const p=data(id)||pempty(),total=p.modalities.text+p.modalities.voice;
  return {...p,total,weekly:weeklySummary(Array.isArray(p.events)?p.events:[],now(),accounts[id]?.learning===true),preferredMode:ptop(p.modalities),frequentCrop:ptop(p.crops),habitualBand:ptop(p.bands),
   average:p.sessions.length?p.sessions.reduce((n,s)=>n+s.count,0)/p.sessions.length:null,
   sessionQueries:p.sessions.find(s=>s.id===sessionId)?.count||0,
   positive:p.feedback.filter(f=>f.value==='positive').length,negative:p.feedback.filter(f=>f.value==='negative').length,
   difficulty:accounts[id]?.learning===true&&state(id).streak>=2&&!state(id).dismissed};
 }
 return {record,forget,summary,clearRuntime:id=>runtime.delete(id),dismissHelp:id=>{state(id).dismissed=true;}};
}

const pmode=value=>({text:'Texto',voice:'Voz',tie:'Texto y voz por igual'}[value]||'Sin datos suficientes');
const pband=value=>({manana:'Mañana (6–11 h)',tarde:'Tarde (12–18 h)',noche:'Noche (19–5 h)',tie:'Sin una franja predominante'}[value]||'Sin datos suficientes');
export function personalizationView({kind,account,summary:s,cropName,escape:esc}){
 const enabled=account.learning===true;
 const forget=(category,label)=>`<button type="button" class="btn light" data-action="learning-forget" data-category="${category}">Olvidar ${label}</button>`;
 const checkin=`<section class="card personalization"><h2>¿Cómo te sientes hoy?</h2><p>Es opcional. Solo se guarda tu selección y su fecha en este perfil, sin enviarla al servidor.</p>${s.emotion?`<p>Última selección: <strong>${PEMOTIONS[s.emotion.value]||'Sin selección'}</strong> · ${esc(s.emotion.date)}</p>`:'<p>No has indicado cómo te sientes.</p>'}<div class="btnrow">${Object.entries(PEMOTIONS).map(([value,label])=>`<button type="button" class="btn light" data-action="learning-emotion" data-value="${value}" aria-pressed="${s.emotion?.value===value}" ${enabled?'':'disabled'}>${label}</button>`).join('')}${s.emotion?forget('emotion','mi selección'):''}</div>${enabled?'':'<p>Aprendizaje inactivo. Puedes activarlo en Mi perfil para guardar una selección.</p>'}</section>`;
 const help=enabled&&s.difficulty?'<section class="notice personalization" role="status"><p>Es una suposición basada en errores o reintentos, no una emoción confirmada.</p><strong>Parece que esto está costando. ¿Quieres ayuda?</strong><div class="btnrow"><button type="button" class="btn" data-action="show-help">Ver ayuda</button><button type="button" class="btn light" data-action="learning-dismiss-help">Ahora no</button></div></section>':'';
 if(kind==='checkin')return checkin;
 if(kind==='consult')return checkin+help+(enabled&&s.edits>=2?'<p class="notice">Has corregido varias transcripciones. Te sugerimos revisar el texto antes de enviarlo.</p>':'')+(enabled&&s.preferredMode==='voice'&&!account.voice&&!s.voiceOfferDismissed?'<div class="notice personalization"><p>Usas más la voz. ¿Quieres que leamos las nuevas respuestas automáticamente?</p><div class="btnrow"><button type="button" class="btn" data-action="learning-accept-voice">Sí, activar lectura</button><button type="button" class="btn light" data-action="learning-decline-voice">Ahora no</button></div></div>':'');
 if(kind==='home')return weeklyView(s,enabled,cropName,esc)+checkin+help+`<section class="card personalization"><h2>Tu uso de AgroVoz</h2><p>Aprendizaje ${enabled?'activo':'inactivo; los datos anteriores se conservan'}. ${s.total?`${s.total} consultas registradas: ${s.modalities.text} por texto y ${s.modalities.voice} por voz. Modalidad más usada: ${pmode(s.preferredMode)}. En esta sesión: ${s.sessionQueries}.`:'Todavía no hay datos suficientes. Solo contamos usos nuevos con aprendizaje activo.'}</p>${enabled&&s.frequentCrop&&s.frequentCrop!=='tie'?`<p>Cultivo más consultado: <strong>${esc(cropName(s.frequentCrop))}</strong>.</p><button type="button" class="btn" data-action="learning-consult" data-crop="${esc(s.frequentCrop)}">Consultar ${esc(cropName(s.frequentCrop))}</button>`:''}</section>`;
 if(kind!=='profile')return '';
 return `<section class="card personalization"><h2>Lo que AgroVoz ha aprendido de ti</h2><p>Aprendizaje <strong>${enabled?'activo':'inactivo'}</strong>. ${enabled?'Puedes detenerlo con Autorizar sugerencias según uso.':'No se registran nuevos eventos. Tus datos anteriores se conservan.'} Nada se envía a Ollama ni a las salas.</p>${s.total?'':'<p>No hay datos suficientes de consultas nuevas.</p>'}<dl><dt>Consultas por texto y voz</dt><dd>${s.modalities.text} texto · ${s.modalities.voice} voz. Preferida: ${pmode(s.preferredMode)} ${forget('modalities','modalidad')}</dd><dt>Cultivos frecuentes</dt><dd>${Object.entries(s.crops).map(([id,n])=>`${esc(cropName(id))}: ${n}`).join(' · ')||'Sin datos suficientes'} ${forget('crops','cultivos frecuentes')}</dd><dt>Ritmo por sesión</dt><dd>Esta sesión: ${s.sessionQueries}. Promedio: ${s.average===null?'Sin datos suficientes':s.average.toFixed(1)} consultas en las últimas ${s.sessions.length} sesiones con consultas (máximo 100). ${forget('sessions','ritmo')}</dd><dt>Franja habitual</dt><dd>${pband(s.habitualBand)} ${forget('bands','franja')}</dd><dt>Ediciones de transcripciones</dt><dd>${s.edits} ${forget('edits','ediciones')}</dd><dt>Errores del micrófono y reintentos</dt><dd>${s.microphoneErrors} errores de micrófono · ${s.retries} reintentos después de fallos. ${forget('errors','errores y reintentos')}</dd><dt>Emoción declarada</dt><dd>${s.emotion?`${PEMOTIONS[s.emotion.value]||'Sin selección'} · ${esc(s.emotion.date)}`:'Sin selección'} ${forget('emotion','emoción')}</dd><dt>Valoraciones de respuestas</dt><dd>${s.positive} positivas · ${s.negative} negativas (últimas 100 respuestas valoradas). ${forget('feedback','valoraciones')}</dd></dl><button type="button" class="btn danger" data-action="learning-reset">Restablecer aprendizaje</button><p>No borra consultas, fotografías, parcelas, preferencias anteriores ni datos de PostgreSQL. No cambia tu autorización.</p></section>`;
}

function weeklyView(s,enabled,cropName,esc){
 const w=s.weekly;
 return `<section class="card weekly-summary"><h2>Tu semana con AgroVoz</h2><p>Consultas LLM de los últimos siete días, según eventos nuevos con fecha en este perfil.</p>${!enabled?'<p>Aprendizaje inactivo. No se calcula el resumen semanal.</p>':!w?.sufficient?'<p>No hay datos suficientes.</p>':`<p>${w.count} consultas. Cultivo más consultado: ${w.crop==='tie'?'sin predominio':esc(cropName(w.crop))}. Modalidad: ${pmode(w.mode)}.</p>${w.positive+w.negative?`<p>Valoraciones realizadas durante el periodo: ${w.positive} positivas · ${w.negative} negativas.</p>`:'<p>Aún no hay valoraciones fechadas en este periodo.</p>'}${s.eventsTruncated?'<p>Resumen limitado a los últimos 500 eventos retenidos.</p>':''}`}</section>`;
}
