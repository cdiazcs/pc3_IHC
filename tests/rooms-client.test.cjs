/* Unitarios de estado/transporte con reloj simulado; no acreditan persistencia PostgreSQL. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const loaded=import(pathToFileURL(path.join(__dirname,'../AgroVoz-App/modules/rooms-client.js')));
const A='11111111-1111-4111-8111-111111111111',B='44444444-4444-4444-8444-444444444444';
const R='22222222-2222-4222-8222-222222222222',R2='77777777-7777-4777-8777-777777777777';
const ID='55555555-5555-4555-8555-555555555555';
const room={id:R,name:'Sala de papa',crop:'papa',created_at:'2026-11-11T12:00:00Z',my_role:'owner',member_count:1};
const session=id=>({participant:{id,display_name:id===A?'A':'B'},access_token:(id===A?'A':'B').repeat(43),expires_at:'2099-01-01T00:00:00Z'});
const alert=(sequence='1',id='66666666-6666-4666-8666-666666666666',roomId=R)=>({id,room_id:roomId,sequence,author:{id:A,display_name:'A'},crop:'papa',text:'Observación de hojas con manchas.',created_at:'2026-11-11T12:00:00Z'});
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value,headers:{get:()=>null}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

async function harness(t,handler,{store=new Map(),withSession=true}={}){
 const {RoomsClient,roomsStorageKey}=await loaded;let id=0;
 const timers=new Map(),calls=[];
 const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
 if(withSession&&!store.has(roomsStorageKey('ana')))storage.setItem(roomsStorageKey('ana'),JSON.stringify({version:1,mode:'server',session:session(A),drafts:{},selectedRoomId:R}));
 const client=new RoomsClient({storage,makeId:()=>ID,setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),fetchImpl:async(url,options)=>{
  const call={url,method:options.method,body:options.body?JSON.parse(options.body):null,headers:options.headers,signal:options.signal};calls.push(call);
  const custom=handler?.(call,client);if(custom!==undefined)return custom;
  if(url.includes('?limit=100'))return response({items:[room],has_more:false,next_offset:null});
  if(url.includes('/alerts?')){const cursor=new URL(url).searchParams.get('after_sequence');return response({items:[],next_after:cursor,has_more:false});}
  throw new Error('Petición no prevista');
 }});
 t.after(()=>client.stop());
 await client.activate({profile:'ana',name:'A',crop:'papa',online:true});await flush();
 return {client,store,calls,timers,storage,roomsStorageKey,flush,
  tick:async(ms)=>{const entry=[...timers].find(([key,value])=>value.ms===ms);assert.ok(entry,`No hay timer ${ms}`);timers.delete(entry[0]);entry[1].fn();await flush();}};
}

test('Registro explícito: un POST, token bajo clave de perfil y sin datos demo adjuntos',async t=>{
 const wait=deferred();const h=await harness(t,call=>call.url.endsWith('/participants')?wait.promise:undefined,{withSession:false});
 const pending=h.client.register('Agricultor A');await h.client.register('Otra repetición');
 assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].body,{display_name:'Agricultor A'});
 wait.resolve(response({...session(A),token_type:'bearer'},201));await pending;
 const stored=JSON.parse(h.store.get(h.roomsStorageKey('ana')));
 assert.equal(stored.session.access_token,session(A).access_token);assert.equal(stored.version,1);
 assert.equal(h.calls.filter(call=>call.url.endsWith('/participants')).length,1);
});

test('Cambio de perfil nunca reutiliza credenciales y cancela lecturas anteriores',async t=>{
 const h=await harness(t);
 h.storage.setItem(h.roomsStorageKey('jose'),JSON.stringify({version:1,mode:'server',session:session(B),drafts:{}}));
 const before=h.calls.length;h.client.stop();await h.client.activate({profile:'jose',name:'B',online:true});await h.flush();
 assert.ok(h.calls.slice(before).every(call=>call.headers.Authorization===`Bearer ${session(B).access_token}`));
 assert.equal(JSON.parse(h.store.get(h.roomsStorageKey('ana'))).session.participant.id,A);
});

test('Publicación solo se confirma tras HTTP, bloquea duplicados y no adelanta cursor propio',async t=>{
 const wait=deferred();const h=await harness(t,call=>call.method==='POST'&&call.url.endsWith('/alerts')?wait.promise:undefined);
 h.client.updateDraft('papa','Observé manchas en tres plantas.');
 const pending=h.client.publish();await h.client.publish();
 assert.equal(h.calls.filter(call=>call.method==='POST').length,1);
 assert.equal(h.client.status.kind,'working');assert.equal(h.client.alerts.size,0);
 wait.resolve(response({alert:alert('3'),replayed:false},201));await pending;await h.flush();
 assert.equal(h.client.alerts.size,1);assert.equal(h.client.cursor,'0');assert.match(h.client.status.message,/Publicado/);
 assert.equal(h.client.draft().text,'');assert.equal(h.client.draft().pending,null);
});

test('Respuesta perdida: conserva borrador/UUID incluso tras recargar y replay no duplica',async t=>{
 let writes=0;const h=await harness(t,call=>{
  if(call.method==='POST'&&call.url.endsWith('/alerts')){writes++;if(writes===1)throw new TypeError('network');return response({alert:alert(),replayed:true});}
 });
 h.client.updateDraft('papa','Observé manchas en tres plantas.');await h.client.publish();
 const first=h.calls.find(call=>call.method==='POST').body;
 assert.equal(h.client.draft().pending.body.client_request_id,ID);assert.notEqual(h.client.draft().text,'');
 h.client.stop();
 const next=await harness(t,call=>call.method==='POST'?response({alert:alert(),replayed:true}):undefined,{store:h.store});
 await next.client.publish();
 assert.deepEqual(next.calls.find(call=>call.method==='POST').body,first);assert.equal(next.client.alerts.size,1);
 assert.match(next.client.status.message,/sin duplicarla/);
});

test('Errores HTTP y JSON inválido preservan el envío pendiente; no hay éxito local ficticio',async t=>{
 for(const status of [403,409,422,503]){
  const h=await harness(t,call=>call.method==='POST'?response({detail:{code:'error'}},status):undefined);
  h.client.updateDraft('papa','Observación con suficiente texto.');await h.client.publish();
  assert.equal(h.client.alerts.size,0);assert.equal(h.client.status.kind,'error');assert.ok(h.client.draft().pending);
 }
 const h=await harness(t,call=>call.method==='POST'?response({alert:{text:'incompleta'}}):undefined);
 h.client.updateDraft('papa','Observación con suficiente texto.');await h.client.publish();assert.equal(h.client.status.kind,'error');assert.ok(h.client.draft().pending);
});

test('Modo offline no envía POST y mantiene borrador para reconectar',async t=>{
 const h=await harness(t);h.client.online=false;h.client.updateDraft('maiz','Hay insectos en varias hojas.');
 await h.client.publish();assert.equal(h.calls.filter(call=>call.method==='POST').length,0);
 assert.equal(h.client.draft().text,'Hay insectos en varias hojas.');assert.ok(h.client.draft().pending);
 assert.match(h.client.status.message,/Sin conexión/);
});

test('Polling secuencial sin solapamiento y cancelación al salir',async t=>{
 const wait=deferred();const h=await harness(t,call=>call.url.includes('/alerts?')?wait.promise:undefined);
 assert.equal(h.calls.filter(call=>call.url.includes('/alerts?')).length,1);
 h.client.refresh();h.client.refresh();assert.equal(h.calls.filter(call=>call.url.includes('/alerts?')).length,1);
 const signal=h.calls.at(-1).signal;h.client.stop();assert.equal(signal.aborted,true);
 wait.resolve(response({items:[alert()],next_after:'1',has_more:false}));await h.flush();
 assert.equal(h.client.alerts.size,0);assert.equal(h.timers.size,0);
});

test('Backoff en lecturas fallidas: 8, 16 y 30 segundos; éxito vuelve a 4',async t=>{
 let fail=true;const h=await harness(t,call=>call.url.includes('/alerts?')&&fail?response({detail:{code:'database_unavailable'}},503):undefined);
 await h.tick(8000);await h.tick(16000);assert.ok([...h.timers.values()].some(timer=>timer.ms===30000));
 fail=false;await h.tick(30000);assert.ok([...h.timers.values()].some(timer=>timer.ms===4000));
});

test('Paginación por cursor y deduplicación de alerta ya recibida por POST',async t=>{
 const h=await harness(t);h.client.alerts.set(alert('2').id,alert('2'));
 let pages=0;h.client.fetchImpl=async()=>{
  pages++;if(pages===1)return response({items:[alert('1','88888888-8888-4888-8888-888888888888')],next_after:'1',has_more:true});
  return response({items:[alert('2')],next_after:'2',has_more:false});
 };
 await h.client.refresh();assert.equal(pages,2);assert.equal(h.client.alerts.size,2);assert.equal(h.client.cursor,'2');
});

test('Cambiar sala descarta respuesta tardía del feed anterior',async t=>{
 const wait=deferred();const h=await harness(t,call=>call.url.includes(`/${R}/alerts?`)?wait.promise:undefined);
 h.client.rooms.push({...room,id:R2,name:'Otra sala'});h.client.selectRoom(R2);await h.flush();
 wait.resolve(response({items:[alert()],next_after:'1',has_more:false}));await h.flush();
 assert.equal(h.client.selected.id,R2);assert.equal(h.client.alerts.size,0);assert.equal(h.client.cursor,'0');
});

test('Timeout conserva clave idempotente y texto',async t=>{
 const h=await harness(t,call=>call.method==='POST'?new Promise((resolve,reject)=>call.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})):undefined);
 h.client.updateDraft('papa','Observación agrícola con manchas.');const pending=h.client.publish();await h.tick(10000);await pending;
 assert.ok(h.client.draft().pending);assert.match(h.client.status.message,/agotó la espera/);
});

test('Creación repetida tras error usa misma clave y no persiste código de invitación',async t=>{
 let attempts=0;const h=await harness(t,call=>{
  if(call.method==='POST'&&call.url.endsWith('/api/rooms')){attempts++;if(attempts===1)throw new TypeError('network');return response({room,join_code:null,replayed:true});}
 });
 await h.client.createRoom(room.name,'papa');const request=h.calls.find(call=>call.method==='POST').body;
 await h.client.createRoom('Nombre ignorado en replay','maiz');
 const writes=h.calls.filter(call=>call.method==='POST');assert.deepEqual(writes[1].body,request);
 assert.equal(h.client.record.creationPending,null);assert.equal(h.client.invitation,null);
 assert.ok(!h.store.get(h.roomsStorageKey('ana')).includes('join_code'));
});

test('Sesión no válida se borra solo del perfil actual sin perder borrador',async t=>{
 const h=await harness(t);h.client.updateDraft('papa','Observación agrícola con manchas.');
 h.client.fetchImpl=async()=>response({detail:{code:'demo_session_required'}},401);await h.client.refresh();
 assert.equal(h.client.session,null);assert.equal(h.client.draft().text,'Observación agrícola con manchas.');
 assert.equal(h.timers.size,0);assert.equal(h.client.status.kind,'error');
});

test('Fase 2: aviso sensorial solo después de HTTP válido; nunca en error ni replay',async t=>{
 const wait=deferred();let phase='waiting',notices=0;
 const h=await harness(t,call=>call.method==='POST'&&call.url.endsWith('/alerts')?(phase==='waiting'?wait.promise:phase==='error'?response({detail:{code:'unavailable'}},503):response({alert:alert(),replayed:true},200)):undefined);
 h.client.onPublished=()=>{notices++;};h.client.updateDraft('papa','Observación para comprobar el acuse verdadero.');
 const pending=h.client.publish();await flush();assert.equal(notices,0);assert.equal(h.client.status.kind,'working');
 wait.resolve(response({alert:alert(),replayed:false},201));await pending;assert.equal(notices,1);assert.equal(h.client.status.kind,'success');
 phase='error';h.client.updateDraft('papa','Otra alerta que fallará antes de publicarse.');await h.client.publish();assert.equal(notices,1);assert.equal(h.client.status.kind,'error');
 phase='replay';await h.client.publish();assert.equal(notices,1);assert.equal(h.client.status.kind,'success');
});
