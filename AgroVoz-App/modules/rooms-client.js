/* Comunidad real: contratos /api/rooms. No conoce db.alerts, voz, fotos ni historial LLM. */
const API = 'http://127.0.0.1:8000/api/rooms';
const CROPS = {papa:'Papa',maiz:'Maíz',tomate:'Tomate',cafe:'Café',trigo:'Trigo',otro:'Otro'};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEQUENCE = /^(0|[1-9][0-9]{0,18})$/;
export const roomsStorageKey = profile => `agrovoz_rooms_v1.${profile}`;
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isSequence = value => typeof value==='string'&&SEQUENCE.test(value)&&BigInt(value)<=9223372036854775807n;
const validRoom = room => room&&UUID.test(room.id)&&typeof room.name==='string'&&
  (room.crop===null||Object.hasOwn(CROPS,room.crop))&&['owner','member'].includes(room.my_role)&&Number.isInteger(room.member_count)&&room.member_count>=1;
const validAlert = (alert,roomId) => alert&&UUID.test(alert.id)&&alert.room_id===roomId&&
  isSequence(alert.sequence)&&BigInt(alert.sequence)>0n&&Object.hasOwn(CROPS,alert.crop)&&typeof alert.text==='string'&&
  alert.author&&UUID.test(alert.author.id)&&typeof alert.author.display_name==='string'&&Number.isFinite(Date.parse(alert.created_at));

export class RoomsAPIError extends Error {
  constructor(status,code,message,retryAfter=0){super(message);this.status=status;this.code=code;this.retryAfter=retryAfter;}
}
class Cancelled extends Error {}
const invalid = () => new RoomsAPIError(0,'invalid_response','El servicio devolvió una respuesta incompleta. Conservamos tu borrador; puedes reintentar.');

