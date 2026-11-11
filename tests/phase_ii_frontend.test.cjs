/* Lógica de flujo en DOM simulado; no prueba micrófono ni audio reales. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const source=fs.readFileSync(path.join(__dirname,'../AgroVoz-App/app.js'),'utf8')
 .replace("import {consultLLM} from './modules/llm-client.js';",'')
 .replace("import {createRoomsCommunity} from './modules/rooms-client.js';",'')
 .replace("import {createPersonalization,personalizationView} from './modules/personalization.js';",'')
 .replace("import {parseVoiceCommand} from './modules/voice-commands.js';",'');
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
 const context={createRoomsCommunity:()=>({isReal:()=>false,selector:()=>'',sync(){},chooseMode(){throw new Error('Flujo LLM aislado de salas');}}),document,window,location,navigator:{onLine:true},console,AbortController,crypto:require('node:crypto').webcrypto,
  localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))},
  setTimeout:()=>1,clearTimeout(){},confirm:()=>{confirmations++;return confirmed;},
  consultLLM:(payload,options)=>consultLLM(payload,{...options,fetchImpl})};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../AgroVoz-App/modules/voice-commands.js'),'utf8').replace(/^export /gm,''),context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../AgroVoz-App/modules/personalization.js'),'utf8').replace(/^export /gm,''),context);vm.runInContext(source,context);
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

test('Personalización: consulta confirmada registra cultivo y modalidad sin enviar aprendizaje al LLM',async()=>{
 const calls=[];const h=await harness(async(url,options)=>{calls.push(JSON.parse(options.body));return response();});
 await h.confirm();assert.equal(h.run('personalization.summary(current).modalities.text'),1);
 assert.equal(h.run('personalization.summary(current).crops.papa'),1);
 assert.deepEqual(Object.keys(calls[0]).sort(),['crop','question']);
 const before=h.run('JSON.stringify(account().personalization)');h.run('render();render()');
 assert.equal(h.run('JSON.stringify(account().personalization)'),before);
});
test('Personalización: OFF congela conteos y emoción, conserva historial funcional',async()=>{
 const h=await harness(async()=>response());await h.confirm();h.change('learnPref',false);
 const before=h.run('JSON.stringify(account().personalization)'),uses=h.run('account().uses');
 await h.confirm();h.run("learn('emotion',{value:'frustrado'})");
 assert.equal(h.run('JSON.stringify(account().personalization)'),before);
 assert.equal(h.run('account().uses'),uses);assert.equal(h.run('account().history.length'),2);
});
test('Personalización: dictado y una edición por transcripción, sin contar cada tecla',async()=>{
 const h=await harness(async()=>response());
 h.window.SpeechRecognition=function(){this.start=()=>{};this.abort=()=>{};};
 h.run('startVoice()');h.run('recording').onresult({results:[[{transcript:'Hojas con manchas desde ayer'}]]});
 for(const value of ['Hojas corregidas','Hojas corregidas otra vez'])h.handlers.input({target:{id:'question',value}});
 assert.equal(h.run('personalization.summary(current).edits'),1);
 await h.confirm();assert.equal(h.run('personalization.summary(current).modalities.voice'),1);
});
test('Personalización: reintento únicamente tras fallo real, éxito elimina dificultad',async()=>{
 let calls=0;const h=await harness(async()=>response(advice,++calls<3?502:200));
 await h.confirm();assert.equal(h.run('personalization.summary(current).retries'),0);
 await h.confirm();assert.equal(h.run('personalization.summary(current).retries'),1);
 assert.match(h.app.innerHTML,/Parece que esto está costando/);
 await h.confirm();assert.equal(h.run('personalization.summary(current).retries'),2);
 assert.equal(h.run('personalization.summary(current).difficulty'),false);
});
test('Personalización: emoción, eliminación confirmada y restablecimiento conservan historial',async()=>{
 const h=await harness(async()=>response());await h.confirm();
 const click=dataset=>h.handlers.click({target:{closest:()=>({dataset})}});
 click({action:'learning-emotion',value:'normal'});assert.equal(h.run('account().personalization.emotion.value'),'normal');
 h.cancelConfirmation();click({action:'learning-reset'});assert.equal(h.run('personalization.summary(current).total'),1);
 h.context.confirm=()=>true;click({action:'learning-forget',category:'emotion'});
 assert.equal(h.run('account().personalization.emotion'),null);
 click({action:'learning-reset'});assert.equal(h.run('personalization.summary(current).total'),0);
 assert.equal(h.run('account().history.length'),1);assert.equal(h.run('account().learning'),true);
});
test('Personalización: errores de micrófono no se duplican y la transcripción exitosa reinicia',async()=>{
 const h=await harness(async()=>response());h.window.SpeechRecognition=function(){this.start=()=>{};this.abort=()=>{};};
 h.run('startVoice()');const rec=h.run('recording');rec.onerror({error:'not-allowed'});rec.onerror({error:'not-allowed'});rec.onend();
 assert.equal(h.run('personalization.summary(current).microphoneErrors'),1);
 h.run('startVoice()');const second=h.run('recording');second.onerror({error:'not-allowed'});second.onend();
 assert.equal(h.run('personalization.summary(current).difficulty'),true);
 h.run('startVoice()');h.run('recording').onresult({results:[[{transcript:'Hojas con manchas'}]]});
 assert.equal(h.run('personalization.summary(current).difficulty'),false);
});
test('Personalización: lectura requiere acción afirmativa y olvido no cambia preferencias',async()=>{
 const h=await harness(async()=>response());h.run("learn('query',{id:'voz',mode:'voice',crop:'maiz'});navTo('consultar')");
 assert.match(h.app.innerHTML,/learning-accept-voice/);assert.equal(h.run('account().voice'),false);
 h.click('learning-accept-voice');assert.equal(h.run('account().voice'),true);
 h.click('learning-reset');assert.equal(h.run('account().voice'),true);
});

test('Fase 2: seis comandos navegan mediante el reconocedor sin enviarse al LLM',async()=>{
 let calls=0;const h=await harness(async()=>{calls++;return response();});
 h.window.SpeechRecognition=function(){this.start=()=>{};this.abort=()=>{this.onend?.();};};
 for(const [text,route] of [['ir a inicio','inicio'],['ir a parcelas','parcelas'],['ir a consultar','consultar'],['ir a historial','historial'],['ir a comunidad','alertas'],['ir a perfil','perfil']]){
  h.run('startCommands()');const r=h.run('recording');r.onresult({results:[[{transcript:text}]]});
  assert.equal(h.run('route'),route);assert.equal(h.run('recognitionMode'),'idle');assert.notEqual(h.run('interaction.stage'),'listening');
 }
 assert.equal(calls,0);assert.equal(h.run('account().history.length'),0);
});
test('Fase 2: frase agrícola ambigua no navega; la misma frase en Dictado no es comando',async()=>{
 const h=await harness(async()=>response());h.window.SpeechRecognition=function(){this.start=()=>{};this.abort=()=>{this.onend?.();};};
 h.run('startCommands()');h.run('recording').onresult({results:[[{transcript:'mis hojas están amarillas, quiero ir a inicio'}]]});
 assert.equal(h.run('route'),'consultar');assert.match(h.run('voiceMessage'),/No entendí el comando/);
 h.run('startVoice()');h.run('recording').onresult({results:[[{transcript:'ir a inicio'}]]});
 assert.equal(h.run('route'),'consultar');assert.equal(h.run('draft.question'),'ir a inicio');
});
test('Fase 2: no hay dos reconocimientos; cancelar espera onend antes de permitir otro',async()=>{
 const h=await harness(async()=>response());let starts=0;
 h.window.SpeechRecognition=function(){this.start=()=>{starts++;};this.abort=()=>{};};
 h.run('startVoice()');const dictation=h.run('recording');h.run('startCommands()');assert.equal(starts,1);
 h.run('cancelListening();startCommands()');assert.equal(starts,1);assert.equal(h.run('voiceStopping'),true);
 dictation.onend();h.run('startCommands()');assert.equal(starts,2);h.run('startVoice()');assert.equal(starts,2);
});
test('Fase 2: leer exige respuesta real propia y detener cancela voz/escucha',async()=>{
 const h=await harness(async()=>response());assert.equal(h.run("executeVoiceCommand({action:'read'})"),false);
 assert.match(h.run('voiceMessage'),/No hay una respuesta real/);
 let spoken=0,cancelled=0;h.window.SpeechSynthesisUtterance=function(text){this.text=text;};
 h.window.speechSynthesis={cancel(){cancelled++;},speak(){spoken++;}};
 await h.confirm();h.run("executeVoiceCommand({action:'read'})");assert.equal(spoken,1);
 h.run("executeVoiceCommand({action:'stop'})");assert.equal(h.run('speechState'),'idle');assert.ok(cancelled>0);
 h.change('demoUser','jose');assert.equal(h.run("executeVoiceCommand({action:'read'})"),false);
});
test('Fase 2: navegación tradicional sin SpeechRecognition; permiso denegado y no-speech',async()=>{
 const h=await harness(async()=>response());h.run('startCommands()');assert.match(h.run('voiceMessage'),/usar los botones/);
 h.run("navTo('parcelas')");assert.equal(h.run('route'),'parcelas');
 h.window.SpeechRecognition=function(){this.start=()=>{};this.abort=()=>{this.onend?.();};};
 h.run('startCommands()');let r=h.run('recording');r.onerror({error:'not-allowed'});assert.match(h.run('voiceMessage'),/Permiso de micrófono denegado/);r.onend();
 h.run('startCommands()');r=h.run('recording');r.onerror({error:'no-speech'});assert.match(h.run('voiceMessage'),/No se pudo escuchar/);r.onend();
});
test('Fase 2: parcela solo confirma y vibra después de guardar; error no confirma',async()=>{
 const h=await harness(async()=>response());let vibrations=0;h.context.navigator.vibrate=()=>{vibrations++;return true;};
 h.run('account().vibrationEnabled=true');h.handlers.submit({preventDefault(){},target:{id:'addCropForm',elements:{crop:{value:'tomate'}}}});
 assert.match(h.run('toastText'),/añadido y guardado/);assert.equal(vibrations,1);
 h.context.localStorage.setItem=()=>{throw new Error("almacenamiento bloqueado");};h.handlers.submit({preventDefault(){},target:{id:'addCropForm',elements:{crop:{value:'cafe'}}}});
 assert.match(h.run('toastText'),/No se pudo guardar/);assert.equal(vibrations,1);assert.equal(h.run("account().crops.includes('cafe')"),false);
});
test('Fase 2: vibración apagada por defecto y con movimiento reducido',async()=>{
 const h=await harness(async()=>response());let vibrations=0;h.context.navigator.vibrate=()=>{vibrations++;return true;};
 h.run('sensorySuccess()');assert.equal(vibrations,0);h.run('account().vibrationEnabled=true');
 h.window.matchMedia=()=>({matches:true});h.run('sensorySuccess()');assert.equal(vibrations,0);
});
