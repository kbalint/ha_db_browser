import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app.jsx';
import {configureLanguage,getLanguage} from './i18n.js';
configureLanguage({language:new URLSearchParams(location.search).get('lang')||'en'});
document.documentElement.lang=getLanguage();
createRoot(document.getElementById('root')).render(<App/>);