export class RoomsClient {
  constructor({storage=globalThis.localStorage,fetchImpl=(...args)=>globalThis.fetch(...args),
    setTimer=(callback,delay)=>globalThis.setTimeout(callback,delay),clearTimer=id=>globalThis.clearTimeout(id),now=()=>Date.now(),makeId=()=>globalThis.crypto.randomUUID(),
    timeoutMs=10000,pollMs=4000,onChange=()=>{}}={}){
    Object.assign(this,{storage,fetchImpl,setTimer,clearTimer,now,makeId,timeoutMs,pollMs,onChange});
    this.profile=null;this.active=false;this.epoch=0;this.readVersion=0;this.controllers=new Set();
    this.timer=null;this.readTask=null;this.busy=false;this.visible=true;this.online=true;
    this.rooms=[];this.alerts=new Map();this.cursor='0';this.failures=0;this.lastSync=null;this.invitation=null;
    this.status={kind:'info',message:'Elige comunidad real para compartir alertas por el servidor.'};
  }
  read(profile){
    try{const value=JSON.parse(this.storage.getItem(roomsStorageKey(profile))||'null');
      return value&&value.version===1&&!Array.isArray(value)?value:{};
    }catch{return {};}
  }
  modeFor(profile){return (profile===this.profile?this.record:this.read(profile))?.mode==='server'?'server':'local';}
  setMode(profile,mode){
    const record=profile===this.profile?this.record:this.read(profile);
    record.version=1;record.mode=mode==='server'?'server':'local';
    if(profile===this.profile){this.stop();this.record=record;this.persist();}
    else{try{this.storage.setItem(roomsStorageKey(profile),JSON.stringify(record));}catch{}}
  }
  setProfile({profile,name='',crop='papa',online=true}){
    if(profile!==this.profile){
      this.stop();this.profile=profile;this.record={version:1,mode:'local',drafts:{},...this.read(profile)};
      if(!this.record.drafts||Array.isArray(this.record.drafts)||typeof this.record.drafts!=='object')this.record.drafts={};
      const session=this.record.session;
      if(!session||!UUID.test(session.participant?.id)||!/^[-\w]{43}$/.test(session.access_token)||
         !Number.isFinite(Date.parse(session.expires_at))||Date.parse(session.expires_at)<=this.now())this.record.session=null;
      this.rooms=[];this.alerts=new Map();this.cursor='0';this.lastSync=null;this.invitation=null;this.failures=0;
      this.registrationName=name;this.createName='';this.createCrop=Object.hasOwn(CROPS,crop)?crop:'papa';this.joinCode='';
      this.status={kind:'info',message:this.record.session?'Sesión demo recuperada. Actualiza tus salas.':'Crea una sesión demo para usar las salas reales.'};
    }
    this.online=online;
  }
  persist(){
    try{this.storage.setItem(roomsStorageKey(this.profile),JSON.stringify(this.record));this.storageWarning='';return true;}
    catch{this.storageWarning='No se pudo guardar en este navegador. La sesión o el borrador podrían perderse al recargar.';return false;}
  }
  notify(){this.onChange(this);}
  message(kind,message){this.status={kind,message};this.notify();}
  get session(){return this.record?.session;}
  get selected(){return this.rooms.find(room=>room.id===this.record?.selectedRoomId)||null;}
  draft(roomId=this.record?.selectedRoomId){
    if(!roomId||!UUID.test(roomId))return {crop:this.createCrop||'papa',text:'',pending:null};
    if(!Object.hasOwn(this.record.drafts,roomId))this.record.drafts[roomId]={crop:this.selected?.crop||'papa',text:'',pending:null};
    return this.record.drafts[roomId];
  }
  stopRead(){
    this.readVersion++;if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;
    this.readController?.abort();this.readController=null;this.readTask=null;this.refreshPending=false;
  }
  stop(){
    this.active=false;this.epoch++;this.stopRead();
    for(const controller of this.controllers)controller.abort();this.controllers.clear();
    this.busy=false;this.invitation=null;this.roomsTask=null;
  }
  async activate(info){
    this.setProfile(info);this.active=true;this.notify();
    if(this.session)await this.loadRooms();
  }
  setVisible(visible){this.visible=visible;if(!visible)this.stopRead();else if(this.active&&this.session)this.refresh();}
  async api(path,{method='GET',body,publicRequest=false,reading=false}={}){
    if(!this.active)throw new Cancelled();
    if(!this.online)throw new RoomsAPIError(0,'offline','Sin conexión al servidor. Tu borrador sigue disponible.');
    const epoch=this.epoch,version=this.readVersion,controller=new AbortController();let timedOut=false;
    this.controllers.add(controller);if(reading)this.readController=controller;
    const timer=this.setTimer(()=>{timedOut=true;controller.abort();},this.timeoutMs);
    try{
      const headers={'Content-Type':'application/json'};
      if(!publicRequest){
        if(!this.session)throw new RoomsAPIError(401,'demo_session_required','Crea otra sesión demo para continuar.');
        headers.Authorization=`Bearer ${this.session.access_token}`;
      }
      const response=await this.fetchImpl(API+path,{method,headers,signal:controller.signal,cache:'no-store',
        ...(body?{body:JSON.stringify(body)}:{})});
      if(!this.active||epoch!==this.epoch||(reading&&version!==this.readVersion))throw new Cancelled();
      let data;try{data=await response.json();}catch{throw invalid();}
      if(!this.active||epoch!==this.epoch||(reading&&version!==this.readVersion))throw new Cancelled();
      if(!response.ok){
        const code=typeof data?.detail?.code==='string'?data.detail.code:'request_failed';
        const messages={401:'Tu sesión demo venció o no es válida. Crea otra para continuar.',
          403:'Tu sesión no es miembro de esta sala o no tiene el rol necesario.',
          404:'No se encontró la sala o el código de invitación ya no está vigente.',
          409:'Esta clave ya se usó con otros datos. Revisa el borrador antes de crear una publicación nueva.',
          422:'Revisa los datos: nombre, cultivo, código y longitud del texto.',
          429:'Se hicieron demasiados intentos de unión. Espera un minuto y vuelve a intentar.',
          503:'El servicio de comunidad no está disponible. Conservamos tu borrador; puedes reintentar.'};
        throw new RoomsAPIError(response.status,code,messages[response.status]||'No se pudo completar la operación. Tu borrador sigue disponible.',
          Math.min(120,Math.max(0,Number(response.headers?.get('Retry-After'))||0))*1000);
      }
      return data;
    }catch(error){
      if(error instanceof Cancelled||!this.active||epoch!==this.epoch||(reading&&version!==this.readVersion))throw new Cancelled();
      if(error instanceof RoomsAPIError)throw error;
      throw new RoomsAPIError(0,timedOut?'timeout':'network',timedOut?
        'Se agotó la espera. El servidor pudo recibir el envío: reintenta el mismo borrador sin cambiar su clave.':
        'No se pudo conectar al servicio de comunidad. Tu borrador sigue disponible; puedes reintentar.');
    }finally{this.clearTimer(timer);this.controllers.delete(controller);if(this.readController===controller)this.readController=null;}
  }
  handleError(error){
    if(error instanceof Cancelled)return;
    if(error.status===401){this.stopRead();this.record.session=null;this.rooms=[];this.alerts.clear();this.persist();}
    this.message('error',error.message||'No se pudo completar la operación.');
  }
  async mutate(action){
    if(this.busy||!this.active)return;
    const epoch=this.epoch;this.busy=true;this.notify();
    try{return await action();}catch(error){if(epoch===this.epoch)this.handleError(error);}
    finally{if(epoch===this.epoch){this.busy=false;this.notify();}}
  }
  async register(name){
    if(this.session)return;
    name=String(name).trim();if(!name||name.length>50){this.message('error','Escribe un nombre de uso de 1 a 50 caracteres.');return;}
    return this.mutate(async()=>{
      this.message('working','Creando sesión demo…');
      const data=await this.api('/participants',{method:'POST',body:{display_name:name},publicRequest:true});
      if(!UUID.test(data?.participant?.id)||typeof data.participant.display_name!=='string'||
         !/^[-\w]{43}$/.test(data.access_token)||!Number.isFinite(Date.parse(data.expires_at)))throw invalid();
      this.record.session={participant:data.participant,access_token:data.access_token,expires_at:data.expires_at};
      this.record.selectedRoomId=null;this.persist();this.message('success','Sesión demo creada. Puedes crear una sala o unirte con un código.');
      await this.loadRooms();
    });
  }
  async loadRooms(){
    if(this.roomsTask)return this.roomsTask;
    if(!this.active||!this.session)return;
    const epoch=this.epoch;
    const task=(async()=>{
      try{
        let offset=0;const rooms=[];
        do{
          const data=await this.api(`?limit=100&offset=${offset}`);
          if(!Array.isArray(data?.items)||!data.items.every(validRoom)||typeof data.has_more!=='boolean')throw invalid();
          rooms.push(...data.items);
          if(!data.has_more)break;
          if(!Number.isInteger(data.next_offset)||data.next_offset<=offset||rooms.length>10000)throw invalid();offset=data.next_offset;
        }while(true);
        this.rooms=rooms;
        const id=rooms.some(room=>room.id===this.record.selectedRoomId)?this.record.selectedRoomId:rooms[0]?.id||null;
        if(id!==this.record.selectedRoomId){this.stopRead();this.alerts.clear();this.cursor='0';this.lastSync=null;this.invitation=null;this.record.selectedRoomId=id;this.persist();}
        this.notify();if(id)this.refresh();
      }catch(error){if(epoch===this.epoch)this.handleError(error);}
      finally{if(epoch===this.epoch)this.roomsTask=null;}
    })();
    this.roomsTask=task;return task;
  }
  async createRoom(name,crop){
    if(!this.session)return;
    const pending=this.record.creationPending;
    if(!pending&&(!String(name).trim()||String(name).trim().length>80)){this.message('error','Escribe un nombre de sala de 1 a 80 caracteres.');return;}
    if(pending&&pending.author!==this.session.participant.id){this.message('error','La creación pendiente pertenece a otra sesión. Revísala antes de iniciar una nueva.');return;}
    return this.mutate(async()=>{
      if(!this.record.creationPending)this.record.creationPending={author:this.session.participant.id,
        body:{name:String(name).trim(),crop:crop||null,client_request_id:this.makeId()}};
      this.persist();this.message('working','Creando sala. Espera la confirmación del servidor…');
      const data=await this.api('',{method:'POST',body:this.record.creationPending.body});
      if(!validRoom(data?.room)||data.room.my_role!=='owner'||typeof data.replayed!=='boolean'||
         !(data.join_code===null||/^[A-HJ-NP-Z2-9]{12}$/.test(data.join_code)))throw invalid();
      this.record.creationPending=null;this.createName='';this.record.selectedRoomId=data.room.id;
      this.stopRead();this.alerts.clear();this.cursor='0';this.lastSync=null;
      this.invitation=data.join_code?{roomId:data.room.id,code:data.join_code}:null;this.persist();
      this.message('success',data.replayed?'Sala recuperada sin duplicarla. Genera otro código si perdiste el anterior.':'Sala creada. Comparte el código únicamente con quienes deseas invitar.');
      await this.loadRooms();
    });
  }
  async joinRoom(code){
    code=String(code).trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{12}$/.test(code)){this.message('error','Escribe el código de invitación de 12 letras y números.');return;}
    return this.mutate(async()=>{
      this.message('working','Solicitando unión a la sala…');
      const data=await this.api('/join',{method:'POST',body:{join_code:code}});
      if(!validRoom(data?.room)||typeof data.already_member!=='boolean')throw invalid();
      this.stopRead();this.alerts.clear();this.cursor='0';this.lastSync=null;this.invitation=null;
      this.record.selectedRoomId=data.room.id;this.joinCode='';this.persist();
      this.message('success',data.already_member?'Ya pertenecías a esta sala. No se duplicó tu membresía.':'Ya eres miembro de la sala.');
      await this.loadRooms();
    });
  }
  selectRoom(id){
    if(!this.rooms.some(room=>room.id===id))return;
    this.stopRead();this.record.selectedRoomId=id;this.alerts.clear();this.cursor='0';this.lastSync=null;this.invitation=null;
    this.persist();this.notify();this.refresh();
  }
  updateDraft(crop,text){
    const draft=this.draft();if(draft.pending||this.busy)return;
    if(Object.hasOwn(CROPS,crop))draft.crop=crop;draft.text=String(text).slice(0,500);this.persist();
  }
  async publish(){
    const room=this.selected;if(!room||!this.session)return;
    const draft=this.draft(room.id);
    if(draft.pending&&draft.pending.author!==this.session.participant.id){this.message('error','El envío pendiente pertenece a otra sesión. Revisa el resultado antes de publicar con la nueva.');return;}
    if(!draft.pending&&(draft.text.trim().length<12||draft.text.trim().length>500||!Object.hasOwn(CROPS,draft.crop))){this.message('error','Describe tu observación con 12 a 500 caracteres y elige un cultivo.');return;}
    return this.mutate(async()=>{
      if(!draft.pending)draft.pending={author:this.session.participant.id,body:{crop:draft.crop,text:draft.text.trim(),client_request_id:this.makeId()}};
      this.persist();this.message('working','Enviando alerta. Aún no está confirmada como publicada…');
      const data=await this.api(`/${room.id}/alerts`,{method:'POST',body:draft.pending.body});
      if(!validAlert(data?.alert,room.id)||typeof data.replayed!=='boolean')throw invalid();
      // Una publicación propia NO adelanta el cursor de lectura.
      this.alerts.set(data.alert.id,data.alert);draft.text='';draft.pending=null;this.persist();
      this.message('success',data.replayed?'Publicación confirmada sin duplicarla.':'Publicado: el servidor confirmó y guardó tu alerta.');this.refresh();
    });
  }
  async rotateInvitation(){
    const room=this.selected;if(!room||room.my_role!=='owner')return;
    return this.mutate(async()=>{
      const data=await this.api(`/${room.id}/invitations`,{method:'POST'});
      if(data?.room_id!==room.id||!/^[A-HJ-NP-Z2-9]{12}$/.test(data.join_code))throw invalid();
      this.invitation={roomId:room.id,code:data.join_code};this.message('success','Nuevo código generado. El anterior ya no admite nuevas uniones.');
    });
  }
  schedule(delay){
    if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;
    if(!this.active||!this.visible||!this.session||!this.selected)return;
    this.timer=this.setTimer(()=>{this.timer=null;this.refresh();},delay);
  }
  async refresh(){
    if(!this.active||!this.visible||!this.session||!this.selected)return;
    if(this.readTask){this.refreshPending=true;return this.readTask;}
    if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;
    const epoch=this.epoch,version=this.readVersion,roomId=this.selected.id;
    let delay=this.pollMs;
    const task=(async()=>{
      try{
        let more;
        do{
          const previous=this.cursor;
          const data=await this.api(`/${roomId}/alerts?after_sequence=${previous}&limit=50`,{reading:true});
          if(!Array.isArray(data?.items)||!data.items.every(alert=>validAlert(alert,roomId))||
             !isSequence(data.next_after)||typeof data.has_more!=='boolean'||
             data.next_after!==(data.items.at(-1)?.sequence||previous)||(data.has_more&&!data.items.length))throw invalid();
          let last=BigInt(previous),added=0;
          for(const alert of data.items){if(BigInt(alert.sequence)<=last)throw invalid();last=BigInt(alert.sequence);
            if(!this.alerts.has(alert.id))added++;this.alerts.set(alert.id,alert);}
          this.cursor=data.next_after;more=data.has_more;this.lastSync=this.now();this.failures=0;
          if(added&&!this.busy)this.status={kind:'success',message:`${added} alerta(s) recibida(s) del servidor.`};
          this.notify();
        }while(more);
      }catch(error){
        if(!(error instanceof Cancelled)&&epoch===this.epoch&&version===this.readVersion){
          this.failures++;delay=Math.max(error.retryAfter||0,Math.min(30000,this.pollMs*2**Math.min(this.failures,3)));
          if(error.status===403||error.status===404){this.alerts.clear();this.stopRead();}
          this.handleError(error);
        }
      }finally{
        if(epoch===this.epoch&&version===this.readVersion){this.readTask=null;const refresh=this.refreshPending;this.refreshPending=false;this.schedule(refresh?0:delay);}
      }
    })();
    this.readTask=task;return task;
  }
}

