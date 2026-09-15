import {readFileSync,writeFileSync} from 'node:fs';
function edit(p,f){writeFileSync(p,f(readFileSync(p,'utf8')));}
edit('src/app/health.css',s=>s+'\n.health-space .fine-print, .health-form-page .fine-print { color: #655d68; }\n');
edit('prisma/seed-health.ts',s=>s.replace('import "dotenv/config";','import "dotenv/config";\nimport {readFile} from "node:fs/promises";').replace('console.log("Fictional health',`if(owner&&pet){
 const photoMarker='Seeded fictional medication photo';
 const med=await db.healthRecord.findFirst({where:{petId:pet.id,title:'Skin prescription — fictional example',deletedAt:null}});
 if(med&&!await db.auditLog.findFirst({where:{petId:pet.id,action:photoMarker}})){
  if(!await db.attachment.count({where:{recordId:med.id}}))await addHealthFile(owner.id,pet.id,med.id,new File([new Uint8Array(await readFile('public/demo/fictional-medication.png'))],'fictional-medication.png',{type:'image/png'}),'AI-generated fictional packaging — not a real medicine');
  await db.auditLog.create({data:{actorId:owner.id,petId:pet.id,action:photoMarker}});
 }
}
console.log("Fictional health`));
edit('tests/health.test.ts',s=>s.replace("allergy=await removeOrRestoreHealth(owner.id,p.id,allergy.id,allergy.version,true);", "await removeOrRestoreHealth(owner.id,p.id,allergy.id,allergy.version,true);"));
console.log('Health contrast and fictional medication attachment updated.');
