/* Contratos estáticos y comportamiento SW simulado; no certifica accesibilidad humana. */
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../AgroVoz-App'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'))),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
function harness({network=async()=>new Response('shell',{headers:{'Content-Type':'text/plain'}})}={}){
 const base='https://example.test/AgroVoz-App/',handlers={},stores=new Map(),deleted=[];let requests=[];
 const key=value=>{const url=new URL(typeof value==='string'?value:value.url,base);url.hash='';return url.href;};
 const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);return {
  addAll:async urls=>{requests=Array.from(urls);for(const u of urls)entries.set(key(u),new Response(u));},
  put:async(req,res)=>entries.set(key(req),res),match:async req=>entries.get(key(req))?.clone()
 };},keys:async()=>[...stores.keys()],delete:async name=>{deleted.push(name);return stores.delete(name);}};
 const ctx={URL,Response,Request,Set,Promise,caches,fetch:network,self:{location:{origin:'https://example.test',href:base+'sw.js'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>{},clients:{claim:()=>{}}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),ctx);
 const lifecycle=async name=>{let task;handlers[name]({waitUntil:p=>{task=p;}});await task;};
 const request=async(url,options={})=>{let intercepted=false,task;handlers.fetch({request:new Request(new URL(url,base),options),respondWith:p=>{intercepted=true;task=p;}});return {intercepted,response:task?await task:null};};
 return {stores,deleted,lifecycle,request,get resources(){return requests;},cacheName:()=>[...stores.keys()].find(k=>k.startsWith('agrovoz-shell-'))};
}
test('Manifest PC3: identidad, idioma, alcance y colores coherentes',()=>{
 assert.equal(manifest.name,'AgroVoz');assert.doesNotMatch(manifest.description,/PC2/);assert.equal(manifest.lang,'es');assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'./index.html');assert.equal(manifest.scope,'./');assert.equal(manifest.theme_color,'#207451');assert.equal(manifest.background_color,'#f5f7f1');assert.ok(manifest.categories.length>0);
});
test('Íconos PNG 192/512 reales con firma, dimensiones y MIME declarado',()=>{
 for(const size of [192,512]){const icon=manifest.icons.find(i=>i.sizes===`${size}x${size}`);assert.ok(icon);assert.equal(icon.type,'image/png');assert.equal(icon.purpose,'any');
 const bytes=fs.readFileSync(path.join(root,icon.src));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
 assert.ok(manifest.icons.every(i=>fs.existsSync(path.join(root,i.src))));
});
test('Precache contiene solo recursos existentes y todos los imports actuales',async()=>{
 const h=harness();await h.lifecycle('install');for(const file of h.resources)assert.ok(fs.existsSync(path.join(root,file)),file);
 for(const match of app.matchAll(/from ['"](.+\.js)['"]/g))assert.ok(h.resources.includes(match[1]),match[1]);
 assert.ok(h.resources.includes('./icons/icon-512.png'));
});
test('Activación elimina versiones AgroVoz antiguas y conserva cachés ajenas',async()=>{
 const h=harness();await h.lifecycle('install');h.stores.set('otra-aplicacion-v1',new Map());h.stores.set('agrovozv6-emotional-voice',new Map());
 await h.lifecycle('activate');assert.deepEqual(h.deleted,['agrovozv6-emotional-voice']);assert.ok(h.stores.has('otra-aplicacion-v1'));
});
test('No intercepta API, Authorization, consultas URL ni recursos remotos/desconocidos',async()=>{
 const h=harness();for(const [url,options] of [['/api/consult',{method:'POST'}],['/api/rooms',{}],['/api/rooms/participants',{method:'POST'}],['./app.js',{headers:{Authorization:'Bearer prueba-publica'}}],['./app.js?token=prueba',{}],['https://remote.test/app.js',{}],['./datos-privados',{}]])assert.equal((await h.request(url,options)).intercepted,false,url);
});
test('Offline usa exclusivamente la caché propia del shell y no HTML como JavaScript',async()=>{
 const h=harness({network:async()=>{throw Error('offline');}});await h.lifecycle('install');const shell=await h.request('./index.html');assert.equal(shell.response.status,200);
 const module=await h.request('./modules/personalization.js');assert.equal(await module.response.text(),'./modules/personalization.js');
 h.stores.get(h.cacheName()).delete('https://example.test/AgroVoz-App/modules/voice-commands.js');
 const missing=await h.request('./modules/voice-commands.js');assert.equal(missing.response.status,503);assert.doesNotMatch(await missing.response.text(),/<html/i);
});
test('Respuesta marcada privada/no-store o redirigida nunca se guarda',async()=>{
 for(const control of ['private','no-store']){const h=harness({network:async()=>new Response('no guardar',{headers:{'Cache-Control':control}})});await h.request('./app.js');assert.equal(h.stores.size,0);}
});
test('Sin red no se presenta IA o comunidad como disponible y la cola se etiqueta simulada',()=>{
 assert.match(app,/La IA y las salas reales requieren conexión/);assert.match(app,/cola local simulada/);assert.match(app,/no se enviaron al servidor/);
 assert.match(app,/Demostración sin IA \(simulación local\)/);assert.doesNotMatch(app,/recomendada para PC2/);assert.match(app,/El modo LLM necesita conexión al backend/);
});
test('Etiquetas críticas, alternativa escrita, diálogos y movimiento reducido conservados',()=>{
 for(const id of ['consultCrop','question','preferredCrop','assistantMode'])assert.ok(app.includes(`for="${id}"`),id);
 assert.match(app,/role="dialog" aria-modal="true"/);assert.match(app,/inert/);assert.match(app,/e\.shiftKey/);
 assert.match(app,/Este navegador no admite reconocimiento de voz. Puedes escribir/);
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/\.btn\.small\{min-width:44px;min-height:44px\}/);
});
test('Personalización y comandos de Fases I/II mantienen sus módulos y enlaces',()=>{
 assert.match(app,/createPersonalization/);assert.match(app,/parseVoiceCommand/);assert.match(app,/startCommands\(\)/);assert.match(app,/learning-feedback/);
 assert.match(app,/consultLLM/);assert.match(app,/createRoomsCommunity/);
});

test('Navegación con hash de perfil conserva acceso al shell offline',async()=>{
 const h=harness({network:async()=>{throw Error('offline');}});await h.lifecycle('install');
 const page=await h.request('./index.html#perfil');assert.equal(page.intercepted,true);assert.equal(page.response.status,200);
});