const cropOptions = selected => Object.entries(CROPS).map(([id,name])=>`<option value="${id}" ${id===selected?'selected':''}>${name}</option>`).join('');
const formatDate = value => Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('es-PE'):'Fecha no disponible';

export function createRoomsCommunity(options={}){
  const client=new RoomsClient(options);let root=null;const html=new Map();
  const setHTML=(id,value)=>{
    const element=root?.querySelector(`#${id}`);if(!element||html.get(id)===value)return;
    const focused=element.contains(element.ownerDocument.activeElement)?element.ownerDocument.activeElement:null;
    const focusId=focused?.id,start=focused?.selectionStart,end=focused?.selectionEnd;
    element.innerHTML=value;html.set(id,value);
    if(focusId){const next=element.querySelector(`#${focusId}`);if(next&&!next.disabled){next.focus();if(typeof start==='number'&&next.setSelectionRange)next.setSelectionRange(start,end);}}
  };
  const render=()=>{
    if(!root)return;
    const session=client.session,room=client.selected,busy=client.busy,draft=client.draft(),creation=client.record?.creationPending;
    root.querySelector('#rooms-status').textContent=client.status.message;
    root.querySelector('#rooms-status').dataset.kind=client.status.kind;
    root.querySelector('#rooms-storage-warning').textContent=client.storageWarning||'';
    setHTML('rooms-session',session?`<p><strong>Sesión demo:</strong> ${esc(session.participant.display_name)}</p><p class="subtle">Vence: ${esc(formatDate(session.expires_at))}. No verifica tu identidad personal.</p>`:
      `<form id="rooms-register-form"><label for="rooms-display-name">Nombre de uso para esta sesión demo</label><input id="rooms-display-name" name="display_name" class="field" maxlength="50" required value="${esc(client.registrationName)}" ${busy?'disabled':''}><button class="btn" type="submit" ${busy?'disabled':''}>Crear sesión demo</button></form>`);
    setHTML('rooms-actions',session?`<div class="grid two"><div class="card"><h2>Crear una sala</h2><form id="rooms-create-form"><fieldset class="rooms-fields" ${busy?'disabled':''}><legend class="rooms-sr-only">Datos de la nueva sala</legend><div class="formrow"><label for="rooms-name">Nombre de la sala</label><input id="rooms-name" name="name" class="field" maxlength="80" required value="${esc(creation?.body.name||client.createName)}" ${creation?'readonly':''}></div><div class="formrow"><label for="rooms-create-crop">Cultivo de la sala</label><select id="rooms-create-crop" name="crop" class="field" ${creation?'disabled':''}>${cropOptions(creation?.body.crop||client.createCrop)}</select></div><button class="btn" type="submit">${creation?'Reintentar creación':'Crear sala'}</button>${creation?'<button class="btn light" type="button" data-rooms-action="edit-creation">Revisar como otra creación</button>':''}</fieldset></form></div><div class="card"><h2>Unirme a una sala</h2><form id="rooms-join-form"><label for="rooms-join-code">Código de invitación</label><input id="rooms-join-code" name="code" class="field" minlength="12" maxlength="12" pattern="[A-HJ-NP-Za-hj-np-z2-9]{12}" required autocomplete="off" value="${esc(client.joinCode)}" ${busy?'disabled':''}><button class="btn secondary" type="submit" ${busy?'disabled':''}>Unirme con código</button></form><p class="subtle">Pide el código al creador. No compartiremos tu historial ni fotografías.</p></div></div>`:'');
    setHTML('rooms-list',session?`<h2>Mis salas</h2><button type="button" class="btn small light" data-rooms-action="refresh-rooms" ${busy?'disabled':''}>Actualizar mis salas</button>${client.rooms.length?`<label for="rooms-select">Sala que deseas consultar</label><select id="rooms-select" class="field">${client.rooms.map(item=>`<option value="${esc(item.id)}" ${item.id===room?.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select>`:'<p>No tienes salas disponibles. Crea una o únete con un código.</p>'}`:'');
    const invitation=client.invitation?.roomId===room?.id&&room?.my_role==='owner'?client.invitation:null;
    setHTML('rooms-invitation',invitation?`<div class="notice"><label for="rooms-invitation-code">Código generado: compártelo solo con tus invitados</label><input id="rooms-invitation-code" class="field" readonly value="${esc(invitation.code)}"><p>No se guarda en este navegador. El resto de miembros no puede consultarlo.</p><button class="btn small light" type="button" data-rooms-action="hide-invitation">Ocultar código</button></div>`:'');
    setHTML('rooms-selected',room?`<h2>${esc(room.name)}</h2><p><strong>Tu rol:</strong> ${room.my_role==='owner'?'Creador':'Miembro'} · <strong>Participantes al actualizar salas:</strong> ${room.member_count}</p><p class="subtle">La API informa el total y tu rol; no ofrece una lista completa de nombres de miembros.</p>${room.my_role==='owner'?`<button class="btn small light" type="button" data-rooms-action="rotate" ${busy?'disabled':''}>Generar otro código de invitación</button>`:''}`:'');
    setHTML('rooms-compose',room&&session?`<form id="rooms-alert-form"><fieldset class="rooms-fields" ${busy?'disabled':''}><legend>Compartir una observación</legend><div class="formrow"><label for="rooms-alert-crop">Cultivo observado</label><select id="rooms-alert-crop" name="crop" class="field" ${draft.pending?'disabled':''}>${cropOptions(draft.crop)}</select></div><div class="formrow"><label for="rooms-alert-text">Texto de la alerta (12 a 500 caracteres)</label><textarea id="rooms-alert-text" name="text" class="field" minlength="12" maxlength="500" required ${draft.pending?'readonly':''}>${esc(draft.text)}</textarea></div>${draft.pending?'<p class="notice">Hay un envío pendiente de confirmación. Reintenta sin cambiar sus datos para evitar duplicados.</p>':''}<button id="rooms-publish" class="btn" type="submit">${draft.pending?'Reintentar publicación':'Revisar y publicar'}</button>${draft.pending?'<button class="btn light" type="button" data-rooms-action="edit-alert">Editar como nueva alerta</button>':''}</fieldset></form>`:'');
    const alerts=[...client.alerts.values()].sort((a,b)=>BigInt(a.sequence)<BigInt(b.sequence)?-1:1);
    setHTML('rooms-feed',room?`<h2>Alertas de esta sala</h2><p class="subtle">Solo se muestran observaciones confirmadas por el servidor. No son diagnósticos.</p><div class="list">${alerts.length?alerts.map(alert=>`<article class="listitem rooms-alert" data-alert-id="${esc(alert.id)}"><div><strong>${esc(CROPS[alert.crop])} · ${esc(alert.author.display_name)}</strong><p class="rooms-alert-text">${esc(alert.text)}</p><small>${esc(formatDate(alert.created_at))}</small></div><span class="tag">Servidor</span></article>`).join(''):'<p>Aún no se recibieron alertas. No se importan avisos de la demo local.</p>'}</div>`:'');
    const sync=root.querySelector('#rooms-sync');sync.textContent=room?(client.lastSync?`Última lectura: ${new Date(client.lastSync).toLocaleTimeString('es-PE')}. Se consulta aproximadamente cada 4 segundos.`:'Esperando la primera lectura del servidor…'):'';
  };
  client.onChange=render;
  const confirmAction=options.confirm||((message)=>globalThis.confirm(message));
  const bind=()=>{
    root.addEventListener('input',event=>{
      const el=event.target;
      if(el.id==='rooms-display-name')client.registrationName=el.value;
      if(el.id==='rooms-name')client.createName=el.value;
      if(el.id==='rooms-join-code')client.joinCode=el.value;
      if(el.id==='rooms-alert-text')client.updateDraft(client.draft().crop,el.value);
    });
    root.addEventListener('change',event=>{
      const el=event.target;
      if(el.id==='rooms-create-crop')client.createCrop=el.value;
      if(el.id==='rooms-select')client.selectRoom(el.value);
      if(el.id==='rooms-alert-crop')client.updateDraft(el.value,client.draft().text);
    });
    root.addEventListener('submit',event=>{
      event.preventDefault();if(client.busy)return;
      const form=event.target;
      if(form.id==='rooms-register-form')client.register(form.elements.display_name.value);
      if(form.id==='rooms-join-form')client.joinRoom(form.elements.code.value);
      if(form.id==='rooms-create-form'&&confirmAction('Se creará una sala real en el servidor. ¿Confirmas el nombre y cultivo?'))client.createRoom(form.elements.name.value,client.record.creationPending?.body.crop||form.elements.crop.value);
      if(form.id==='rooms-alert-form'&&confirmAction(`Revisa antes de compartir con ${client.selected?.name}:\n\n${client.draft().pending?.body.text||client.draft().text}\n\nSolo se envía cultivo y texto. ¿Confirmas?`))client.publish();
    });
    root.addEventListener('click',event=>{
      const action=event.target.closest('[data-rooms-action]')?.dataset.roomsAction;if(!action)return;
      if(action==='refresh-rooms')client.loadRooms();
      if(action==='refresh')client.loadRooms();
      if(action==='hide-invitation'){client.invitation=null;render();}
      if(action==='rotate'&&confirmAction('El nuevo código invalidará el anterior para nuevas uniones. ¿Continuar?'))client.rotateInvitation();
      if(action==='edit-alert'&&confirmAction('El envío anterior pudo publicarse. Comprueba las alertas antes de crear otro. ¿Editar como una nueva publicación?')){client.draft().pending=null;client.persist();render();}
      if(action==='edit-creation'&&confirmAction('La sala anterior pudo haberse creado. Revisa Mis salas antes de crear otra. ¿Revisar una creación nueva?')){client.record.creationPending=null;client.persist();render();}
    });
  };
  const visibility=()=>client.setVisible(!globalThis.document?.hidden);
  globalThis.document?.addEventListener('visibilitychange',visibility);
  return {
    client,
    isReal:profile=>client.modeFor(profile)==='server',
    chooseMode:(profile,mode)=>client.setMode(profile,mode),
    selector:profile=>`<section class="card rooms-mode" aria-label="Modo de comunidad"><div class="btnrow"><button type="button" class="btn secondary" data-action="rooms-mode" data-mode="local" aria-pressed="${client.modeFor(profile)==='local'}">Demo local · sin servidor</button><button type="button" class="btn" data-action="rooms-mode" data-mode="server" aria-pressed="${client.modeFor(profile)==='server'}">Comunidad real · PostgreSQL</button></div><p class="subtle">${client.modeFor(profile)==='server'?'Las alertas confirmadas se comparten con los miembros de la sala.':'La demo PC2 solo comparte perfiles de este navegador; no es colaboración entre dispositivos.'}</p></section>`,
    sync(nextRoot,info){
      if(root===nextRoot&&client.profile===info.profile&&client.online===info.online)return;
      client.stop();root=nextRoot;html.clear();client.setProfile(info);client.roomsTask=null;
      if(!root)return;
      root.innerHTML=`<div class="banner warn"><strong>Comunidad real · sesión de demostración</strong><p>No es una cuenta con identidad personal verificada. No compartas información sensible. Las alertas locales PC2 no se suben automáticamente.</p></div><p id="rooms-status" role="status" aria-live="polite" aria-atomic="true"></p><p id="rooms-storage-warning" class="notice"></p><section id="rooms-session" class="card"></section><div id="rooms-actions"></div><section id="rooms-list" class="card"></section><div id="rooms-invitation"></div><section class="card"><div id="rooms-selected"></div><div id="rooms-compose"></div><p id="rooms-sync" class="subtle"></p><button class="btn small light" type="button" data-rooms-action="refresh">Reintentar / actualizar</button><div id="rooms-feed"></div></section>`;
      bind();client.visible=!globalThis.document?.hidden;client.activate(info);render();
    },
    destroy(){client.stop();root=null;globalThis.document?.removeEventListener('visibilitychange',visibility);},
  };
}
