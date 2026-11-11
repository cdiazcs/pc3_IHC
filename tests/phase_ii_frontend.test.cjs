/* Lógica de flujo en DOM simulado; no prueba micrófono ni audio reales. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const source=fs.readFileSync(path.join(__dirname,'../AgroVoz-App/app.js'),'utf8')
 .replace("import {consultLLM} from './modules/llm-client.js';",'');
const modulePromise=import(pathToFileURL(path.join(__dirname,'../AgroVoz-App/modules/llm-client.js')));
const advice={headline:'Orientación',observation:'No puedo confirmar una causa. Observa las hojas.',steps:['Registra desde cuándo ocurre.'],source:'LLM sin RAG',limitations:'No es diagnóstico.',provider:'llama3.2:1b'};
const question='Las hojas están amarillas desde ayer';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};

async function harness(fetchImpl,options={}){
 const {consultLLM}=await modulePromise;
 const handlers={},store=options.store||new Map(),app={innerHTML:''},status={textContent:'' ,dataset:{},focus(){this.focused=true;}},input={value:'',focus(){this.focused=true;}};
 const document={getElementById:id=>({app,interactionStatus:status,question:input}[id]||null),
  addEventListener:(name,fn)=>handlers[name]=fn,querySelector:()=>null,querySelectorAll:()=>[],
  createElement:()=>({setAttribute(){},remove(){}}),body:{appendChild(){}}};
 let confirmed=true,confirmations=0;
 const location={hash:'#consultar',protocol:'http:',hostname:'localhost'};
 const window={addEventListener:(name,fn)=>handlers['window-'+name]=fn,scrollTo(){}};
 const context={document,window,location,navigator:{onLine:true},console,AbortController,crypto:require('node:crypto').webcrypto,
  localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))},
  setTimeout:()=>1,clearTimeout(){},confirm:()=>{confirmations++;return confirmed;},
  consultLLM:(payload,options)=>consultLLM(payload,{...options,fetchImpl})};
 vm.createContext(context);vm.runInContext(source,context);
 const run=code=>vm.runInContext(code,context);
 if(options.initialize!==false)run(`account().mode='server';account().voice=false;draft.question=${JSON.stringify(question)};render()`);
 return {run,app,status,input,window,store,context,handlers,
  click:action=>handlers.click({target:{closest:()=>({dataset:{action}})}}),
  change:(id,value)=>handlers.change({target:{id,value,checked:Boolean(value)}}),
  confirm:()=>run(`confirmQuery('consult',{elements:{crop:{value:'papa'},question:{value:${JSON.stringify(question)}}}})`),
  cancelConfirmation:()=>{confirmed=false;},get confirmations(){return confirmations;}};
}

function response(data=advice,status=200){return {ok:status===200,status,json:async()=>data};}

test('Éxito del contrato, espera visible, duplicado bloqueado y payload sin foto/perfil',async()=>{
 const waiting=deferred();const calls=[];
 const h=await harness((url,options)=>{calls.push({url,options});return waiting.promise;});
 h.run("draft.photo='data:private';draft.photoName='privada.jpg'");
 const pending=h.confirm();
 assert.equal(h.run('processing'),true);
 assert.match(h.app.innerHTML,/AgroVoz está preparando tu orientación/);
 assert.match(h.app.innerHTML,/fieldset class="query-fields" disabled/);
 assert.match(h.app.innerHTML,new RegExp(question));
 await h.confirm();assert.equal(calls.length,1);assert.equal(h.confirmations,1);
 assert.deepEqual(JSON.parse(calls[0].options.body),{crop:'Papa',question});
 waiting.resolve(response());await pending;
 assert.equal(h.run('processing'),false);
 assert.equal(h.run('account().history.length'),1);
 assert.equal(h.run('account().history[0].real'),true);
 assert.match(h.app.innerHTML,/LLM · llama3.2:1b/);
 assert.equal(h.run('JSON.parse(localStorage.getItem(DB_KEY)).accounts.ana.history.length'),1);
});

test('Error 502: conserva texto, ofrece reintento y no llama al mock ni guarda historial',async()=>{
 let count=0;
 const h=await harness(async()=>response(advice,++count===1?502:200));
 h.run("mockAdvice=()=>{throw new Error('fallback prohibido')}");
 await h.confirm();
 assert.equal(h.run('account().history.length'),0);
 assert.equal(h.run('draft.question'),question);
 assert.equal(h.run('interaction.stage'),'error');
 assert.match(h.app.innerHTML,/Revisar y reintentar/);
 await h.confirm();assert.equal(h.run('account().history.length'),1);
});

test('JSON incompleto y error de red no se guardan como resultados reales',async()=>{
 for(const fetchImpl of [async()=>response({observation:'incompleta'}),async()=>{throw new TypeError('network');}]){
  const h=await harness(fetchImpl);await h.confirm();
  assert.equal(h.run('account().history.length'),0);
  assert.equal(h.run('processing'),false);assert.equal(h.run('interaction.stage'),'error');
 }
});

test('Modo servidor offline explícito; demo offline conserva cola anterior',async()=>{
 let calls=0;const h=await harness(async()=>{calls++;return response();});
 h.run('offlineDemo=true');await h.confirm();
 assert.equal(calls,0);assert.equal(h.run('account().history.length'),0);
 assert.match(h.app.innerHTML,/El modo LLM necesita conexión/);
 h.run("account().mode='demo'");await h.confirm();
 assert.equal(h.run('account().history[0].real'),false);
 assert.equal(h.run('account().queue.length'),1);
});

test('Cambiar cuenta cancela espera y no filtra resultado a la otra cuenta',async()=>{
 const waiting=deferred();let signal;
 const h=await harness((url,options)=>{signal=options.signal;return waiting.promise;});
 const pending=h.confirm();h.change('demoUser','jose');assert.equal(signal.aborted,true);
 waiting.resolve(response());await pending;
 assert.equal(h.run('db.accounts.ana.history.length'),0);
 assert.equal(h.run('db.accounts.jose.history.length'),0);
 assert.equal(h.run('processing'),false);
});

test('Cancelar confirmación y pregunta corta no envían nada',async()=>{
 let calls=0;const h=await harness(async()=>{calls++;return response();});
 h.cancelConfirmation();await h.confirm();assert.equal(calls,0);
 h.run("confirmQuery('consult',{elements:{crop:{value:'papa'},question:{value:'corta'}}})");
 assert.equal(calls,0);assert.equal(h.run('interaction.stage'),'error');
});

test('Preferencia voz, pausa/reanudación, fin y ausencia de síntesis',async()=>{
 const h=await harness(async()=>response());let spoken=0,paused=0,resumed=0,cancelled=0;
 h.window.SpeechSynthesisUtterance=function(text){this.text=text;};
 h.window.speechSynthesis={speak(t){spoken++;this.utterance=t;this.speaking=true;},
  cancel(){cancelled++;},pause(){paused++;this.paused=true;},resume(){resumed++;this.paused=false;}};
 await h.confirm();assert.equal(spoken,0);
 h.change('voicePref',true);await h.confirm();assert.equal(spoken,1);
 assert.equal(h.window.speechSynthesis.utterance.lang,'es-PE');
 h.run('pauseSpeech();pauseSpeech()');assert.equal(paused,1);assert.equal(resumed,1);
 h.run('stopSpeech()');assert.ok(cancelled>=1);assert.equal(h.run('speechState'),'idle');
 h.window.speechSynthesis=null;h.run('speak()');assert.match(h.status.textContent,/no está disponible/);
});

test('Transcripción editable, es-PE, permiso denegado y ausencia de reconocimiento',async()=>{
 const h=await harness(async()=>response());h.run('startVoice()');
 assert.match(h.status.textContent,/Puedes escribir/);
 h.window.SpeechRecognition=function(){this.start=()=>{};this.abort=()=>{};this.stop=()=>{this.stopped=true;};};
 h.run('startVoice()');const recognizer=h.run('recording');
 assert.equal(recognizer.lang,'es-PE');assert.equal(h.run('interaction.stage'),'listening');
 h.run('stopVoice()');assert.equal(recognizer.stopped,true);
 recognizer.onresult({results:[[{transcript:'Hojas con manchas'}]]});
 assert.equal(h.run('draft.question'),'Hojas con manchas');assert.equal(h.run('interaction.stage'),'transcribed');
 h.input.value='Texto corregido';h.handlers.input({target:{id:'question',value:h.input.value}});
 assert.equal(h.run('draft.question'),'Texto corregido');
 recognizer.onerror({error:'not-allowed'});assert.match(h.status.textContent,/Permiso de micrófono denegado/);
});

test('Cliente distingue 422/503, timeout y abort del solicitante',async()=>{
 const {consultLLM}=await modulePromise;
 for(const [status,pattern] of [[422,/8 a 700/],[503,/configurado/]]){
  await assert.rejects(consultLLM({crop:'papa',question},{fetchImpl:async()=>response({},status)}),pattern);
 }
 const fetchImpl=(url,{signal})=>new Promise((resolve,reject)=>{
  const abort=()=>reject(new DOMException('aborted','AbortError'));
  if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
 });
 await assert.rejects(consultLLM({crop:'papa',question},{fetchImpl,timeoutMs:5}),/espera terminó/);
 const controller=new AbortController();const pending=consultLLM({crop:'papa',question},{fetchImpl,signal:controller.signal});
 controller.abort();await assert.rejects(pending,/canceló/);
});


test('Fase III: aceptar y quitar sugerencia conserva consentimiento, voz y cultivo tras recarga',async()=>{
 const h=await harness(async()=>response());h.change('preferredCrop','maiz');h.change('learnPref',true);
 await h.confirm();await h.confirm();await h.confirm();h.run("navTo('inicio')");
 assert.match(h.app.innerHTML,/Has guardado 3 consultas/);h.click('accept-personalization');
 assert.equal(h.run('account().quickAccess'),true);h.click('reset-preferences');
 const reloaded=await harness(async()=>response(),{store:h.store,initialize:false});
 assert.equal(reloaded.run('account().quickAccess'),false);
 assert.equal(reloaded.run('account().learning'),true);assert.equal(reloaded.run('account().voice'),false);
 assert.equal(reloaded.run('draft.crop'),'maiz');assert.equal(reloaded.run('account().history.length'),3);
});

test('Fase III: rechazar una sugerencia no revoca otras preferencias ni insiste al recargar',async()=>{
 const h=await harness(async()=>response());h.run("account().uses=3;account().learning=true;navTo('inicio')");
 h.click('decline-personalization');assert.equal(h.run('account().learning'),true);
 const reloaded=await harness(async()=>response(),{store:h.store,initialize:false});reloaded.run("navTo('inicio')");
 assert.doesNotMatch(reloaded.app.innerHTML,/Sugerencia personalizada/);
 assert.equal(reloaded.run('account().voice'),false);assert.equal(reloaded.run('account().quickSuggestionDismissed'),true);
});

test('Fase III: cancelar espera conserva texto, aborta y permite un nuevo envío sin resultado tardío',async()=>{
 const waiting=deferred();let signal;
 const h=await harness((url,options)=>{signal=options.signal;return waiting.promise;});
 const pending=h.confirm();h.click('cancel-query');assert.equal(signal.aborted,true);
 assert.equal(h.run('processing'),false);assert.equal(h.run('draft.question'),question);
 waiting.resolve(response());await pending;assert.equal(h.run('account().history.length'),0);
 await h.confirm();assert.equal(h.run('account().history.length'),1);
});

test('Fase III: eventos repetidos de dictado no duplican texto ni envían consultas',async()=>{
 let calls=0;const h=await harness(async()=>{calls++;return response();});
 h.window.SpeechRecognition=function(){this.start=()=>{};this.abort=()=>{};};h.run('startVoice()');
 const recognition=h.run('recording');const event={resultIndex:0,results:[[{transcript:'Hojas con manchas'}]]};
 recognition.onresult(event);recognition.onresult(event);
 assert.equal(h.run('draft.question'),'Hojas con manchas');assert.equal(calls,0);
 recognition.onend();assert.equal(h.run('recording'),null);
});

test('Fase III: volver a escuchar cancela la voz anterior y descarta su evento tardío',async()=>{
 const h=await harness(async()=>response());let cancellations=0;const utterances=[];
 h.window.SpeechSynthesisUtterance=function(text){this.text=text;};
 h.window.speechSynthesis={speak:t=>utterances.push(t),cancel:()=>cancellations++};
 await h.confirm();const before=cancellations;h.run('speak();speak()');assert.equal(utterances.length,2);assert.equal(cancellations,before+2);
 utterances[0].onend();assert.equal(h.run('speechState'),'speaking');
 utterances[1].onend();assert.equal(h.run('speechState'),'idle');
});

test('Fase III: cultivo y preferencias quedan aislados entre perfiles locales',async()=>{
 const h=await harness(async()=>response());h.change('preferredCrop','maiz');h.change('voicePref',false);
 h.change('demoUser','jose');assert.equal(h.run('draft.crop'),'tomate');h.change('preferredCrop','cafe');
 h.change('demoUser','ana');assert.equal(h.run('draft.crop'),'maiz');assert.equal(h.run('account().voice'),false);
});
