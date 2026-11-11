/* Pruebas de lógica UI ejecutadas sin navegador. No reemplazan pruebas E2E ni tests con usuarios. */
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const appSource=fs.readFileSync(path.join(__dirname,'../AgroVoz-App/app.js'),'utf8');
const store=new Map();const handlers={};const app={innerHTML:''};
const fakeDocument={
 getElementById(id){return id==='app'?app:null},
 addEventListener(type,fn){handlers[`document-${type}`]=fn},
 querySelector(){return null},
 createElement(){return {setAttribute(){},textContent:'',remove(){}}},
 body:{appendChild(){}},
};
const location={_hash:''};
Object.defineProperty(location,'hash',{get(){return this._hash},set(v){this._hash=v.startsWith('#')?v:'#'+v;handlers['window-hashchange']?.()}});
const ctx={
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))},
 document:fakeDocument,window:{addEventListener:(k,v)=>handlers[`window-${k}`]=v,scrollTo(){},speechSynthesis:null},
 location,navigator:{onLine:true},console,confirm:()=>true,setTimeout:()=>1,clearTimeout:()=>{},
 crypto:require('crypto').webcrypto,
};
vm.createContext(ctx);vm.runInContext(appSource,ctx,{filename:'app.js'});
function q(script){return vm.runInContext(script,ctx)}
function act(action,attrs={}){handlers['document-click']({target:{closest:()=>({dataset:{action,...attrs}})}})}
function form(id,elements){handlers['document-submit']({preventDefault(){},target:{id,elements}})}
function change(id,value){handlers['document-change']({target:{id,value,checked:Boolean(value)}})}
const results=[];function check(label,fn){try{fn();results.push({label,ok:true});console.log('PASS',label)}catch(e){results.push({label,ok:false,error:e.message});console.error('FAIL',label,e.message)}}
check('Pantalla inicial y ocho secciones de navegación',()=>{assert(app.innerHTML.includes('Tu campo, tus preguntas'));assert.strictEqual((app.innerHTML.match(/class="navlink /g)||[]).length,8)});
check('Tres alternativas de diseño disponibles',()=>{q("navTo('alternativas')");assert(app.innerHTML.includes('Centrada en voz'));assert(app.innerHTML.includes('Parcela interactiva'));assert(app.innerHTML.includes('Guiada paso a paso'))});
check('Consulta de Ana crea historial y resultado marcado como demo',()=>{
 q("navTo('consultar')");form('consultForm',{crop:{value:'papa'},question:{value:'Las hojas de papa tienen manchas amarillas'}});
 assert(app.innerHTML.includes('Orientación simulada'));assert.strictEqual(q("db.accounts.ana.history.length"),1);assert.strictEqual(q("db.accounts.ana.history[0].crop"),'papa');
});
check('Aislamiento lógico entre cuentas de demostración',()=>{change('demoUser','jose');assert.strictEqual(q("db.accounts.jose.history.length"),0);assert(!app.innerHTML.includes('Las hojas de papa tienen manchas amarillas'));change('demoUser','ana');assert.strictEqual(q("db.accounts.ana.history.length"),1)});
check('Modo offline mantiene cola y vuelve a estado guardado',()=>{
 act('toggle-offline');assert.strictEqual(q('offlineDemo'),true);
 form('consultForm',{crop:{value:'maiz'},question:{value:'Hay insectos visibles en el tallo'}});
 assert.strictEqual(q("db.accounts.ana.queue.length"),1);assert.strictEqual(q("db.accounts.ana.history[0].status"),'pendiente');
 act('toggle-offline');assert.strictEqual(q("db.accounts.ana.queue.length"),0);assert.strictEqual(q("db.accounts.ana.history[0].status"),'guardada');
});
check('Alerta se publica tras confirmación y se filtra por comunidad',()=>{
 q("navTo('alertas')");form('alertForm',{crop:{value:'papa'},text:{value:'Observé manchas en las hojas de tres plantas'}});
 assert.strictEqual(q("modal"),'alert');act('confirm-alert');
 assert.strictEqual(q('db.alerts.length'),2);
 change('demoUser','jose');q("navTo('alertas')");assert(app.innerHTML.includes('Observé manchas en las hojas de tres plantas'));
 change('demoUser','rosa');q("navTo('alertas')");assert(!app.innerHTML.includes('Observé manchas en las hojas de tres plantas'));
});
check('Personalización reversible y persistente',()=>{
 change('demoUser','ana');q("db.accounts.ana.uses=3; db.accounts.ana.learning=true;navTo('inicio')");
 assert(app.innerHTML.includes('Sugerencia personalizada'));act('accept-personalization');assert.strictEqual(q('db.accounts.ana.quickAccess'),true);
 act('reset-preferences');assert.strictEqual(q('db.accounts.ana.quickAccess'),false);
});
check('Matriz consta de 49 filas con sus columnas',()=>{
 const csv=fs.readFileSync(path.join(__dirname,'../docs/Matriz_Trazabilidad_PC2.csv'),'utf8');
 assert(csv.includes('Evidencia / Criterio de aceptación'));assert.strictEqual(csv.trim().split('\n').length,50);
});
const bad=results.filter(r=>!r.ok);console.log(`\nTOTAL ${results.length-bad.length}/${results.length} pruebas correctas.`);if(bad.length)process.exitCode=1;
