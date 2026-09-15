import {spawn} from 'node:child_process';
import {hostedConfigProblems} from './hosted-config.mjs';
const problems=hostedConfigProblems(process.env);
if(problems.length){console.error('Hosted setup is incomplete:\n'+problems.map(p=>'- '+p).join('\n'));process.exit(1);}
function run(file,args){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file,...args],{stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Startup step failed (${code}).`)));});}
await run('node_modules/prisma/build/index.js',['migrate','deploy']);
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',process.env.PORT||'3000'],{stdio:'inherit',windowsHide:true});
process.on('SIGTERM',()=>app.kill('SIGTERM'));process.on('SIGINT',()=>app.kill('SIGINT'));app.on('error',()=>process.exit(1));app.on('exit',code=>process.exit(code??1));
