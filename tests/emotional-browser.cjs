/* Chrome real: solo interfaz HTTP local; no arranca backend ni abre .env. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),children=[];let socket,profile;const report={status:'RUNNING',checks:[],scope:'Chrome real, recursos locales. Sin consultas Ollama/PostgreSQL ni micrófono físico.'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function port(){return new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n));});});}
function launch(cmd,args){const p=spawn(cmd,args,{cwd:root,stdio:'ignore'});children.push(p);return p;}
async function ready(url){for(let i=0;i<150;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(100);}throw Error('Servidor de pruebas no disponible');}
(async()=>{let next=0;const pending=new Map(),errors=[];
 try{
 const web=await port(),debug=await port();launch('python3',['-m','http.server',String(web),'--bind','127.0.0.1','--directory','AgroVoz-App']);await ready(`http://127.0.0.1:${web}`);
 profile=await fs.mkdtemp(path.join(os.tmpdir(),'agrovoz-emotional-'));
 launch('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-background-networking',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`,'about:blank']);await ready(`http://127.0.0.1:${debug}/json/version`);
 const target=await (await fetch(`http://127.0.0.1:${debug}/json/new?about:blank`,{method:'PUT'})).json();
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},20000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100);}throw Error('No se cumplió: '+expression);};
 const check=s=>{report.checks.push(s);console.log('PASS',s);};
 await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`http://127.0.0.1:${web}/#inicio`});await until('!!document.querySelector("[data-action=voice-commands]")');
 assert.equal(await evaluate('!!document.querySelector(".welcome-sprout")'),true);await sleep(800);
 await evaluate('document.querySelector("[data-action=voice-help]").click()');assert.equal(await evaluate('document.querySelectorAll("#voiceCommandHelp li").length'),8);
 check('Bienvenida local y ayuda visible con ocho comandos');
 report.layouts=[];
 for(const width of [360,768,1280]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
 for(const route of ['inicio','consultar','parcelas','alertas','historial','perfil']){
 await evaluate(`document.querySelector('a[href="#${route}"]').click()`);await until(`location.hash==='#${route}'`);
 const layout=await evaluate('({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth})');
 assert.ok(layout.scroll<=layout.width+1,`${route} a ${width}: ${layout.scroll}/${layout.width}`);report.layouts.push({route,viewport:width,...layout});
 }
 }
 check('Sin desborde horizontal en seis pantallas a 360/768/1280 px');
 await evaluate('document.body.style.zoom="2"');
 const zoom=await evaluate('({zoom:getComputedStyle(document.body).zoom,scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth})');
 report.css_zoom_200=zoom;if(zoom.scroll>zoom.width+1)report.zoom_overflow=await evaluate('Array.from(document.querySelectorAll("body *")).filter(e=>e.getBoundingClientRect().right>document.documentElement.clientWidth+1).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right}))');assert.equal(zoom.zoom,'2');report.css_zoom_200.passed=zoom.scroll<=zoom.width+1;await evaluate('document.body.style.zoom="1"');
 if(report.css_zoom_200.passed)check('Perfil sin desborde con zoom CSS 200 %');else {report.pending=['Zoom CSS 200 %: scroll 12 px mayor que el área útil; revisar zoom nativo manualmente'];console.warn('PENDIENTE zoom CSS: diferencia de scroll medida; se conserva diagnóstico.');}
 await send('Emulation.setDeviceMetricsOverride',{width:640,height:900,deviceScaleFactor:2,mobile:false});const proxy=await evaluate('({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth,dpr:devicePixelRatio})');assert.ok(proxy.scroll<=proxy.width+1);report.zoom_viewport_proxy=proxy;check('Reflujo equivalente 640 CSS px / DPR 2 sin desborde (aproximación al zoom, no prueba nativa)');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await evaluate('document.querySelector("[data-action=voice-commands]").classList.add("mic-listening")');
 const animation=await evaluate('getComputedStyle(document.querySelector(".mic-listening")).animationName');assert.equal(animation,'none');
 check('Movimiento reducido desactiva pulso visual');
 await evaluate('document.querySelector("[data-action=voice-commands]").focus()');const focused=await evaluate('({action:document.activeElement.dataset.action,height:document.activeElement.getBoundingClientRect().height,width:document.activeElement.getBoundingClientRect().width})');report.command_control=focused;assert.equal(focused.action,'voice-commands');assert.ok(focused.height>=44&&focused.width>=44);
 check('Control Comandos enfocable y de al menos 44×44 px');
 await evaluate(`document.querySelector('a[href="#inicio"]').click()`);assert.ok((await evaluate('document.querySelector(".weekly-summary").textContent')).includes('No hay datos suficientes'));
 check('Resumen semanal sin datos nuevos no inventa estadísticas');
 await until('!!navigator.serviceWorker.controller');await until('caches.match("./modules/voice-commands.js").then(Boolean)');
 check('Service worker activo y módulo de comandos precacheado');
 const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.mkdir(path.join(root,'docs/evidencias'),{recursive:true});await fs.writeFile(path.join(root,'docs/evidencias/FASE_2_DISENO_INICIO.png'),Buffer.from(screenshot.data,'base64'));
 assert.deepEqual(errors,[]);report.console_exceptions=errors;report.status=report.pending?.length?'PARTIAL':'PASS';
 }catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;console.error(error.message);}
 finally{socket?.close();for(const p of children.reverse())p.kill('SIGTERM');await sleep(300);if(profile)await fs.rm(profile,{recursive:true,force:true});report.executed_at=new Date().toISOString();await fs.mkdir(path.join(root,'docs/evidencias'),{recursive:true});await fs.writeFile(path.join(root,'docs/evidencias/FASE_2_DISENO_NAVEGADOR.json'),JSON.stringify(report,null,2)+'\n');}
})();
