import 'dotenv/config';
import {Client} from 'pg';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const root=path.resolve('.local/phone-preview');await mkdir(root,{recursive:true});
const original=new URL(process.env.DATABASE_URL);if(!['127.0.0.1','localhost'].includes(original.hostname))throw new Error('Phone preview setup requires the running local demo database.');
const database='petish_phone_preview';if(original.pathname==='/'+database)throw new Error('Run from the primary project .env.');
const client=new Client({connectionString:original.toString()});await client.connect();
if(!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount)await client.query('CREATE DATABASE "petish_phone_preview"');await client.end();
let secrets;try{secrets=JSON.parse(await readFile(path.join(root,'secrets.json'),'utf8'));}catch{secrets={auth:randomBytes(40).toString('hex'),password:randomBytes(24).toString('hex')};await writeFile(path.join(root,'secrets.json'),JSON.stringify(secrets));}
const previewDb=new URL(original);previewDb.pathname='/'+database;
const env={...process.env,DATABASE_URL:previewDb.toString(),BETTER_AUTH_SECRET:secrets.auth,DEMO_PASSWORD:secrets.password,PETISH_DEMO:'true',PETISH_PHONE_PREVIEW:'true',PETISH_OBJECTS_ROOT:path.join(root,'objects'),MAIL_MODE:'local',STORAGE_DRIVER:'local',NODE_ENV:'production'};
let app,tunnel;const children=[];let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
async function run(file,args){await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file,...args],{env,stdio:'inherit',windowsHide:true});children.push(child);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Preview preparation failed (${code}).`)));});}
try{
 await run('node_modules/prisma/build/index.js',['migrate','deploy']);await run('node_modules/tsx/dist/cli.mjs',['prisma/seed.ts']);
 let output='';tunnel=spawn(path.resolve('.local/tools/cloudflared.exe'),['tunnel','--url','http://127.0.0.1:3002','--no-autoupdate'],{windowsHide:true,stdio:['ignore','pipe','pipe']});children.push(tunnel);
 const url=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('No HTTPS preview URL received within 60 seconds.')),60000);const receive=chunk=>{output=(output+chunk.toString()).slice(-16000);const match=output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(match){clearTimeout(timeout);resolve(match[0]);}};tunnel.stdout.on('data',receive);tunnel.stderr.on('data',receive);tunnel.on('error',error=>{clearTimeout(timeout);reject(error);});tunnel.on('exit',()=>{clearTimeout(timeout);reject(new Error('The HTTPS tunnel stopped.'));});});
 env.BETTER_AUTH_URL=url;
 app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3002'],{env,stdio:'inherit',windowsHide:true});children.push(app);
 app.on('exit',()=>stop());tunnel.on('exit',()=>stop());
 await writeFile(path.join(root,'preview.json'),JSON.stringify({url,port:3002,appPid:app.pid,tunnelPid:tunnel.pid,createdAt:new Date().toISOString()},null,2));
 console.log(`Phone preview: ${url}/install\nShared synthetic demo only. Keep this process and the computer running. Ctrl+C stops the preview.`);
}catch(error){stop();throw error;}
