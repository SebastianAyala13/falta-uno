const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox'],headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  const base=process.env.BASE_URL??'http://localhost:8085';page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.getByText('Echar un vistazo como invitado →',{exact:true}).click();
  await page.getByText('Cancha La Bombonera',{exact:true}).first().click();
  await page.getByLabel('Opciones de moderación',{exact:true}).first().click();
  await page.getByText('Reportar contenido',{exact:true}).click();
  for(const text of ['Spam o estafa','Acoso o bullying','Contenido sexual o abuso de menores','Odio o violencia','Otro','Cancelar'])await page.getByText(text,{exact:true}).waitFor();
  await page.getByText('Cancelar',{exact:true}).click();
  await page.goto(base+'/perfil');
  for(const text of ['Política de privacidad','Términos de uso','Normas de la comunidad','Ayuda y contacto','Eliminar cuenta'])await page.getByText(text,{exact:true}).waitFor();
  await page.getByText('Eliminar cuenta',{exact:true}).click();await page.getByText('Cancelar',{exact:true}).click();
  await page.getByText('Eliminar cuenta',{exact:true}).waitFor();
  for(const theme of ['Esmeralda','Azul','Morado','Rosado','Rojo','Naranja','Blanco']){
   await page.goto(base+'/apariencia');await page.getByText(theme,{exact:true}).click();await page.goto(base+'/perfil');await page.getByText('Ayuda y contacto',{exact:true}).waitFor();
  }
  await page.setViewportSize({width:1024,height:768});await page.getByText('Política de privacidad',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: reports include all reasons, profile legal/help links, cancel deletion, seven themes and tablet layout; no browser exceptions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
