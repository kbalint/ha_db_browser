const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const db=new DatabaseSync('home-assistant_v2.db',{readOnly:true});
db.exec('PRAGMA query_only=ON');
const all=(s,...p)=>db.prepare(s).all(...p);
const schema=all("SELECT name,type,tbl_name,sql FROM sqlite_master");
console.log('Page sizes…');
const objects=all('SELECT name,sum(pgsize) bytes,sum(payload) payload,sum(unused) unused,count(*) pages FROM dbstat GROUP BY name');
const tables=schema.filter(x=>x.type==='table').map(t=>({...t,columns:all(`PRAGMA table_info("${t.name}")`),foreignKeys:all(`PRAGMA foreign_key_list("${t.name}")`),rows:all(`SELECT count(*) n FROM "${t.name}"`)[0].n,storage:objects.find(o=>o.name===t.name),indexes:schema.filter(i=>i.type==='index'&&i.tbl_name===t.name).map(i=>({...i,...objects.find(o=>o.name===i.name)}))}));
console.log('Entity state activity…');
const entities=all(`SELECT m.metadata_id,m.entity_id,count(s.state_id) rows,min(s.last_updated_ts) first,max(s.last_updated_ts) last,sum(length(cast(s.state as blob))) stateBytes FROM states_meta m LEFT JOIN states s ON s.metadata_id=m.metadata_id GROUP BY m.metadata_id ORDER BY rows DESC`);
console.log('Statistical time series…');
const stats=all('SELECT * FROM statistics_meta');
for(const table of ['statistics','statistics_short_term']) {
 const counts=all(`SELECT metadata_id,count(*) rows,min(start_ts) first,max(start_ts) last FROM ${table} GROUP BY metadata_id`);
 for(const c of counts){const s=stats.find(s=>s.id===c.metadata_id);if(s)s[table]=c;}
}
console.log('Daily activity…');
const days=all("SELECT strftime('%Y-%m-%d',last_updated_ts,'unixepoch') day,count(*) rows FROM states GROUP BY day ORDER BY day");
const events=all('SELECT t.event_type_id,t.event_type,count(e.event_id) rows,min(e.time_fired_ts) first,max(e.time_fired_ts) last FROM event_types t LEFT JOIN events e USING(event_type_id) GROUP BY t.event_type_id ORDER BY rows DESC');
const result={generated:new Date().toISOString(),fileBytes:fs.statSync('home-assistant_v2.db').size,pageSize:all('PRAGMA page_size')[0].page_size,pageCount:all('PRAGMA page_count')[0].page_count,freePages:all('PRAGMA freelist_count')[0].freelist_count,schemaVersion:all('SELECT * FROM schema_changes ORDER BY change_id DESC LIMIT 1')[0],objects,tables,entities,stats,days,events};
fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/analysis.json',JSON.stringify(result));
console.log(JSON.stringify({tables:tables.map(t=>({name:t.name,rows:t.rows})),topEntities:entities.slice(0,20),days,statSources:[...new Set(stats.map(s=>s.source))]},null,2));
db.close();
