const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const loaded=import(pathToFileURL(path.join(__dirname,'../AgroVoz-App/modules/voice-commands.js')));
for(const [text,expected] of [['ir a inicio',{action:'navigate',route:'inicio'}],['ir a parcelas',{action:'navigate',route:'parcelas'}],['ir a consultar',{action:'navigate',route:'consultar'}],['ir a historial',{action:'navigate',route:'historial'}],['ir a comunidad',{action:'navigate',route:'alertas'}],['ir a perfil',{action:'navigate',route:'perfil'}],['leer respuesta',{action:'read'}],['detener',{action:'stop'}]])test(text,async()=>assert.deepEqual((await loaded).parseVoiceCommand(text),expected));
test('Normaliza mayúsculas, tildes y espacios sin permitir frases añadidas',async()=>{const {parseVoiceCommand}=await loaded;assert.deepEqual(parseVoiceCommand('  ÍR  A   PÉRFIL '),{action:'navigate',route:'perfil'});assert.equal(parseVoiceCommand('ir a perfil por favor'),null);});
test('Rechaza texto desconocido y coincidencias dentro de consultas agrícolas',async()=>{const {parseVoiceCommand}=await loaded;for(const text of ['riego','quiero ir a inicio porque mi papa tiene manchas','cómo detener la plaga','leer respuesta e ir a comunidad','ir a parcelas.','',null,{},'ir a comunidad; detener'])assert.equal(parseVoiceCommand(text),null);});
