import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);let failures=0;
for(const path of paths){if(/\.(?:png|jpg|jpeg|gif|webp|ico|woff2?|lock)$/i.test(path))continue;let content;try{content=readFileSync(path,'utf8')}catch{continue}if(content.includes('\0'))continue;if(/\.dev\.vars$|^\.env$|^\.env\./.test(path)&&path!=='.env.example'){console.error(`${path}:1: local secrets file tracked`);failures++;continue}for(const [rule,pattern]of [['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],['token assignment',/(?:MODEL_API_KEY|CLOUDFLARE_API_TOKEN)\s*=\s*['"]?[A-Za-z0-9_-]{20,}/g]])for(const match of content.matchAll(pattern)){console.error(`${path}:${content.slice(0,match.index).split('\n').length}: ${rule}`);failures++;}}
if(failures)process.exit(1);console.log('Secret pattern check passed.');
