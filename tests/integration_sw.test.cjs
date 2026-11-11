/* Asegura que la integración PWA no almacene respuestas API o autenticadas. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../AgroVoz-App/sw.js'),'utf8');
test('El SW precachea ambos clientes y omite API/Authorization incluso en el mismo origen',()=>{
 const handlers={};let installed=[];
 const context={URL,self:{location:{origin:'http://localhost:8080'},addEventListener:(name,handler)=>handlers[name]=handler,skipWaiting:()=>{}},
  caches:{open:async()=>({addAll:async urls=>{installed=Array.from(urls);}})}};
 vm.createContext(context);vm.runInContext(source,context);
 let install;handlers.install({waitUntil:promise=>{install=promise;}});
 for(const [path,method,authenticated] of [['/api/rooms','GET',false],['/api/consult','POST',false],['/private','GET',true]]){
  let intercepted=false;
  handlers.fetch({request:{url:'http://localhost:8080'+path,method,headers:{has:name=>authenticated&&name==='Authorization'}},respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false,path);
 }
 return install.then(()=>{assert.ok(installed.includes('./modules/llm-client.js'));assert.ok(installed.includes('./modules/rooms-client.js'));assert.ok(installed.includes('./modules/personalization.js'));assert.ok(installed.includes('./modules/voice-commands.js'));});
});
