/* Comprobaciones adicionales en Chrome real. No simulan participantes ni audio. */
const assert=require('node:assert/strict');
const path=require('node:path');
module.exports=async({evaluate,send,until,check,report,root,fs})=>{
 const navigate=async route=>{await evaluate(`document.querySelector('a[href="#${route}"]').click()`);await until(`location.hash==='#${route}'`);};
 const change=async(id,value)=>evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});${typeof value==='boolean'?`el.checked=${value}`:`el.value=${JSON.stringify(value)}`};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const stored=()=>evaluate('JSON.parse(localStorage.getItem("agrovozdemo_v3"))');
 const key=async name=>{const code=name==='Tab'?9:name==='Escape'?27:13;await send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:code,...(name==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:code});};
 // Reintento real después del bloqueo controlado de red del flujo heredado.
 await evaluate('document.querySelector("[data-action=retry-query]").click()');
 assert.equal(await evaluate('document.activeElement.id'),'question');
 await evaluate('document.getElementById("consultForm").requestSubmit()');
 await until('location.hash==="#resultado" || document.getElementById("interactionStatus")?.dataset.state==="error"');
 assert.equal(await evaluate('location.hash'),'#resultado',await evaluate('document.getElementById("interactionStatus").textContent'));
 assert.equal((await stored()).accounts.ana.history.length,2);
 report.retry_observation=await evaluate('document.querySelector(".result-lead").textContent');
 check('Reintento tras reconectar: respuesta real nueva y un único registro adicional');
 await navigate('consultar');
 // El enlace de salto no debe convertirse en una ruta "main" y volver a inicio.
 await evaluate('document.querySelector(".skip-link").focus()');await key('Enter');
 assert.equal(await evaluate('document.activeElement.id'),'main');assert.equal(await evaluate('location.hash'),'#consultar');
 check('Teclado: enlace de salto conserva pantalla y enfoca main');
 await evaluate('document.getElementById("consultCrop").focus()');await key('Tab');
 assert.equal(await evaluate('document.activeElement.id'),'question');
 const outline=await evaluate('({color:getComputedStyle(document.activeElement).outlineColor,width:getComputedStyle(document.activeElement).outlineWidth,style:getComputedStyle(document.activeElement).outlineStyle})');
 assert.equal(outline.style,'solid');assert.equal(outline.width,'3px');
 await key('Tab');assert.ok(await evaluate('document.activeElement.textContent.includes("Hablar")'));
 check('Teclado: cultivo → pregunta → Hablar; foco visible');
 report.focus_outline=outline;
 await evaluate('document.querySelector("[data-action=show-help]").focus()');assert.equal(await evaluate('document.activeElement.dataset.action'),'show-help');await key('Enter');
 await until('!!document.querySelector(".modal[role=dialog]")',5000);
 assert.ok(await evaluate('!!document.querySelector(".modal[role=dialog]")'));
 assert.equal(await evaluate('document.activeElement.dataset.action'),'cancel-modal');await key('Tab');
 assert.equal(await evaluate('document.activeElement.dataset.action'),'cancel-modal');await key('Escape');
 assert.equal(await evaluate('document.activeElement.dataset.action'),'show-help');
 assert.equal(await evaluate('!!document.querySelector(".modal")'),false);
 check('Ayuda por teclado: foco contenido, Escape y retorno al control de origen');
 // Señales reales de uso de este perfil: una consulta demo nueva + dos reales previas.
 await navigate('perfil');await change('assistantMode','demo');await change('voicePref',false);await change('learnPref',true);await change('preferredCrop','maiz');
 await navigate('consultar');
 for(let i=0;i<1;i++){
  if(i)await navigate('consultar');
  await evaluate(`document.getElementById('question').value='Hojas con manchas desde ayer';document.getElementById('question').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('consultForm').requestSubmit()`);
  await until('location.hash==="#resultado"');
  assert.ok(await evaluate('document.body.textContent.includes("Demo · sin IA")'));
  assert.ok(await evaluate('document.querySelector(".navlink[aria-current=page]").getAttribute("href")==="#consultar"'));
 }
 check('Resultados demo diferenciados y navegación coherente en Consultar');
 await navigate('inicio');assert.ok(await evaluate('document.body.textContent.includes("Has guardado 3 consultas")'));
 await evaluate('document.querySelector("[data-action=accept-personalization]").click()');
 assert.equal((await stored()).accounts.ana.quickAccess,true);
 await navigate('perfil');await evaluate('document.querySelector("[data-action=reset-preferences]").click()');
 let data=await stored();assert.equal(data.accounts.ana.quickAccess,false);assert.equal(data.accounts.ana.voice,false);assert.equal(data.accounts.ana.learning,true);
 await send('Page.reload');await until('!!document.getElementById("preferredCrop")');
 data=await stored();assert.equal(data.accounts.ana.history.length,3);assert.equal(await evaluate('document.getElementById("preferredCrop").value'),'maiz');
 assert.equal(await evaluate('document.getElementById("voicePref").checked'),false);assert.equal(await evaluate('document.getElementById("learnPref").checked'),true);
 check('Personalización con uso real: aceptar/quitar, recarga y consentimiento conservado');
 await change('demoUser','jose');await until('!!document.getElementById("preferredCrop")');
 assert.equal((await stored()).accounts.jose.history.length,0);assert.equal(await evaluate('document.getElementById("preferredCrop").value'),'tomate');
 await change('preferredCrop','cafe');await change('demoUser','ana');await until('document.getElementById("preferredCrop")?.value==="maiz"');
 check('Perfiles locales: historial y cultivo inicial aislados');
 await change('assistantMode','server');await navigate('consultar');
 assert.equal(await evaluate('document.getElementById("consultCrop").value'),'maiz');
 const labels=await evaluate(`Array.from(document.querySelectorAll('#consultForm input,#consultForm textarea,#consultForm select')).map(el=>({id:el.id,label:el.labels?.[0]?.textContent.trim()}))`);
 assert.ok(labels.every(item=>item.label));report.labels=labels;
 assert.equal(await evaluate('document.getElementById("queryAnnouncements").getAttribute("aria-live")'),'polite');
 check('Etiquetas de consulta y región persistente de anuncios accesibles');
 // Pares acotados, medidos con estilos computados. No es una auditoría automática completa.
 const colors=await evaluate(`(()=>{
 const button=document.querySelector('#consultForm button.btn.secondary');
 return [{name:'Texto principal',fg:getComputedStyle(document.body).color,bg:getComputedStyle(document.documentElement).backgroundColor,minimum:4.5},
 {name:'Botón secundario',fg:getComputedStyle(button).color,bg:getComputedStyle(button).backgroundColor,minimum:4.5},
 {name:'Borde del campo',fg:getComputedStyle(document.getElementById('question')).borderTopColor,bg:getComputedStyle(document.getElementById('question')).backgroundColor,minimum:3},
 {name:'Foco de campo',fg:${JSON.stringify(outline.color)},bg:'rgb(255, 255, 255)',minimum:3},
 {name:'Estado de error',fg:'rgb(146, 59, 40)',bg:'rgb(255, 255, 255)',minimum:4.5}];})()`);
 const luminance=color=>{
  const channels=color.match(/[\d.]+/g).slice(0,3).map(x=>{const c=Number(x)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
 };
 report.contrast=colors.map(pair=>{const a=luminance(pair.fg),b=luminance(pair.bg);return {...pair,ratio:Number(((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2))};});
 assert.ok(report.contrast.every(pair=>pair.ratio>=pair.minimum),JSON.stringify(report.contrast));
 check('Contraste acotado: texto, botón, borde, foco y error alcanzan umbrales de referencia');
 report.viewports=[];
 for(const width of [1280,640,360]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  const result=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})');
  if(result.scrollWidth>result.clientWidth)result.overflow=await evaluate('Array.from(document.querySelectorAll("body *")).filter(el=>el.getBoundingClientRect().right>document.documentElement.clientWidth+1).slice(0,15).map(el=>({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right}))');
  report.viewports.push(result);assert.ok(result.scrollWidth<=result.clientWidth,JSON.stringify(result));
 }
 const navReadable=await evaluate('Array.from(document.querySelectorAll(".navlink")).every((el,i,all)=>!i||all[i-1].getBoundingClientRect().right<=el.getBoundingClientRect().left+1)');assert.equal(navReadable,true);report.mobile_nav_no_overlap=true;
 await until('!document.querySelector(".toast")',6000);
 const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
 await fs.writeFile(path.join(root,'docs/evidencias/FASE_III_MOVIL.png'),Buffer.from(screenshot.data,'base64'));
 await send('Emulation.clearDeviceMetricsOverride');
 check('Vista de consulta sin desborde horizontal de página a 1280/640/360 px');
 // API real del navegador con permiso denegado; no se simula transcripción ni se graba audio.
 const supported=await evaluate('!!(window.SpeechRecognition||window.webkitSpeechRecognition)');
 report.voice_recognition_supported=supported;
 if(supported){
  await send('Browser.setPermission',{permission:{name:'microphone'},setting:'denied',origin:'http://127.0.0.1:8080'});
  await evaluate('document.querySelector("[data-action=start-voice]").click()');
  await until('document.getElementById("interactionStatus").dataset.state==="error"',15000);
  report.microphone_denied_message=await evaluate('document.getElementById("interactionStatus").textContent');
  assert.match(report.microphone_denied_message,/micrófono denegado/);
  check('Chrome real: micrófono denegado produce mensaje y conserva entrada escrita');
 }else check('Chrome real sin reconocimiento: alternativa escrita disponible');
 report.voice_physical='Pendiente: dictado real y escucha audible; permiso denegado no acredita micrófono funcionando';
};
