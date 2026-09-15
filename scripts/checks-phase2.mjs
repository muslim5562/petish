import {readFileSync,writeFileSync} from 'node:fs';
function edit(p,f){writeFileSync(p,f(readFileSync(p,'utf8')));}
edit('eslint.config.mjs',s=>s.replace('".next/**",', '".next/**", "playwright-report/**", "test-results/**",'));
edit('tsconfig.json',s=>{const p=JSON.parse(s);p.exclude=['node_modules','playwright-report','test-results','.local'];return JSON.stringify(p,null,2)+'\n';});
edit('src/app/api/health/[petId]/[[...path]]/route.ts',s=>s.replace('    const [id, action] = path;\n    if (!id) {','    const [id, action] = path;\n    if(path.length>2 || (action && action!=="revisions")) throw new HttpError(404,"Not found.");\n    if (!id) {').replace('    const [id, action] = path;\n    if (!id)\n', '    const [id, action] = path;\n    if(path.length>2) throw new HttpError(404,"Not found.");\n    if (!id)\n').replace('    const [id] = path;', '    if(path.length!==1) throw new HttpError(404,"Not found.");\n    const [id] = path;').replace('    const [id, action, fileId] = path;','    const [id, action, fileId] = path;\n    if(path.length!==1 && !(path.length===3 && action==="files" && fileId)) throw new HttpError(404,"Not found.");'));
edit('e2e/phase2.spec.ts',s=>s.replace('    const f = await (await page.request.get(`${api}/${medId}`)).json();',`    await page.locator('html').evaluate(el=>{el.style.fontSize='200%';});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.locator('html').evaluate(el=>{el.style.fontSize='';});
    expect((await page.request.patch('/api/pets/'+pet.id+'/state',{headers,data:{visibility:'PUBLIC',confirmed:true}})).ok()).toBeTruthy();
    const publicPage=await request.get('/p/'+pet.publicId);expect(publicPage.status()).toBe(200);
    expect(await publicPage.text()).not.toContain('Private QA emergency context');
    expect((await request.get(api)).status()).toBe(401);
    expect((await request.get('/api/health-files/'+fileId)).status()).toBe(404);
    expect((await other.request.get(api)).status()).toBe(404);
    const f = await (await page.request.get(\`\${api}/\${medId}\`)).json();`));
edit('README.md',s=>s.replace('# Petish — Phase 1','# Petish — Phases 1 and 2').replace('No health-record, appointment, adoption, or transfer interface is included. Those remain separate authorized phases.','Phase 2 adds a private health dashboard, chronological timeline, eight short entry forms, corrections and edit history, linked visits, private photos/PDFs, an owner-only summary, and entered-date reminders. Milo has fictional history from 2021 onward, including a synthetic medication photo and report. Controlled health sharing, appointments, adoption, and transfer remain future phases.').replace('Next proposed work is Phase 2, pet health. Do not begin it without authorization.','Phase 2 is implemented. See `docs/PHASE2.md` for acceptance evidence, privacy rules, file retention, and remaining manual checks. Phase 3 is controlled sharing and requires a separate request.').replace('Images are stored outside the relational database','Images and health PDFs are stored outside the relational database').replace('removes only unreferenced image objects','removes only unreferenced image/PDF objects'));
console.log('Verification configuration, API path handling and documentation updated.');
