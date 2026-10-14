const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const parser=require('@babel/parser'),traverse=require('@babel/traverse').default;
const catalogs=Object.fromEntries(['en','hu','de'].map(l=>[l,JSON.parse(fs.readFileSync('src/locales/'+l+'.json','utf8'))]));
const placeholders=value=>[...value.matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort();
for(const [language,messages]of Object.entries(catalogs)){
 assert.deepEqual(Object.keys(messages).sort(),Object.keys(catalogs.en).sort(),language+' keys');
 for(const [key,value]of Object.entries(messages)){assert.equal(typeof value,'string');assert(value.trim(),language+' '+key);assert.deepEqual(placeholders(value),placeholders(catalogs.en[key]),key+' placeholders');}
 assert.equal(messages.text_191,'HA DB browser');
}
for(const file of ['src/app.jsx','src/ha-panel.jsx']){
 const ast=parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx']});
 traverse(ast,{
  CallExpression(p){if(['t','translate'].includes(p.node.callee.name)&&p.node.arguments[0]?.type==='StringLiteral'){assert(p.scope.getBinding(p.node.callee.name)?.path.isImportSpecifier(),'Translation helper shadowed in '+file);const key=p.node.arguments[0].value;assert(Object.hasOwn(catalogs.en,key),file+' missing '+key);const names=p.node.arguments[1]?.properties?.map(x=>x.key.name)||[];assert.deepEqual(names.sort(),placeholders(catalogs.en[key]),file+' substitutions '+key)}},
  StringLiteral(p){assert(!/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(p.node.value),'Untranslated literal: '+p.node.value)},
  JSXText(p){assert(!/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(p.node.value),'Untranslated JSX: '+p.node.value)},
 });
}
// Bundle the actual runtime helper, so tests also cover locale selection/formatting.
const temp=path.join(os.tmpdir(),'ha-db-browser-i18n-'+process.pid+'.cjs');
require('esbuild').buildSync({entryPoints:['src/i18n.js'],bundle:true,platform:'node',format:'cjs',outfile:temp,logLevel:'silent'});
try{
 const i=require(temp);
 for(const [value,expected]of [['hu-HU','hu'],['de_AT','de'],['en-US','en'],['fr','en'],[null,'en']])assert.equal(i.normalizeLanguage(value),expected);
 i.configureLanguage({config:{language:'de',time_zone:'Europe/Berlin'}});assert.equal(i.getLanguage(),'de');assert.equal(i.t('text_200'),'Übersicht');assert.equal(i.getTimeZone(),'Europe/Berlin');
 i.configureLanguage({language:'hu-HU',config:{language:'de',time_zone:'Europe/Budapest'}});assert.equal(i.getLanguage(),'hu');assert.equal(i.t('text_200'),'Áttekintés');
 i.configureLanguage({language:'fr',config:{language:'hu'}});assert.equal(i.getLanguage(),'en');assert.equal(i.t('text_200'),'Overview');
 i.configureLanguage({});assert.equal(i.getLanguage(),'en');assert.equal(i.getTimeZone(),'UTC');assert(i.t('text_109',{timezone:'UTC'}).includes('UTC'));
}finally{fs.unlinkSync(temp)}
console.log(`PASS: ${Object.keys(catalogs.en).length} translations × 3 languages, placeholders, source coverage, HA language/region/default, formatting and English fallback`);
