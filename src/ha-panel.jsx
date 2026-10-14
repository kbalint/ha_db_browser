import { t, getTimeZone, formatDateTime, configureLanguage, getLanguage, useLanguage } from "./i18n.js";
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { setTransport, api, Tables, Entities, Entity, Relations, Metric, Bars, bytes, n, date } from './app.jsx';
import css from './app.css';
function LivePanel() {
  const language = useLanguage();
  const [snapshot, setSnapshot] = useState(null),
    [status, setStatus] = useState({}),
    [live, setLive] = useState(null),
    [tab, setTab] = useState('overview'),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(null),
    [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let alive = true,
      busy = false,
      generation = '';
    async function load() {
      if (busy) return;
      busy = true;
      try {
        const result = await api('/api/overview?generation=' + encodeURIComponent(generation));
        if (alive) {
          if (!result.unchanged) {
            setSnapshot(result.analysis);
            generation = result.analysis?.generated || '';
          }
          setStatus(result.status);
        }
        const current = await api('/api/live');
        if (alive) {
          setLive(current);
          setError('');
        }
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        busy = false;
      }
    }
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [language]);
  async function refresh() {
    setRefreshing(true);
    try {
      setStatus(await api('/api/refresh'));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }
  async function cancel() {
    try {
      setStatus(await api('/api/cancel'));
    } catch (e) {
      setError(e.message);
    }
  }
  const states = snapshot?.tables.find(t => t.name === 'states'),
    stateStorage = states ? (states.storage?.bytes || 0) + states.indexes.reduce((s, i) => s + (i.bytes || 0), 0) : 0;
  return <div className="adatterkep-app"><header><div><div className="logo">HA</div><span><b>{t("text_191")}</b><small>{t("text_204")}</small></span></div><span className="badge">{t("text_205")}</span></header><main><div className="title"><div><p className="eyebrow">HOME ASSISTANT RECORDER</p><h1>{t("text_194")}</h1><p className="muted">{t("text_206")}</p></div><div><button disabled={status.running || refreshing} onClick={refresh}>{status.running ? t("text_207") : snapshot ? t("text_208") : t("text_209")}</button>{status.running && <button onClick={cancel}>{t("text_210")}</button>}</div></div>{error && <p role="alert" className="context">{error}</p>}{status.error && <p role="alert" className="context">{status.error}</p>}{status.running && <p aria-live="polite">{t("text_211")} {['idle','queued','starting','complete','cancelled','error'].includes(status.phase)?t('phase_'+status.phase):status.phase} {t("text_212")} {n(status.rowsRead)} {t("text_213")}</p>}<div className="metrics"><Metric label={t("text_214")} value={live ? bytes(live.fileBytes) : '—'} /><Metric label={t("text_215")} value={live ? bytes(live.walBytes) : '—'} sub={t("text_216")} /><Metric label={t("text_217")} value={live?.latest ? '#' + live.latest.state_id : '—'} sub={date(live?.latest?.last_updated_ts)} /><Metric label={t("free_pages_now")} value={live ? bytes(live.freePages * live.pageSize) : '—'} /></div><nav className="tabs" aria-label={t("text_199")}>{[['overview', t("text_200")], ['tables', t("text_201")], ['entities', t("entities")], ['relations', t("text_057")]].map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => {
          setTab(id);
          setSelected(null);
        }}>{label}</button>)}</nav>{!snapshot ? <section className="panel"><h2>{t("text_218")}</h2><p>{t("text_219")}</p><p>{t("text_220")}</p></section> : <><p className="muted">{t("text_221")} {formatDateTime(snapshot.generated)} {t("text_222")}</p>{!snapshot.storageAvailable && <p role="alert" className="context">{t("text_223")}</p>}{tab === 'overview' && <><section className="panel"><h2>{t("text_224")}</h2><p>{n(states?.rows)} {t("text_225")} {bytes(stateStorage)} {t("text_226")} {n(snapshot.entities.length)} {t("text_227")} {n(snapshot.stats.length)} {t("text_228")}</p><Bars items={snapshot.tables.map(t => ({
              label: t.name,
              value: (t.storage?.bytes || 0) + t.indexes.reduce((s, i) => s + (i.bytes || 0), 0)
            })).sort((a, b) => b.value - a.value)} format={bytes} /></section><section className="panel"><h2>{t("text_162")}</h2><Bars items={snapshot.entities.slice(0, 20).map(e => ({
              label: e.entity_id,
              value: e.rows
            }))} onSelect={e => {
              setSelected(e.label);
              setTab('entities');
            }} /></section><section className="panel"><h2>{t("text_229")}</h2><Bars items={snapshot.days.map(d => ({
              label: d.day,
              value: d.rows
            }))} /></section></>}{tab === 'tables' && <Tables data={snapshot} />} {tab === 'entities' && (selected ? <><button onClick={() => setSelected(null)}>{t("text_230")}</button><Entity id={selected} data={snapshot} live onChoose={setSelected} /></> : <Entities data={snapshot} live />)}{tab === 'relations' && <Relations data={snapshot} />}</>}<footer>{t("text_231")}</footer></main></div>;
}
class AdatterkepPanel extends HTMLElement {
  connectedCallback() {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({
          mode: 'open'
        }),
        style = document.createElement('style');
      style.textContent = css.replace(':root{', ':host{display:block;').replace('body{', '.adatterkep-app{');
      shadow.append(style);
      this.container = document.createElement('div');
      shadow.append(this.container);
    }
    this.mount();
  }
  set hass(value) {
    this._hass = value;
    configureLanguage(value);
    this.lang = getLanguage();
    if (this.isConnected) this.mount();
  }
  mount() {
    if (!this._hass || this.root) return;
    setTransport(url => {
      const parsed = new URL(url, 'https://local.invalid'),
        action = parsed.pathname.split('/').at(-1),
        params = Object.fromEntries(parsed.searchParams);
      if (params.offset !== undefined) params.offset = Number(params.offset);
      params.language = getLanguage();
      return this._hass.callWS({
        type: 'ha_adatterkep/query',
        action,
        params
      });
    });
    this.root = createRoot(this.container);
    this.root.render(<LivePanel />);
  }
  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }
}
if (!customElements.get('ha-adatterkep-panel')) customElements.define('ha-adatterkep-panel', AdatterkepPanel);
