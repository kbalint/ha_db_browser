const fs=require('node:fs');const [url,maintainer]=process.argv.slice(2);
if(!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(url||'')||!/^@[A-Za-z0-9-]+$/.test(maintainer||'')){
 console.error('Usage: node scripts/configure-repository.cjs https://github.com/USER/REPO @MAINTAINER');process.exit(1);
}
const file='custom_components/ha_adatterkep/manifest.json',manifest=JSON.parse(fs.readFileSync(file));manifest.documentation=url.replace(/\/$/,'');manifest.issue_tracker=manifest.documentation+'/issues';manifest.codeowners=[maintainer];fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');console.log('Repository metadata configured.');
