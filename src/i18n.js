import {useSyncExternalStore} from 'react';
import en from './locales/en.json';
import hu from './locales/hu.json';
import de from './locales/de.json';

const catalogs={en,hu,de};
let language='en',timeZone='UTC';
const listeners=new Set();
export function normalizeLanguage(value){const base=String(value||'en').toLowerCase().replace('_','-').split('-')[0];return Object.hasOwn(catalogs,base)?base:'en';}
export function configureLanguage(hass={}){
 const next=normalizeLanguage(hass.language||hass.locale?.language||hass.config?.language||'en');
 const zone=hass.config?.time_zone||'UTC';
 if(next===language&&zone===timeZone)return;
 language=next;timeZone=zone;for(const listener of listeners)listener();
}
export const getLanguage=()=>language;
export const getTimeZone=()=>timeZone;
export const getLocale=()=>({en:'en-GB',hu:'hu-HU',de:'de-DE'})[language];
export const formatDateTime=value=>new Date(value).toLocaleString(getLocale(),{timeZone});
export function t(key,values={}){const text=catalogs[language][key]??en[key];if(text===undefined)throw Error('Missing translation: '+key);return text.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??'{'+name+'}'));}
export function useLanguage(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener)},()=>language+'|'+timeZone,()=> 'en|UTC');}
