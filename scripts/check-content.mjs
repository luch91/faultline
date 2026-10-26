import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const textExt=/\.(?:ts|tsx|js|mjs|json|jsonc|md|html|css|yaml|yml|txt|example)$/i;
const banned=[['em dash',/\u2014/g],['generic marketing',new RegExp(['revolutionize your','unlock limitless','experience the','seamless AI-powered'].map(x=>x+'(?: workflow| potential| future| innovation)').join('|'),'gi')],['placeholder copy',new RegExp(['lorem','coming','your company'].map(x=>x+'(?: ipsum| soon| name)').join('|'),'gi')],['tracking URL',/[?&](?:utm_[a-z_]+|fbclid|gclid)=/gi]];
let failures=0;
for(const path of paths){if(!textExt.test(path)||path==='pnpm-lock.yaml')continue;let content;try{content=readFileSync(path,'utf8')}catch{continue}if(content.includes('\0'))continue;for(const[rule,pattern]of banned){for(const match of content.matchAll(pattern)){const line=content.slice(0,match.index).split('\n').length;console.error(`${path}:${line}: ${rule}`);failures++;}}}
if(failures)process.exit(1);console.log(`Content check passed for ${paths.length} tracked files.`);
