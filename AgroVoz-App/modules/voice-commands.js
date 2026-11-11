/* Solo frases completas de la lista. No interpreta preguntas agrícolas ni envía texto. */
export function parseVoiceCommand(text){
 if(typeof text!=='string')return null;
 const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim().replace(/\s+/g,' ');
 const routes={'ir a inicio':'inicio','ir a parcelas':'parcelas','ir a consultar':'consultar','ir a historial':'historial','ir a comunidad':'alertas','ir a perfil':'perfil'};
 if(Object.hasOwn(routes,normalized))return {action:'navigate',route:routes[normalized]};
 if(normalized==='leer respuesta')return {action:'read'};
 if(normalized==='detener')return {action:'stop'};
 return null;
}
