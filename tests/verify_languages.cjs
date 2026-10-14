// Browser integration contract with synthetic records, no private DB or HA tokens.
const http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const catalogs=Object.fromEntries(['en','hu','de'].map(lang=>[lang,JSON.parse(fs.readFileSync('src/locales/'+lang+'.json'))]));
const schema={name:'states',type:'table',sql:'CREATE TABLE states (state_id INTEGER PRIMARY KEY)',rows:12345,storage:{bytes:1048576},indexes:[],columns:[{name:'state_id',type:'INTEGER',pk:1}],foreignKeys:[]};
const snapshot={generated:'2026-10-14T10:00:00Z',schemaVersion:{schema_version:53},storageAvailable:true,tables:[schema],objects:[{name:'states',bytes:1048576,unused:0}],entities:[{metadata_id:7,entity_id:'sensor.sample_power',rows:12345,first:1700000000,last:1700001000}],stats:[],days:[{day:'2026-10-14',rows:12345}],events:[]};
const entity={meta:snapshot.entities[0],history:[{state_id:2,state:'12.3',last_updated_ts:1700001000,previous_state:'12',attributes_id:1,previous_attributes_id:1,old_state_id:1,attributes:{friendly_name:'Sample plug',unit_of_measurement:'W'}}],statHistory:[],shortHistory:[],activity:[],breakdown:null,attributes:[],provenance:{registered:true,platform:'mqtt',configEntry:{domain:'mqtt',title:'Sample broker'},device:{name:'Sample device',manufacturer:'Sample',model:'A'},siblings:[],note:''}};
const languages=new Set();
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><body style="margin:0"><ha-adatterkep-panel></ha-adatterkep-panel><script type="module">import '/panel.js';const language=new URL(location.href).searchParams.get('language');window.mockHass={...(language?{language}:{}),config:{language:'en',time_zone:'UTC'},callWS:async message=>{const response=await fetch('/rpc',{method:'POST',body:JSON.stringify(message)});return response.json()}};document.querySelector('ha-adatterkep-panel').hass=window.mockHass;</script>`)}
 if(url.pathname==='/panel.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync('custom_components/ha_adatterkep/frontend/panel.js'))}
 if(url.pathname==='/rpc'){
  let raw='';for await(const chunk of req)raw+=chunk;const msg=JSON.parse(raw);assert.equal(msg.type,'ha_adatterkep/query');languages.add(msg.params.language);
  const actions={overview:{analysis:snapshot,status:{running:false,phase:'complete'}},live:{fileBytes:1000000,walBytes:0,freePages:1,pageSize:4096,latest:{state_id:2,last_updated_ts:1700001000}},entity,context:{states:[],events:[]},table:{rows:[{state_id:2}],offset:0,total:1}};
  assert(actions[msg.action],'Unexpected mock action '+msg.action);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(actions[msg.action]));
 }res.writeHead(404);res.end();
}catch(e){res.writeHead(500);res.end(JSON.stringify({error:e.message}))}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const base='http://127.0.0.1:'+server.address().port;
  for(const [requested,lang]of [['en','en'],['hu-HU','hu'],['de-DE','de'],['fr','en'],['','en']]){
   const t=catalogs[lang];await page.goto(base+'/?language='+requested);await page.getByRole('heading',{name:t.text_194,exact:true}).waitFor();
   await page.getByText('HA DB browser',{exact:true}).waitFor();
   await page.getByRole('button',{name:t.text_201,exact:true}).click();await page.getByRole('heading',{name:'states',exact:true}).waitFor();await page.getByText(t.table_states,{exact:true}).waitFor();
   await page.getByText(t.text_062,{exact:true}).click();await page.getByText(t.field_state_id,{exact:true}).waitFor();
   await page.getByRole('button',{name:t.text_069,exact:true}).click();await page.getByText(t.text_049,{exact:false}).waitFor();
   await page.getByRole('button',{name:t.entities,exact:true}).click();await page.getByRole('heading',{name:t.text_070,exact:true}).waitFor();await page.getByText('Sample device',{exact:false}).waitFor();
   await page.getByText(t.text_109.replace('{timezone}','UTC'),{exact:true}).waitFor();
   await page.getByRole('button',{name:t.text_108,exact:true}).click();await page.getByLabel(t.text_112).waitFor();
   await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:1000});
   assert.equal(await page.locator('ha-adatterkep-panel').getAttribute('lang'),lang);
  }
  // Change language on an already open panel: current tab must remain open.
  await page.goto(base+'/?language=en');await page.getByRole('button',{name:catalogs.en.text_201,exact:true}).click();
  for(const [value,lang]of [['hu','hu'],['de','de'],['es','en']]){
   await page.evaluate(language=>{window.mockHass={...window.mockHass,language};document.querySelector('ha-adatterkep-panel').hass=window.mockHass},value);
   await page.getByRole('heading',{name:catalogs[lang].text_052,exact:true}).waitFor();await page.getByText(catalogs[lang].table_states,{exact:true}).waitFor();
  }
  assert.deepEqual([...languages].sort(),['de','en','hu']);assert.deepEqual(errors,[]);
  fs.mkdirSync('data',{recursive:true});await page.screenshot({path:'data/v01-english.png',fullPage:true});
  console.log('PASS: EN/HU/DE, regional languages, unsupported/missing English fallback, live switching without losing tab, translated table/field/entity/statistics views, API language, brand, timezone, mobile layout, no JS errors');
 }finally{await browser?.close();server.close()}
})().catch(error=>{console.error(error);process.exitCode=1;server.close()});
