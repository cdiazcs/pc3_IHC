const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const loaded=import(pathToFileURL(path.join(__dirname,'../AgroVoz-App/modules/personalization.js')));
const now=new Date('2026-11-11T15:00:00Z');
const query=(id,date,crop='papa',mode='text')=>({kind:'query',id,date,crop,mode});
test('Resumen de siete días excluye eventos anteriores y futuros; empate explícito',async()=>{
 const {weeklySummary}=await loaded;
 const s=weeklySummary([query('1','2026-11-10T12:00:00Z'),query('2','2026-11-09T12:00:00Z','maiz','voice'),query('old','2026-11-01T12:00:00Z'),query('future','2026-11-12T12:00:00Z')],now);
 assert.equal(s.count,2);assert.equal(s.crop,'tie');assert.equal(s.mode,'tie');
});
test('Sin eventos fechados no reconstruye semanas de contadores acumulados',async()=>{
 const {weeklySummary,createPersonalization}=await loaded;
 const accounts={a:{learning:true,uses:100,history:[{date:'2026-11-10',real:true}]}};
 const p=createPersonalization({accounts,sessionId:'a',save:()=>true,now:()=>now});
 assert.equal(p.summary('a').weekly.sufficient,false);
 assert.equal(weeklySummary([query('bad','fecha inválida')],now).sufficient,false);
});
test('OFF no registra eventos semanales ni valoraciones; respeta aislamiento',async()=>{
 const {createPersonalization}=await loaded;const accounts={a:{learning:true},b:{learning:false}};
 const p=createPersonalization({accounts,sessionId:'a',save:()=>true,now:()=>now});
 p.record('a','query',{id:'r',crop:'papa',mode:'voice',real:true});p.record('a','feedback',{id:'r',value:'positive',real:true});
 assert.equal(p.summary('a').weekly.count,1);assert.equal(p.summary('a').weekly.positive,1);
 assert.equal(p.summary('b').weekly,null);assert.equal(p.record('b','feedback',{id:'r',value:'negative',real:true}),false);
 accounts.a.learning=false;assert.equal(p.summary('a').weekly,null);assert.equal(accounts.a.personalization.events.length,2);
});
test('Corregir valoración sustituye el voto fechado; olvidar no permite reconstruir datos',async()=>{
 const {createPersonalization}=await loaded;const accounts={a:{learning:true}};
 const p=createPersonalization({accounts,sessionId:'a',save:()=>true,now:()=>now});
 p.record('a','query',{id:'r',crop:'papa',mode:'text',real:true});
 for(const value of ['positive','positive','negative'])p.record('a','feedback',{id:'r',value,real:true});
 assert.equal(p.summary('a').weekly.positive,0);assert.equal(p.summary('a').weekly.negative,1);
 assert.equal(accounts.a.personalization.events.length,2);
 p.forget('a','feedback');assert.equal(p.summary('a').weekly.negative,0);
 p.forget('a','crops');assert.equal(p.summary('a').weekly.count,0);assert.equal(p.summary('a').crops.papa,undefined);
});
test('Consultas demo no se anuncian como consultas LLM en el resumen',async()=>{
 const {createPersonalization}=await loaded;const accounts={a:{learning:true}};
 const p=createPersonalization({accounts,sessionId:'a',save:()=>true,now:()=>now});p.record('a','query',{id:'d',crop:'papa',mode:'text',real:false});
 assert.equal(p.summary('a').total,1);assert.equal(p.summary('a').weekly.count,0);
});
