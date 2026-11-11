/* Chrome real mediante CDP integrado, sin dependencias npm ni perfil del usuario.
   Requiere puerto local 8080 libre; usa backend temporal y Ollama. No verifica audio físico. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const net=require('node:net');
const root=path.resolve(__dirname,'..');
const python=path.join(root,'backend/.venv/bin/python');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const children=[];
let socket,profile;
let nextId=0;
const pending=new Map(),listeners=new Map();
const evidencePrefix=process.env.AGROVOZ_EVIDENCE_PREFIX||'FASE_II';
const report={transport:'Chrome headless -> cliente ES module -> HTTP FastAPI -> Ollama real',checks:[],
 voice:'Audio/micrófono físicos y voces del sistema pendientes de revisión manual'};
async function freePort(port){
 await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(resolve));});
}
function launch(command,args,options={}){
 const child=spawn(command,args,{cwd:root,stdio:'ignore',...options});children.push(child);return child;
}
async function ready(url){
 for(let i=0;i<150;i++){try{const response=await fetch(url);if(response.ok)return response;}catch{}await sleep(100);}
 throw new Error('No respondió el servicio local '+url);
}
function send(method,params={}){
 const id=++nextId;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timeout CDP '+method));},150000);
  pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
  socket.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
 return result.result.value;
}
async function until(expression,timeout=140000){
 const started=Date.now();
 while(Date.now()-started<timeout){if(await evaluate(expression))return;await sleep(150);}
 throw new Error('No se cumplió: '+expression);
}
function check(name){report.checks.push(name);console.log('PASS',name);}

(async()=>{
 try{
  await freePort(8080);
  const backendPort=await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
  report.routing='CDP redirige solo el puerto 8000 del cliente a un FastAPI propio en puerto libre; no hay mocks ni se usa el servidor del usuario';
  launch(python,['-m','uvicorn','main:app','--app-dir','backend','--host','127.0.0.1','--port',String(backendPort)],{
   env:{...process.env,AGROVOZ_LLM_BASE_URL:'http://127.0.0.1:11434/v1',AGROVOZ_MODEL:'llama3.2:1b',AGROVOZ_LLM_API_KEY:'',AGROVOZ_LLM_TIMEOUT_SECONDS:'120'}});
  launch(python,['-m','http.server','8080','--bind','127.0.0.1','--directory','AgroVoz-App']);
  await ready(`http://127.0.0.1:${backendPort}/health`);await ready('http://127.0.0.1:8080');
  profile=await fs.mkdtemp(path.join(os.tmpdir(),'agrovoz-chrome-'));
  launch('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run',
   '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1280,1000','about:blank']);
  let debugging;
  for(let i=0;i<150;i++){try{debugging=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{}await sleep(100);}
  if(!debugging)throw new Error('Chrome no inició la automatización');
  const page=await (await fetch(`http://127.0.0.1:${debugging}/json/new?about:blank`,{method:'PUT'})).json();
  socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  socket.onmessage=event=>{
   const message=JSON.parse(event.data);
   if(message.id){const waiter=pending.get(message.id);if(waiter){pending.delete(message.id);message.error?waiter.reject(new Error(JSON.stringify(message.error))):waiter.resolve(message.result);}}
   else for(const listener of listeners.get(message.method)||[])listener(message.params);
  };
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  listeners.set('Fetch.requestPaused',[({requestId,request})=>{
   send('Fetch.continueRequest',{requestId,url:request.url.replace('http://127.0.0.1:8000',`http://127.0.0.1:${backendPort}`)}).catch(console.error);
  }]);
  await send('Fetch.enable',{patterns:[{urlPattern:'http://127.0.0.1:8000/*',requestStage:'Request'}]});
  listeners.set('Page.javascriptDialogOpening',[()=>{send('Page.handleJavaScriptDialog',{accept:true}).catch(console.error);}]);
  const posts=[];const errors=[];
  listeners.set('Network.requestWillBeSent',[({request})=>{if(request.url.endsWith('/api/consult')&&request.method==='POST')posts.push(request);}]);
  listeners.set('Runtime.exceptionThrown',[event=>errors.push(event.exceptionDetails)]);
  await send('Page.navigate',{url:'http://127.0.0.1:8080/#perfil'});
  await until('!!document.getElementById("assistantMode")');
  await evaluate(`document.getElementById('assistantMode').value='server';document.getElementById('assistantMode').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('voicePref').checked=false;document.getElementById('voicePref').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('a[href="#consultar"]').click()`);
  await until('!!document.getElementById("consultForm")');
  const question='Veo pequeños insectos y agujeros en algunas hojas. ¿Puedes confirmar si es una plaga?';
  await evaluate(`document.getElementById('consultCrop').value='maiz';document.getElementById('consultCrop').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('question').value=${JSON.stringify(question)};document.getElementById('question').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('consultForm').requestSubmit()`);
  await until('!!document.querySelector(".query-status[aria-busy=true]")');
  assert.ok(await evaluate(`document.querySelector('.query-status').textContent.includes(${JSON.stringify(question)})`));
  assert.equal(await evaluate('document.querySelector("#consultForm fieldset").disabled'),true);
  await evaluate(`document.getElementById('consultForm').requestSubmit()`);
  check('Pregunta visible y controles bloqueados durante generación');
  await until('location.hash==="#resultado" || document.getElementById("interactionStatus")?.dataset.state==="error"');
  assert.equal(await evaluate('location.hash'),'#resultado',await evaluate('document.getElementById("interactionStatus").textContent'));
  assert.equal(posts.length,1);assert.deepEqual(JSON.parse(posts[0].postData),{crop:'Maíz',question});
  assert.ok(await evaluate('document.body.textContent.includes("LLM · llama3.2:1b")'));
  report.generated_observation=await evaluate('document.querySelector(".result-lead").textContent');
  check('Consulta real en navegador, CORS, contrato, identificación de proveedor y sin duplicado');
  await fs.mkdir(path.join(root,'docs/evidencias'),{recursive:true});
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await fs.writeFile(path.join(root,`docs/evidencias/${evidencePrefix}_NAVEGADOR.png`),Buffer.from(screenshot.data,'base64'));
  await send('Page.reload');await until('!!document.querySelector(".result-lead")');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("agrovozdemo_v3")).accounts.ana.history.length'),1);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("agrovozdemo_v3")).accounts.ana.voice'),false);
  check('Historial y preferencia de lectura persisten tras recarga');
  await send('Network.setBlockedURLs',{urls:['http://127.0.0.1:8000/api/consult',`http://127.0.0.1:${backendPort}/api/consult`]});
  await evaluate(`document.querySelector('a[href="#consultar"]').click()`);
  await until('!!document.getElementById("consultForm")');
  await evaluate(`document.getElementById('question').value=${JSON.stringify(question)};document.getElementById('question').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('consultForm').requestSubmit()`);
  await until('document.getElementById("interactionStatus")?.dataset.state==="error"');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("agrovozdemo_v3")).accounts.ana.history.length'),1);
  assert.equal(await evaluate('document.getElementById("question").value'),question);
  assert.ok(await evaluate('!!document.querySelector("[data-action=retry-query]")'));
  check('Fallo de red conserva pregunta, ofrece reintento y no guarda mock');
  await send('Network.setBlockedURLs',{urls:[]});
  if(process.env.AGROVOZ_PHASE_III==='1')await require('./phase_iii_browser_checks.cjs')({evaluate,send,until,check,report,root,fs});
  await evaluate('navigator.serviceWorker.ready.then(()=>true)');
  await until('!!navigator.serviceWorker.controller');
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await send('Page.reload');await until('!!document.getElementById("consultForm")',15000);
  assert.ok(await evaluate('document.body.textContent.includes("Sin conexión")'));
  const cached=await evaluate(`caches.open('agrovozv3-llm').then(cache=>cache.match('./modules/llm-client.js').then(response=>!!response))`);
  assert.equal(cached,true);check('Recarga offline de PWA con módulo LLM en caché');
  assert.equal(errors.length,0,JSON.stringify(errors));
  report.status='PASS';
 }catch(error){report.status='FAIL';report.error=error.message;console.error(error);process.exitCode=1;}
 finally{
  report.executed_at=new Date().toISOString();
  await fs.mkdir(path.join(root,'docs/evidencias'),{recursive:true});
  await fs.writeFile(path.join(root,`docs/evidencias/${evidencePrefix}_NAVEGADOR.json`),JSON.stringify(report,null,2)+'\n');
  socket?.close();
  for(const child of children.reverse()){child.kill('SIGTERM');}
  // Se conserva el perfil temporal como artefacto local en /tmp; no usa ni borra perfiles del usuario.
 }
})();
