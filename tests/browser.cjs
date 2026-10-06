// Requires Playwright and Chromium in the verification environment, no app dependency.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const base=process.env.BASE_URL??'http://localhost:8085';
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.getByText('Echar un vistazo como invitado →',{exact:true}).click();
  await page.getByText('Cancha La Bombonera',{exact:true}).first().click();
  await page.getByText('Unirme y pagar',{exact:true}).click();
  await page.getByText('Pagar $12.000',{exact:true}).click();
  await page.getByText('Comprobante',{exact:true}).waitFor();
  assert.match(await page.locator('body').innerText(),/12\.000/);
  await page.goto(base+'/apariencia');
  for(const theme of ['Esmeralda','Azul','Morado','Rosado','Rojo','Naranja','Blanco']) await page.getByText(theme,{exact:true}).click();
  await page.reload();await page.getByText('Blanco',{exact:true}).waitFor();
  await page.goto(base+'/buscar');await page.getByPlaceholder('Cancha, zona, parche...').fill('Bombonera');
  await page.getByText('Cancha La Bombonera',{exact:true}).waitFor();
  assert.equal(await page.getByText('Sintética El Jardín',{exact:true}).count(),0);
  await page.goto(base+'/partido/inexistente');await page.getByText('Este partido ya no existe',{exact:false}).waitFor({timeout:5000});
  assert.deepEqual(errors,[]);
  console.log('PASS: demo cash payment, seven themes, filtered search, invalid route; no browser exceptions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
