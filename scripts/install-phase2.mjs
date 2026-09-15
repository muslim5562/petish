import 'dotenv/config';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {Client} from 'pg';
const source=process.argv[2];
const p='prisma/schema.prisma';let schema=readFileSync(p,'utf8');
if(schema.includes('model HealthRecord'))throw new Error('Phase 2 schema already present; will not overwrite it.');
const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
const {rows}=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");const snapshot={};
for(const {tablename} of rows){const safe=tablename.replaceAll('"','""');snapshot[tablename]=(await client.query(`SELECT * FROM "${safe}"`)).rows;}
await client.query('COMMIT');await client.end();
const backup=path.join('.local/backups',`before-phase2-${Date.now()}`);mkdirSync(backup,{recursive:true});writeFileSync(path.join(backup,'records.json'),JSON.stringify(snapshot));writeFileSync(path.join(backup,'schema.prisma'),schema);
schema=schema.replace('  ownerships PetOwnership[]\n  createdAt','  healthRecords HealthRecord[]\n  healthContext PetHealthContext?\n  healthContextRevisions HealthContextRevision[]\n  ownerships PetOwnership[]\n  createdAt');
if(!schema.includes('healthRecords HealthRecord[]'))throw new Error('Could not locate the Pet relation insertion point');
writeFileSync(p,schema+readFileSync(source,'utf8'));console.log('Existing records snapshotted in ignored .local/backups; additive health schema prepared.');
