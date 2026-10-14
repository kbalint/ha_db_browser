import { t as translate, getLocale, getTimeZone, formatDateTime, useLanguage, getLanguage } from "./i18n.js";
import React, { useState, useEffect } from 'react';
const descriptions = {
  get states() {
    return translate("table_states");
  },
  get states_meta() {
    return translate("table_states_meta");
  },
  get state_attributes() {
    return translate("table_state_attributes");
  },
  get events() {
    return translate("table_events");
  },
  get event_types() {
    return translate("table_event_types");
  },
  get event_data() {
    return translate("table_event_data");
  },
  get statistics_meta() {
    return translate("table_statistics_meta");
  },
  get statistics() {
    return translate("table_statistics");
  },
  get statistics_short_term() {
    return translate("table_statistics_short_term");
  },
  get statistics_runs() {
    return translate("table_statistics_runs");
  },
  get recorder_runs() {
    return translate("table_recorder_runs");
  },
  get schema_changes() {
    return translate("table_schema_changes");
  },
  get migration_changes() {
    return translate("table_migration_changes");
  },
  get sqlite_stat1() {
    return translate("table_sqlite_stat1");
  }
};
const fields = {
  get state_id() {
    return translate("field_state_id");
  },
  get metadata_id() {
    return translate("field_metadata_id");
  },
  get state() {
    return translate("field_state");
  },
  get attributes_id() {
    return translate("field_attributes_id");
  },
  get last_updated_ts() {
    return translate("field_last_updated_ts");
  },
  get last_changed_ts() {
    return translate("field_last_changed_ts");
  },
  get last_reported_ts() {
    return translate("field_last_reported_ts");
  },
  get old_state_id() {
    return translate("field_old_state_id");
  },
  get context_id_bin() {
    return translate("field_context_id_bin");
  },
  get context_parent_id_bin() {
    return translate("field_context_parent_id_bin");
  },
  get context_user_id_bin() {
    return translate("field_context_user_id_bin");
  },
  get shared_attrs() {
    return translate("field_shared_attrs");
  },
  get shared_data() {
    return translate("field_shared_data");
  },
  get hash() {
    return translate("field_hash");
  },
  get entity_id() { return translate("field_entity_id"); },
  get statistic_id() {
    return translate("field_statistic_id");
  },
  get source() {
    return translate("field_source");
  },
  get mean() {
    return translate("field_mean");
  },
  get min() {
    return translate("field_min");
  },
  get max() {
    return translate("field_max");
  },
  get sum() {
    return translate("field_sum");
  },
  get start_ts() {
    return translate("field_start_ts");
  },
  get created_ts() {
    return translate("field_created_ts");
  },
  get has_mean() {
    return translate("field_has_mean");
  },
  get has_sum() {
    return translate("field_has_sum");
  },
  get unit_of_measurement() {
    return translate("field_unit_of_measurement");
  },
  get last_reset_ts() {
    return translate("field_last_reset_ts");
  },
  get mean_weight() {
    return translate("field_mean_weight");
  },
  get origin_idx() {
    return translate("field_origin_idx");
  },
  get event_type_id() {
    return translate("field_event_type_id");
  },
  get data_id() {
    return translate("field_data_id");
  },
  get time_fired_ts() {
    return translate("field_time_fired_ts");
  }
};
const n = x => new Intl.NumberFormat(getLocale(), {
  maximumFractionDigits: 1
}).format(x ?? 0);
const bytes = x => x >= 1073741824 ? n(x / 1073741824) + ' GiB' : x >= 1048576 ? n(x / 1048576) + ' MiB' : n(x / 1024) + ' KiB';
const date = x => x ? formatDateTime(x * 1000) : '—';
let transport = null;
export function setTransport(value) {
  transport = value;
}
const api = async url => {
  if (transport) return transport(url);
  const r = await fetch(url);
  const d = await r.json();
  if (!r.ok) throw Error(d.error);
  return d;
};
function Bars({
  items,
  onSelect,
  format = n
}) {
  const max = Math.max(1, ...items.map(i => i.value));
  return <div className="bars">{items.map(i => <button key={i.label} className="barrow" onClick={() => onSelect?.(i)} disabled={!onSelect}><span>{i.label}</span><div className="track"><div style={{
          width: i.value / max * 100 + '%'
        }} /></div><strong>{format(i.value)}</strong></button>)}</div>;
}
function Plot({
  rows,
  field,
  time
}) {
  const valid = [...rows].reverse().filter(r => r[field] !== null && r[field] !== '' && Number.isFinite(Number(r[field])));
  if (valid.length < 2) return <p>{translate("text_046")}</p>;
  const min = Math.min(...valid.map(r => Number(r[field]))),
    max = Math.max(...valid.map(r => Number(r[field]))),
    tmin = valid[0][time],
    tmax = valid.at(-1)[time];
  const points = valid.map(r => `${45 + (r[time] - tmin) / (tmax - tmin || 1) * 900},${175 - (Number(r[field]) - min) / (max - min || 1) * 145}`).join(' ');
  return <div className="plot"><svg viewBox="0 0 1000 205" role="img" aria-label={translate("text_047", {
      p0: field,
      p1: min,
      p2: max
    })}><text x="0" y="25">{n(max)}</text><text x="0" y="178">{n(min)}</text><path d="M45 185 H950" className="axis" /><polyline points={points} fill="none" stroke="var(--teal)" strokeWidth="2" />{valid.map((r, i) => <circle key={i} cx={45 + (r[time] - tmin) / (tmax - tmin || 1) * 900} cy={175 - (Number(r[field]) - min) / (max - min || 1) * 145} r="3" fill="var(--teal)"><title>{date(r[time])} · {field}: {r[field]}</title></circle>)}</svg><div className="between small"><span>{date(tmin)}</span><span>{date(tmax)}</span></div></div>;
}
function Json({
  value
}) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}
function RawTable({
  name
}) {
  const language = getLanguage();
  const [d, setD] = useState(null),
    [offset, setOffset] = useState(0),
    [error, setError] = useState('');
  useEffect(() => {
    setOffset(0);
  }, [name]);
  useEffect(() => {
    let alive = true;
    setD(null);
    api(`/api/table?name=${encodeURIComponent(name)}&offset=${offset}`).then(x => alive && setD(x)).catch(e => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [name, offset, language]);
  if (error) return <p role="alert">{error}</p>;
  if (!d) return <p>{translate("text_048")}</p>;
  return <><div className="between"><span>{n(offset + 1)}–{n(offset + d.rows.length)} / {n(d.total)} {translate("text_049")}</span><div><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>{translate("text_050")}</button><button disabled={offset + 50 >= d.total} onClick={() => setOffset(offset + 50)}>{translate("text_051")}</button></div></div><div className="overflow"><table><thead><tr>{Object.keys(d.rows[0] || {}).map(k => <th key={k}>{k}</th>)}</tr></thead><tbody>{d.rows.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}><details><summary>{v === null ? 'NULL' : String(v).slice(0, 80)}</summary><pre>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</pre></details></td>)}</tr>)}</tbody></table></div></>;
}
function Tables({
  data
}) {
  const [selected, setSelected] = useState('states'),
    [raw, setRaw] = useState(false);
  const tables = [...data.tables].sort((a, b) => total(b) - total(a)),
    t = tables.find(t => t.name === selected);
  function total(t) {
    return (t.storage?.bytes || 0) + t.indexes.reduce((s, i) => s + (i.bytes || 0), 0);
  }
  return <div className="split"><section><h2>{translate("text_052")}</h2><p className="muted">{translate("text_053")}</p>{tables.map(x => <button className={'tablepick ' + (selected === x.name ? 'selected' : '')} key={x.name} onClick={() => {
        setSelected(x.name);
        setRaw(false);
      }}><span><strong>{x.name}</strong><small>{n(x.rows)} {translate("text_054")}</small></span><span>{bytes(total(x))}</span><div className="mini"><i style={{
            width: total(x) / total(tables[0]) * 100 + '%'
          }} /></div></button>)}</section><section className="panel"><p className="eyebrow">{translate("text_055")}</p><h2>{t.name}</h2><p>{descriptions[t.name]}</p><div className="metrics compact"><Metric label={translate("text_056")} value={bytes(t.storage?.bytes || 0)} /><Metric label={translate("indexes")} value={bytes(total(t) - (t.storage?.bytes || 0))} /><Metric label={translate("text_187")} value={n(t.rows)} /></div><h3>{translate("text_057")}</h3>{t.foreignKeys.length ? t.foreignKeys.map((f, i) => <button className="relation" key={i} onClick={() => setSelected(f.table)}>{t.name}.{f.from} → {f.table}.{f.to}</button>) : <p className="muted">{translate("text_058")}</p>}{t.name === 'states_meta' || t.name === 'statistics_meta' ? <p>{translate("text_059")}</p> : null}<h3>{translate("text_060")}</h3>{t.indexes.length ? <Bars items={t.indexes.map(i => ({
        label: i.name,
        value: i.bytes || 0
      }))} format={bytes} /> : <p>{translate("text_061")}</p>}<details><summary>{translate("text_062")}</summary><table><thead><tr><th>{translate("text_063")}</th><th>{translate("text_064")}</th></tr></thead><tbody>{t.columns.map(c => <tr key={c.name}><td><code>{c.name}</code><small>{c.type}{c.pk ? translate("text_065") : ''}</small></td><td>{fields[c.name] || (c.type === 'CHAR(0)' ? translate("text_066") : translate("text_067"))}</td></tr>)}</tbody></table><pre>{t.sql}</pre></details><button onClick={() => setRaw(!raw)}>{raw ? translate("text_068") : translate("text_069")}</button>{raw && <RawTable name={t.name} />}</section></div>;
}
function Metric({
  label,
  value,
  sub
}) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>;
}
function Provenance({
  value,
  onChoose
}) {
  return <div className="context"><h3>{translate("text_070")}</h3>{value.registered ? <><p><strong>{translate("text_071")}</strong> {value.platform} · {value.configEntry?.domain || translate("yaml_no_entry")} · {value.configEntry?.title || ''}</p>{value.device && <p><strong>{translate("text_072")}</strong> {value.device.name} · {value.device.manufacturer} · {value.device.model}</p>}{value.siblings?.length > 0 && <details><summary>{translate("text_073")}</summary>{value.siblings.map(id => <button className="link" key={id} onClick={() => onChoose(id)}>{id}</button>)}</details>}</> : <p>{translate("text_074")}</p>}<small>{value.note}</small></div>;
}
function Entity({
  id,
  data,
  onChoose,
  live = false
}) {
  const language = getLanguage();
  const [d, setD] = useState(null),
    [err, setErr] = useState(''),
    [mode, setMode] = useState('history'),
    [ctx, setCtx] = useState(null),
    [field, setField] = useState('mean');
  useEffect(() => {
    let alive = true,
      busy = false;
    setD(null);
    setErr('');
    setCtx(null);
    async function load(initial = false) {
      if (busy) return;
      busy = true;
      try {
        const x = await api('/api/entity?id=' + encodeURIComponent(id));
        if (alive) {
          setD(x);
          setErr('');
          if (initial) {
            setMode(x.history.length ? 'history' : 'statistics');
            setField(x.statistic?.has_mean || x.statistic?.mean_type > 0 ? 'mean' : 'state');
          }
        }
      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        busy = false;
      }
    }
    load(true);
    const timer = live ? setInterval(() => {
      if (!document.hidden) load();
    }, 15000) : null;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [id, live, language]);
  if (err) return <p role="alert">{err}</p>;
  if (!d) return <p>{translate("text_075")}</p>;
  const attrs = d.history[0]?.attributes || {},
    stat = d.statistic,
    rows = mode === 'history' ? d.history : mode === 'statistics' ? d.statHistory : d.shortHistory;
  async function context(c) {
    try {
      setCtx({
        loading: true
      });
      setCtx(await api('/api/context?id=' + c));
    } catch (e) {
      setCtx({
        error: e.message
      });
    }
  }
  return <section className="panel entitydetail"><p className="eyebrow">{translate("text_076")}</p><h2>{attrs.friendly_name || stat?.name || id}</h2><code className="wrap">{id}</code><div className="metrics compact"><Metric label={translate("text_077")} value={n(d.meta?.rows)} /><Metric label={translate("text_078")} value={d.meta?.rows > 1 ? n((d.meta.last - d.meta.first) / (d.meta.rows - 1)) + translate("text_079") : '—'} /><Metric label={translate("text_080")} value={d.breakdown ? n(d.breakdown.attributeSets) : '—'} /></div><p><strong>{translate("text_081")}</strong> {date(d.meta?.first)} → {date(d.meta?.last)}</p><p><strong>{translate("text_082")}</strong> {attrs.device_class || id.split('.')[0]} · {attrs.unit_of_measurement || stat?.unit_of_measurement || translate("text_083")} · {attrs.state_class || translate("text_084")}.</p>{d.provenance ? <Provenance value={d.provenance} onChoose={onChoose} /> : <p><strong>{translate("text_085")}</strong> {translate("text_086")} {stat ? <>{translate("text_087")} <code>{stat.source}</code>.</> : null} {translate("text_088")} <code>.storage/core.entity_registry</code>, <code>core.device_registry</code>, <code>core.config_entries</code> {translate("text_089")}</p>}{live && <p className="muted">{translate("text_090")}</p>}<div className="flow"><span>states_meta<br /><b>{d.meta?.metadata_id ?? translate("text_091")}</b></span><span>→ states<br /><b>{n(d.meta?.rows)} {translate("text_054")}</b></span><span>→ state_attributes<br /><b>{d.breakdown ? n(d.breakdown.attributeSets) + translate("text_092") : translate("text_093")}</b></span></div>{stat && <div className="flow"><span>statistics_meta<br /><b>ID {stat.id} · {stat.source}</b></span><span>{translate("text_094")}<br /><b>{n(stat.statistics_short_term?.rows)} {translate("text_054")}</b></span><span>{translate("text_095")}<br /><b>{n(stat.statistics?.rows)} {translate("text_054")}</b></span></div>}<details open><summary>{translate("text_096")}</summary>{Object.keys(attrs).length ? <table><thead><tr><th>{translate("text_097")}</th><th>{translate("text_098")}</th></tr></thead><tbody>{Object.entries(attrs).map(([k, v]) => <tr key={k}><td>{k}</td><td className="wrap">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td></tr>)}</tbody></table> : <p>{translate("text_099")}</p>}</details>{d.breakdown && <p className="muted">{n(d.breakdown.attributeOnly)} {translate("text_100")} {n(d.breakdown.unavailable)} {translate("text_101")}</p>}<details><summary>{translate("text_102")}</summary><Bars items={d.activity.map(x => ({
        label: x.day,
        value: x.rows
      }))} /><table><thead><tr><th>{translate("text_103")}</th><th>{translate("text_104")}</th><th>{translate("text_105")}</th></tr></thead><tbody>{d.attributes.map(a => <tr key={a.attributes_id}><td>{a.attributes_id}</td><td>{bytes(a.bytes)}</td><td>{n(a.uses)}</td></tr>)}</tbody></table><p>{translate("text_106")}</p></details><div className="tabs local">{[['history', translate("text_107")], ['short', translate("five_minute")], ['statistics', translate("text_108")]].map(([v, label]) => <button key={v} className={mode === v ? 'active' : ''} onClick={() => setMode(v)}>{label}</button>)}</div><p className="muted">{translate("text_109", {timezone:getTimeZone()})}</p>{mode !== 'history' && <><p>{translate("text_110")} {date(stat?.statistics?.first)} → {date(stat?.statistics?.last)}{translate("text_111")} {date(stat?.statistics_short_term?.first)} → {date(stat?.statistics_short_term?.last)}.</p><label>{translate("text_112")} <select value={field} onChange={e => setField(e.target.value)}>{['mean', 'min', 'max', 'state', 'sum'].map(f => <option key={f}>{f}</option>)}</select></label><p className="muted">{translate("text_113")}</p></>}<Plot rows={rows} field={mode === 'history' ? 'state' : field} time={mode === 'history' ? 'last_updated_ts' : 'start_ts'} /><div className="overflow"><table><thead><tr>{mode === 'history' ? <><th>{translate("text_114")}</th><th>{translate("text_115")}</th><th>{translate("text_057")}</th></> : <><th>{translate("text_116")}</th><th>{translate("text_117")}</th><th>{translate("text_118")}</th></>}</tr></thead><tbody>{rows.map((r, i) => mode === 'history' ? <tr key={r.state_id}><td>{date(r.last_updated_ts)}<strong className="block">{r.state}</strong></td><td>{r.previous_state === null ? translate("text_119") : `${r.previous_state} → ${r.state}`}<small>{r.previous_attributes_id === r.attributes_id ? translate("text_120") : translate("text_121")}</small><details><summary>{translate("text_122")}</summary><Json value={r.attributes} /></details></td><td><small>{translate("text_123")}{r.state_id} {translate("text_124")}{r.old_state_id ?? '—'}<br />{translate("text_125")}{r.attributes_id}</small>{r.context && <button className="link" onClick={() => context(r.context)}>{translate("text_126")}</button>}{r.parentContext && <button className="link" onClick={() => context(r.parentContext)}>{translate("text_127")}</button>}</td></tr> : <tr key={i}><td>{date(r.start_ts)}</td><td>{r.mean ?? '—'} / {r.min ?? '—'} / {r.max ?? '—'}</td><td>{r.state ?? '—'} / {r.sum ?? '—'}</td></tr>)}</tbody></table></div>{!rows.length && <p>{translate("text_128")}</p>}{ctx && <div className="context" aria-live="polite"><div className="between"><h3>{translate("text_129")}</h3><button onClick={() => setCtx(null)}>{translate("text_130")}</button></div><p>{translate("text_131")}</p>{ctx.loading ? <p>{translate("text_132")}</p> : ctx.error ? <p role="alert">{ctx.error}</p> : <><h4>{translate("text_107")}</h4>{ctx.states.map(s => <p key={s.state_id}><button className="link" onClick={() => onChoose(s.entity_id)}>{s.entity_id}</button> · {s.state} · {date(s.last_updated_ts)}</p>)}<h4>{translate("text_133")}</h4>{ctx.events.map((e, i) => <details key={i}><summary>{e.event_type} · {date(e.time_fired_ts)}</summary><Json value={e.data} />{e.parent && <button onClick={() => context(e.parent)}>{translate("text_127")}</button>}</details>)}{!ctx.states.length && !ctx.events.length && <p>{translate("text_134")}</p>}</>}</div>}</section>;
}
function Entities({
  data,
  live = false
}) {
  const [q, setQ] = useState(''),
    [domain, setDomain] = useState(''),
    [sort, setSort] = useState('rows'),
    [id, setId] = useState(data.entities[0]?.entity_id),
    [page, setPage] = useState(0);
  const entities = [...data.entities, ...data.stats.filter(s => !data.entities.some(e => e.entity_id === s.statistic_id)).map(s => ({
    entity_id: s.statistic_id,
    rows: 0
  }))];
  const filtered = entities.filter(e => e.entity_id.toLowerCase().includes(q.toLowerCase()) && (!domain || e.entity_id.split('.')[0] === domain)).sort((a, b) => sort === 'name' ? a.entity_id.localeCompare(b.entity_id) : sort === 'stats' ? (data.stats.find(s => s.statistic_id === b.entity_id)?.statistics?.rows || 0) - (data.stats.find(s => s.statistic_id === a.entity_id)?.statistics?.rows || 0) : b.rows - a.rows);
  function choose(id) {
    setId(id);
  }
  return <div className="split entitysplit"><section><h2>{translate("text_135")}</h2><input aria-label={translate("text_136")} placeholder={translate("text_137")} value={q} onChange={e => {
        setQ(e.target.value);
        setPage(0);
      }} /><div className="filters"><select aria-label={translate("text_138")} value={domain} onChange={e => {
          setDomain(e.target.value);
          setPage(0);
        }}><option value="">{translate("text_139")}</option>{[...new Set(entities.map(e => e.entity_id.split('.')[0]))].sort().map(d => <option key={d}>{d}</option>)}</select><select aria-label={translate("text_140")} value={sort} onChange={e => {
          setSort(e.target.value);
          setPage(0);
        }}><option value="rows">{translate("text_141")}</option><option value="stats">{translate("text_142")}</option><option value="name">{translate("text_143")}</option></select></div><p className="muted">{n(filtered.length)} {translate("text_144")}</p>{filtered.slice(page * 40, page * 40 + 40).map(e => <button key={e.entity_id} className={'entitypick ' + (id === e.entity_id ? 'selected' : '')} onClick={() => choose(e.entity_id)}><strong>{e.entity_id}</strong><span>{n(e.rows)} {translate("text_145")}{bytes(e.rows / data.tables.find(t => t.name === 'states').rows * data.objects.filter(o => o.name === 'states' || o.name.startsWith('ix_states_') && o.name !== 'ix_states_meta_entity_id').reduce((s, o) => s + o.bytes, 0))}</span></button>)}<div className="between"><button disabled={!page} onClick={() => setPage(page - 1)}>{translate("text_050")}</button><span>{page + 1} / {Math.max(1, Math.ceil(filtered.length / 40))}</span><button disabled={(page + 1) * 40 >= filtered.length} onClick={() => setPage(page + 1)}>{translate("text_051")}</button></div></section>{id && <Entity id={id} data={data} onChoose={choose} live={live} />}</div>;
}
function Overview({
  data,
  onEntity,
  onTables
}) {
  const states = data.tables.find(t => t.name === 'states'),
    allocated = data.objects.reduce((s, o) => s + o.bytes, 0),
    indexes = data.objects.filter(o => o.name.startsWith('ix_') || o.name.startsWith('sqlite_autoindex')).reduce((s, o) => s + o.bytes, 0),
    stateBytes = data.objects.filter(o => o.name === 'states' || o.name.startsWith('ix_states_') && o.name !== 'ix_states_meta_entity_id').reduce((s, o) => s + o.bytes, 0),
    top = data.entities.slice(0, 20),
    fraction = top.reduce((s, e) => s + e.rows, 0) / states.rows;
  return <><div className="metrics"><Metric label={translate("text_146")} value={bytes(data.fileBytes)} sub={n(data.fileBytes) + translate("text_147")} /><Metric label={translate("text_148")} value={bytes(stateBytes)} sub={n(stateBytes / data.fileBytes * 100) + translate("text_149")} /><Metric label={translate("text_150")} value={bytes(indexes)} sub={translate("text_151")} /><Metric label={translate("free_pages")} value={bytes(data.freePages * data.pageSize)} sub={n(data.freePages) + ' × ' + data.pageSize + translate("text_147")} /></div><div className="insight"><p className="eyebrow">{translate("text_152")}</p><h2>{translate("text_153")}</h2><p>{n(states.rows)} {translate("text_154")} {n(fraction * 100)}{translate("text_155")}</p><p>{translate("text_156")} {n(data.freePages * data.pageSize / data.fileBytes * 100)}{translate("text_157")} {bytes(data.objects.reduce((s, o) => s + o.unused, 0))} {translate("text_158")}</p></div><div className="twocol"><section className="panel"><h2>{translate("text_159")}</h2><Bars items={[...data.tables].map(t => ({
          label: t.name,
          value: (t.storage?.bytes || 0) + t.indexes.reduce((s, i) => s + (i.bytes || 0), 0)
        })).sort((a, b) => b.value - a.value)} format={bytes} onSelect={() => onTables()} /><p className="muted">{translate("text_160")} {bytes(data.objects.find(o => o.name === 'sqlite_schema')?.bytes || 0)}{translate("text_161")} {bytes(allocated)}.</p></section><section className="panel"><h2>{translate("text_162")}</h2><Bars items={top.map(e => ({
          label: e.entity_id,
          value: e.rows
        }))} onSelect={i => onEntity(i.label)} /><p className="muted">{translate("text_163")}</p></section></div><section className="panel"><h2>{translate("text_164")}</h2><Bars items={data.days.map(d => ({
        label: d.day,
        value: d.rows
      }))} /></section><section className="panel"><h2>{translate("text_165")}</h2><p>{translate("text_166")}</p><p>{translate("text_167")}</p><p><a href="https://www.home-assistant.io/integrations/recorder/" target="_blank" rel="noreferrer">{translate("text_168")}</a> · <a href="https://data.home-assistant.io/docs/states/" target="_blank" rel="noreferrer">{translate("text_169")}</a> · <a href="https://data.home-assistant.io/docs/statistics/" target="_blank" rel="noreferrer">{translate("text_170")}</a></p></section></>;
}
function Relations({
  data
}) {
  return <><section className="panel"><h2>{translate("text_171")}</h2><div className="flow"><span>{translate("text_172")}<br /><small>{translate("text_173")}</small></span><span>{translate("text_174")}</span><span>{translate("text_175")}</span></div><div className="flow"><span>states_meta<br />entity_id ↔ metadata_id</span><span>→ states<br />{translate("text_176")}</span><span>→ state_attributes<br />{translate("text_177")}</span></div><div className="flow"><span>statistics_meta<br />statistic_id + source + unit</span><span>→ statistics_short_term<br />{translate("text_178")}</span><span>→ statistics<br />{translate("text_179")}</span></div><p>{translate("text_180")}</p><div className="flow"><span>event_types<br />{translate("text_181")}</span><span>← events<br />{translate("text_182")}</span><span>→ event_data<br />{translate("text_183")}</span></div><p>{translate("text_184")}</p></section><section className="panel"><h2>{translate("text_185")}</h2><table><thead><tr><th>{translate("text_186")}</th><th>{translate("text_187")}</th><th>{translate("text_188")}</th></tr></thead><tbody>{data.events.map(e => <tr key={e.event_type_id}><td>{e.event_type}</td><td>{n(e.rows)}</td><td>{date(e.first)}<small>{date(e.last)}</small></td></tr>)}</tbody></table></section></>;
}
function App() {
  useLanguage();
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [tab, setTab] = useState('overview'),
    [deep, setDeep] = useState(null);
  useEffect(() => {
    api('/api/overview').then(setData).catch(e => setError(e.message));
  }, []);
  if (error) return <main><h1>{translate("text_189")}</h1><p role="alert">{error}</p></main>;
  if (!data) return <main>{translate("text_190")}</main>;
  return <><header><div><div className="logo">HA</div><span><b>{translate("text_191")}</b><small>{translate("text_192")}</small></span></div><span className="badge">{translate("text_193")}</span></header><main><div className="title"><div><p className="eyebrow">HOME-ASSISTANT_V2.DB</p><h1>{translate("text_194")}</h1><p className="muted">{translate("text_195")}</p></div><span className="muted">{translate("text_196")} {data.schemaVersion?.schema_version}<br />{n(data.entities.length)} {translate("text_197")} {n(data.stats.length)} {translate("text_198")}</span></div><nav className="tabs" aria-label={translate("text_199")}>{[['overview', translate("text_200")], ['tables', translate("text_201")], ['entities', translate("entities")], ['relations', translate("text_057")]].map(([v, l]) => <button key={v} className={tab === v ? 'active' : ''} aria-pressed={tab === v} onClick={() => {
          setTab(v);
          setDeep(null);
        }}>{l}</button>)}</nav>{tab === 'overview' && <Overview data={data} onTables={() => setTab('tables')} onEntity={id => {
        setDeep(id);
        setTab('entities');
      }} />}{tab === 'tables' && <Tables data={data} />} {tab === 'entities' && (deep ? <><button onClick={() => setDeep(null)}>{translate("text_202")}</button><Entity id={deep} data={data} onChoose={setDeep} /></> : <Entities data={data} />)}{tab === 'relations' && <Relations data={data} />}<footer>{translate("text_203")} {formatDateTime(data.generated)}</footer></main></>;
}
export { App, Tables, Entities, Entity, Relations, Metric, Bars, api, bytes, n, date };
