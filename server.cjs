const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(path.join(__dirname,'home-assistant_v2.db'),{readOnly:true});db.exec('PRAGMA query_only=ON');
const analysis=JSON.parse(fs.readFileSync(path.join(__dirname,'data/analysis.json')));
const all=(sql,...args)=>db.prepare(sql).all(...args);
const json=(res,v,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(v,(_,v)=>v instanceof Uint8Array?Buffer.from(v).toString('hex'):v));};
const parse=s=>{try{return JSON.parse(s||'{}')}catch{return {raw:s}}};
http.createServer((req,res)=>{
 try{
 const u=new URL(req.url,'http://localhost');
 if(req.method!=='GET')return json(res,{error:'Read-only access.'},405);
 if(u.pathname==='/api/overview')return json(res,analysis);
 if(u.pathname==='/api/entity'){
 const id=u.searchParams.get('id');const meta=analysis.entities.find(e=>e.entity_id===id);const statistic=analysis.stats.find(s=>s.statistic_id===id);
 if(!meta&&!statistic)return json(res,{error:'Unknown entity / statistical series'},404);
 const history=meta?all(`SELECT s.state_id,s.state,s.last_updated_ts,coalesce(s.last_changed_ts,s.last_updated_ts) last_changed_ts,s.last_reported_ts,s.old_state_id,s.attributes_id,hex(s.context_id_bin) context,hex(s.context_parent_id_bin) parentContext,hex(s.context_user_id_bin) userContext,s.origin_idx,a.shared_attrs,p.state previous_state,p.attributes_id previous_attributes_id FROM states s LEFT JOIN state_attributes a ON a.attributes_id=s.attributes_id LEFT JOIN states p ON p.state_id=s.old_state_id WHERE s.metadata_id=? ORDER BY s.last_updated_ts DESC LIMIT 200`,meta.metadata_id).map(r=>({...r,attributes:parse(r.shared_attrs),shared_attrs:undefined})):[];
 const activity=meta?all(`SELECT strftime('%Y-%m-%d',last_updated_ts,'unixepoch') day,count(*) rows FROM states WHERE metadata_id=? GROUP BY day ORDER BY day`,meta.metadata_id):[];
 const breakdown=meta?all(`SELECT count(*) rows,count(DISTINCT attributes_id) attributeSets,sum(CASE WHEN last_changed_ts IS NOT NULL AND last_changed_ts!=last_updated_ts THEN 1 ELSE 0 END) attributeOnly,sum(CASE WHEN state IN ('unknown','unavailable') THEN 1 ELSE 0 END) unavailable FROM states WHERE metadata_id=?`,meta.metadata_id)[0]:null;
 const attributes=meta?all(`SELECT a.attributes_id,length(cast(a.shared_attrs as blob)) bytes,count(*) uses FROM states s JOIN state_attributes a ON a.attributes_id=s.attributes_id WHERE s.metadata_id=? GROUP BY a.attributes_id ORDER BY uses DESC LIMIT 10`,meta.metadata_id):[];
 const statHistory=statistic?all('SELECT start_ts,mean,min,max,state,sum,last_reset_ts FROM statistics WHERE metadata_id=? ORDER BY start_ts DESC LIMIT 200',statistic.id):[];
 const shortHistory=statistic?all('SELECT start_ts,mean,min,max,state,sum,last_reset_ts FROM statistics_short_term WHERE metadata_id=? ORDER BY start_ts DESC LIMIT 200',statistic.id):[];
 return json(res,{meta,statistic,history,activity,breakdown,attributes,statHistory,shortHistory});
 }
 if(u.pathname==='/api/context'){
 const c=u.searchParams.get('id');if(!/^[a-f0-9]{32}$/i.test(c||''))return json(res,{error:'Invalid context'},400);const b=Buffer.from(c,'hex');
 return json(res,{states:all('SELECT m.entity_id,s.state,s.state_id,s.last_updated_ts,hex(s.context_id_bin) context,hex(s.context_parent_id_bin) parent FROM states s LEFT JOIN states_meta m USING(metadata_id) WHERE s.context_id_bin=? ORDER BY s.last_updated_ts LIMIT 100',b),events:all('SELECT t.event_type,e.time_fired_ts,hex(e.context_parent_id_bin) parent,d.shared_data FROM events e LEFT JOIN event_types t USING(event_type_id) LEFT JOIN event_data d USING(data_id) WHERE e.context_id_bin=? ORDER BY e.time_fired_ts LIMIT 100',b).map(e=>({...e,data:parse(e.shared_data),shared_data:undefined}))});
 }
 if(u.pathname==='/api/table'){
 const name=u.searchParams.get('name');const t=analysis.tables.find(t=>t.name===name);if(!t)return json(res,{error:'Unknown table'},404);
 const offset=Math.max(0,Math.min(t.rows,Number(u.searchParams.get('offset'))||0));
 return json(res,{rows:all(`SELECT * FROM "${name}" LIMIT 50 OFFSET ?`,offset),offset,total:t.rows});
 }
 if(u.pathname.startsWith('/api/'))return json(res,{error:'Unknown endpoint'},404);
 const assets={'/':'index.html','/app.js':'app.js','/app.css':'app.css'};const file=assets[u.pathname];if(!file){res.writeHead(404);return res.end('Not found');}
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8'});fs.createReadStream(path.join(__dirname,'dist',file)).pipe(res);
 }catch(e){console.error(e.message);json(res,{error:e.message},500)}
}).listen(8765,'127.0.0.1',()=>console.log('HA DB browser: http://127.0.0.1:8765'));
