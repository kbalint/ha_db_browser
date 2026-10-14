const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});
require('esbuild').buildSync({entryPoints:['src/local.jsx'],bundle:true,minify:true,outfile:'dist/app.js',define:{'process.env.NODE_ENV':'"production"'}});
fs.copyFileSync('src/app.css','dist/app.css');fs.copyFileSync('src/index.html','dist/index.html');
require('esbuild').buildSync({entryPoints:['src/ha-panel.jsx'],bundle:true,minify:true,format:'esm',outfile:'custom_components/ha_adatterkep/frontend/panel.js',loader:{'.css':'text'},define:{'process.env.NODE_ENV':'"production"'}});
