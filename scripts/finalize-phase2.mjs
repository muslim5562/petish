import {readFileSync,writeFileSync} from 'node:fs';
function edit(p,f){writeFileSync(p,f(readFileSync(p,'utf8')));}
edit('src/lib/health.ts',s=>s.replace('export async function saveHealthRecord',`async function resetAllergyKnowledge(tx:Prisma.TransactionClient,petId:string,ownerId:string){
 const old=await tx.petHealthContext.findUnique({where:{petId}});
 if(old?.allergyKnowledge!=='NO_KNOWN')return;
 const saved=await tx.petHealthContext.update({where:{petId},data:{allergyKnowledge:'UNKNOWN',updatedBy:ownerId,version:{increment:1}}});
 await tx.healthContextRevision.create({data:{petId,version:saved.version,actorId:ownerId,snapshot:snapshot(saved)}});
}
export async function saveHealthRecord`).replace("if(input.kind==='ALLERGY'){const data=", "if(input.kind==='ALLERGY'){await resetAllergyKnowledge(tx,petId,ownerId);const data=").replace(' const r=await tx.healthRecord.update({where:{id},data:{deletedAt:'," if(restore&&old.kind==='ALLERGY')await resetAllergyKnowledge(tx,petId,ownerId);\n const r=await tx.healthRecord.update({where:{id},data:{deletedAt:"));
edit('src/components/health-space.tsx',s=>s.replace('Hospital,ImageIcon,Info','Hospital,Info').replace(" const items=data.records.filter(r=>(filter==='REMOVED'?!!r.deletedAt:!r.deletedAt&&(filter==='ALL'||r.kind===filter))", " const effectiveFilter=filter==='ALL'&&healthKinds.includes(query.get('type') as HealthKind)?query.get('type')!:filter;\n const items=data.records.filter(r=>(effectiveFilter==='REMOVED'?!!r.deletedAt:!r.deletedAt&&(effectiveFilter==='ALL'||r.kind===effectiveFilter))").replace("items.filter(r=>filter!=='ALL'||!query.get('type')||r.kind===query.get('type')).map",'items.map'));
edit('prisma/seed.ts',s=>s.replace('await db.$disconnect();', 'await db.$disconnect();\nawait import("./seed-health");'));
edit('package.json',s=>{const p=JSON.parse(s);p.scripts['cleanup:health']='tsx scripts/cleanup-health.ts';return JSON.stringify(p,null,2)+'\n';});
console.log('Phase 2 consistency and seed integration completed.');
