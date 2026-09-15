import 'dotenv/config';
import {db} from '../src/lib/db';
const result=await db.healthSummarySnapshot.deleteMany({where:{draftExpiresAt:{lt:new Date(Date.now()-86400000)},share:null}});
console.log(`Removed ${result.count} unissued summary previews expired for more than 24 hours. Issued snapshots were preserved.`);
await db.$disconnect();
