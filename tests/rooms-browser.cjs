/* Chrome real en tres contextos aislados. Lanzar con run_rooms_browser.py.
   Solo redirige el puerto de API al servidor PostgreSQL de prueba; sin mocks. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const net=require('node:net');
const root=path.resolve(__dirname,'..');
const api=process.env.AGROVOZ_ROOMS_TEST_API;
if(process.env.AGROVOZ_ROOMS_BROWSER_ISOLATED!=='1'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(api||'')||api.endsWith(':8000')){
 throw new Error('Usar tests/run_rooms_browser.py con base aislada y puerto temporal.');
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const processes=[],connections=[];
const report={checks:[],transport:'Chrome: contextos A/B/C independientes -> HTTP FastAPI -> PostgreSQL real agrovoz_pc3_test',
 routing:'CDP cambia únicamente el puerto 8000 por el de la API aislada; sin respuestas simuladas',status:'RUNNING'};
function launch(command,args,options={}){const process=spawn(command,args,{cwd:root,stdio:'ignore',...options});processes.push(process);return process;}
async function ready(url){for(let i=0;i<150;i++){try{const result=await fetch(url);if(result.ok)return;}catch{}await sleep(100);}throw new Error('Servidor temporal no respondió');}
async function freePort(port){await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(resolve));});}
async function connect(url){
 const socket=new WebSocket(url);connections.push(socket);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let next=0;const pending=new Map(),listeners=new Map();
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(new Error(message.error.message)):p.resolve(message.result);}}else for(const listener of listeners.get(message.method)||[])listener(message.params);};
 return {on(method,listener){if(!listeners.has(method))listeners.set(method,[]);listeners.get(method).push(listener);},
  send(method,params={}){const id=++next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},20000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});}};
}
const check=name=>{report.checks.push(name);console.log('PASS',name);};
async function createPage(browser,debugPort,name){
 const {browserContextId}=await browser.send('Target.createBrowserContext');
 const {targetId}=await browser.send('Target.createTarget',{url:'about:blank',browserContextId});
 const targets=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
 const target=targets.find(item=>item.id===targetId);assert.ok(target,'Target creado');
 const cdp=await connect(target.webSocketDebuggerUrl);const errors=[],requests=[];let dropNextAlert=false;
 await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Network.enable');
 await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});
 cdp.on('Page.javascriptDialogOpening',()=>{cdp.send('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});});
 cdp.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails.exception?.description?.split('\n')[0]||event.exceptionDetails.text));
 cdp.on('Network.requestWillBeSent',({request})=>{if(request.url.includes('/api/rooms'))requests.push({method:request.method,path:new URL(request.url).pathname});});
 cdp.on('Fetch.requestPaused',async event=>{
  try{
   if(event.responseStatusCode!==undefined){
    if(dropNextAlert&&event.request.method==='POST'&&event.request.url.endsWith('/alerts')){
     dropNextAlert=false;report.response_dropped_after_http=event.responseStatusCode;
     await cdp.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'Failed'});
    }else await cdp.send('Fetch.continueRequest',{requestId:event.requestId});
   }else await cdp.send('Fetch.continueRequest',{requestId:event.requestId,url:event.request.url.replace('http://127.0.0.1:8000',api),interceptResponse:event.request.method==='POST'&&event.request.url.endsWith('/alerts')});
  }catch{/* Una petición abortada al cambiar contexto ya no puede continuarse. */}
 });
 await cdp.send('Fetch.enable',{patterns:[{urlPattern:'http://127.0.0.1:8000/api/rooms*',requestStage:'Request'},
  {urlPattern:api+'/api/rooms/*/alerts',requestStage:'Response'}]});
 async function evaluate(expression){const result=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(`${name}: excepción en script de prueba`);return result.result.value;}
 async function until(expression,timeout=20000){const started=Date.now();while(Date.now()-started<timeout){if(await evaluate(expression))return;await sleep(100);}throw new Error(`${name}: no se cumplió ${expression}`);}
 async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
 async function fill(id,value){await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
 async function change(id,value){await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
 async function submit(id){await evaluate(`document.getElementById(${JSON.stringify(id)}).requestSubmit()`);}
 async function start(){
  await cdp.send('Page.navigate',{url:'http://127.0.0.1:8080/#alertas'});await until('!!document.querySelector("[data-mode=server]")');
  assert.ok(await evaluate('document.body.textContent.includes("Demo local · sin servidor")'));
  await click('[data-action=rooms-mode][data-mode=server]');await until('!!document.getElementById("rooms-register-form")');
  await fill('rooms-display-name','Agricultor '+name);await submit('rooms-register-form');
  try{await until('!!document.getElementById("rooms-create-form")&&!document.querySelector("#rooms-create-form fieldset").disabled');}
  catch(error){report.registration_diagnostic={page:name,status:await evaluate('document.getElementById("rooms-status")?.textContent'),errors,requests};throw error;}
 }
 return {cdp,evaluate,until,click,fill,change,submit,start,errors,requests,
  dropNextAlert(){dropNextAlert=true;},
  metadata:()=>evaluate(`(()=>{const record=JSON.parse(localStorage.getItem('agrovoz_rooms_v1.ana'));return {participant:record.session.participant.id,selected:record.selectedRoomId};})()`)};
}

(async()=>{
 try{
  await freePort(8080);
  launch(path.join(root,'backend/.venv/bin/python'),['-m','http.server','8080','--bind','127.0.0.1','--directory','AgroVoz-App']);
  await ready('http://127.0.0.1:8080');
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'agrovoz-rooms-chrome-'));
  launch('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run',
   '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1280,1000','about:blank']);
  let lines;
  for(let i=0;i<150;i++){try{lines=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{}await sleep(100);}
  assert.ok(lines,'Chrome accesible');
  const browser=await connect(`ws://127.0.0.1:${lines[0]}${lines[1]}`);
  const a=await createPage(browser,lines[0],'A'),b=await createPage(browser,lines[0],'B'),c=await createPage(browser,lines[0],'C');
  await a.start();await b.start();await c.start();
  const [ma,mb,mc]=await Promise.all([a.metadata(),b.metadata(),c.metadata()]);
  assert.equal(new Set([ma.participant,mb.participant,mc.participant]).size,3);
  assert.equal(await b.evaluate('document.querySelectorAll("#rooms-select option").length'),0);
  check('Tres contextos sin localStorage compartido y sesiones demo independientes');
  await a.fill('rooms-name','Papa compartida');await a.submit('rooms-create-form');
  await a.until('!!document.getElementById("rooms-invitation-code")&&!document.querySelector("#rooms-create-form fieldset").disabled');
  const code=await a.evaluate('document.getElementById("rooms-invitation-code").value');assert.ok(/^[A-HJ-NP-Z2-9]{12}$/.test(code));
  const roomId=(await a.metadata()).selected;report.room_id=roomId;
  await b.fill('rooms-join-code',code);await b.submit('rooms-join-form');
  await b.until('!!document.getElementById("rooms-alert-form")');
  assert.equal(await b.evaluate('!!document.getElementById("rooms-invitation-code")'),false);
  assert.equal(await b.evaluate('!!document.querySelector("[data-rooms-action=rotate]")'),false);
  assert.ok(await b.evaluate('document.getElementById("rooms-selected").textContent.includes("Miembro")'));
  await a.click('[data-rooms-action=hide-invitation]');
  check('A crea sala; B se une y ve su rol, sin código del creador ni endpoint inventado');
  await b.until('!!document.getElementById("rooms-sync").textContent.includes("Última lectura")');
  const observation='Observé manchas <img src=x onerror="window.roomsXss=true"> en tres plantas.';
  await a.fill('rooms-alert-text',observation);
  const started=Date.now();await a.submit('rooms-alert-form');await a.submit('rooms-alert-form');
  await a.until('document.querySelectorAll(".rooms-alert").length===1&&!document.querySelector("#rooms-alert-form fieldset").disabled');
  await b.until('document.querySelectorAll(".rooms-alert").length===1');
  report.poll_delivery_ms=Date.now()-started;
  assert.equal(await b.evaluate('document.querySelector(".rooms-alert-text").textContent'),observation);
  assert.equal(await b.evaluate('document.querySelectorAll("#rooms-feed img").length'),0);
  assert.equal(await b.evaluate('window.roomsXss===true'),false);
  assert.equal(await a.evaluate('document.querySelector(".rooms-alert").dataset.alertId'),await b.evaluate('document.querySelector(".rooms-alert").dataset.alertId'));
  check('B recibe por polling la alerta real de A; doble envío bloqueado y texto HTML escapado');
  await b.cdp.send('Page.reload');await b.until('document.querySelectorAll(".rooms-alert").length===1');
  assert.equal((await b.metadata()).participant,mb.participant);check('Recarga conserva token propio y recupera alerta desde PostgreSQL');
  const denied=await c.evaluate(`(async()=>{const s=JSON.parse(localStorage.getItem('agrovoz_rooms_v1.ana')).session;
   const headers={'Authorization':'Bearer '+s.access_token,'Content-Type':'application/json'};
   const route='http://127.0.0.1:8000/api/rooms/${roomId}/alerts';
   const read=await fetch(route,{headers});const write=await fetch(route,{method:'POST',headers,body:JSON.stringify({crop:'papa',text:'No miembro intenta publicar alerta.',client_request_id:crypto.randomUUID()})});
   return [read.status,write.status];})()`);
  assert.deepEqual(denied,[403,403]);report.non_member_statuses=denied;
  check('Tercera sesión no miembro rechazada al leer y publicar: 403/403');
  a.dropNextAlert();await a.fill('rooms-alert-text','Segunda alerta cuyo acuse se perderá.');await a.submit('rooms-alert-form');
  await a.until('!!JSON.parse(localStorage.getItem("agrovoz_rooms_v1.ana")).drafts[JSON.parse(localStorage.getItem("agrovoz_rooms_v1.ana")).selectedRoomId].pending&&!document.querySelector("#rooms-alert-form fieldset").disabled');
  const requestId=await a.evaluate(`JSON.parse(localStorage.getItem('agrovoz_rooms_v1.ana')).drafts['${roomId}'].pending.body.client_request_id`);
  assert.equal(report.response_dropped_after_http,201);
  await a.cdp.send('Page.reload');await a.until('!!document.getElementById("rooms-alert-form")&&!document.querySelector("#rooms-alert-form fieldset").disabled');
  assert.equal(await a.evaluate(`JSON.parse(localStorage.getItem('agrovoz_rooms_v1.ana')).drafts['${roomId}'].pending.body.client_request_id`),requestId);
  await a.submit('rooms-alert-form');await a.until(`JSON.parse(localStorage.getItem('agrovoz_rooms_v1.ana')).drafts['${roomId}'].pending===null`);
  await a.until('document.querySelectorAll(".rooms-alert").length===2');await b.until('document.querySelectorAll(".rooms-alert").length===2');
  report.idempotency_key_survived_reload=true;
  check('Respuesta 201 perdida tras commit: recarga y reintento con mismo UUID, solo dos alertas para dos operaciones');
  const selected=roomId;
  const screenshot=await b.cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await fs.mkdir(path.join(root,'docs/evidencias'),{recursive:true});
  await fs.writeFile(path.join(root,'docs/evidencias/SALAS_FASE_III_COMUNIDAD.png'),Buffer.from(screenshot.data,'base64'));
  await b.change('demoUser','jose');await b.click('[data-action=rooms-mode][data-mode=server]');await b.until('!!document.getElementById("rooms-register-form")');
  assert.equal(await b.evaluate('localStorage.getItem("agrovoz_rooms_v1.jose")!==null'),true);
  assert.equal(await b.evaluate('JSON.parse(localStorage.getItem("agrovoz_rooms_v1.jose")).session||null'),null);
  await b.fill('rooms-display-name','Otro perfil local');await b.submit('rooms-register-form');await b.until('!!document.getElementById("rooms-create-form")&&!document.querySelector("#rooms-create-form fieldset").disabled');
  assert.equal(await b.evaluate('document.querySelectorAll("#rooms-select option").length'),0);
  assert.equal(await b.evaluate('JSON.parse(localStorage.getItem("agrovoz_rooms_v1.ana")).session.access_token===JSON.parse(localStorage.getItem("agrovoz_rooms_v1.jose")).session.access_token'),false);
  await b.change('demoUser','ana');await b.until('document.querySelectorAll(".rooms-alert").length===2');assert.equal((await b.metadata()).participant,mb.participant);
  check('Cambio de perfil usa otra sesión sin salas y recupera la original sin reutilizar su token');
  await a.cdp.send('Network.setBlockedURLs',{urls:['http://127.0.0.1:8000/api/rooms/*',api+'/api/rooms/*']});
  const draft='Borrador que no debe perderse al desconectar el servicio.';
  await a.fill('rooms-alert-text',draft);await a.submit('rooms-alert-form');
  await a.until('document.getElementById("rooms-status").dataset.kind==="error"&&!document.querySelector("#rooms-alert-form fieldset").disabled');
  assert.equal(await a.evaluate('document.getElementById("rooms-alert-text").value'),draft);
  assert.ok(await a.evaluate(`!!JSON.parse(localStorage.getItem('agrovoz_rooms_v1.ana')).drafts['${selected}'].pending`));
  assert.equal(await a.evaluate('document.querySelectorAll(".rooms-alert").length'),2);
  check('Backend inaccesible: error visible y borrador/UUID conservados, sin publicación ficticia');
  await b.click('a[href="#inicio"]');await b.until('!document.getElementById("rooms-root")');await sleep(200);
  const count=b.requests.filter(request=>request.method==='GET'&&request.path.endsWith('/alerts')).length;
  await sleep(4500);
  assert.equal(b.requests.filter(request=>request.method==='GET'&&request.path.endsWith('/alerts')).length,count);
  check('Salir de Comunidad cancela polling; no hay nuevas lecturas después de cuatro segundos');
  assert.ok([a,b,c].every(page=>page.errors.length===0),'Sin excepciones JavaScript no controladas');
  report.participants_distinct=true;report.browser_contexts=3;report.alerts_visible=2;
  report.tokens_and_invitation_codes='no se registran en el informe ni en la captura';report.status='PASS';
 }catch(error){report.status='FAIL';report.error=error.message;console.error(error.message);process.exitCode=1;}
 finally{
  report.executed_at=new Date().toISOString();
  await fs.mkdir(path.join(root,'docs/evidencias'),{recursive:true});
  await fs.writeFile(path.join(root,'docs/evidencias/SALAS_FASE_III_BROWSER.json'),JSON.stringify(report,null,2)+'\n');
  for(const socket of connections)socket.close();for(const process of processes.reverse())process.kill('SIGTERM');
 }
})();
