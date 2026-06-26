const { chromium } = require('@playwright/test');
const fs=require('fs'); const path=require('path');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('console',m=>console.log('console',m.type(),m.text()));
 page.on('pageerror',e=>console.log('pageerror',e.message));
 await page.route('https://app.local/**', async route=>{
   const u=new URL(route.request().url());
   let rel=u.pathname.replace(/^\//,'')||'index.html';
   const file=path.join(process.cwd(),rel);
   if(fs.existsSync(file)&&fs.statSync(file).isFile()){
     const ext=path.extname(file); const ct={'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.woff2':'font/woff2'}[ext]||'application/octet-stream';
     return route.fulfill({status:200,contentType:ct,body:fs.readFileSync(file)});
   }
   return route.fulfill({status:404,body:'not found'});
 });
 await page.route('https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',r=>r.fulfill({status:200,contentType:'text/css',body:fs.readFileSync('node_modules/bootstrap/dist/css/bootstrap.min.css')}));
 await page.route('https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js')}));
 await page.route('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',r=>r.fulfill({status:200,contentType:'text/css',body:fs.readFileSync('node_modules/@fortawesome/fontawesome-free/css/all.min.css')}));
 await page.route('https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync('node_modules/sortablejs/Sortable.min.js')}));
 await page.goto('about:blank');
 let html=fs.readFileSync('index.html','utf8').replace('<head>','<head><base href="https://app.local/">');
 await page.setContent(html,{waitUntil:'load'});
 console.log('url',page.url(),'title',await page.title());
 await page.waitForTimeout(2000);
 console.log('switch',await page.evaluate(()=>typeof window.switchView));
 await page.screenshot({path:'/tmp/test-setcontent.png',fullPage:true});
 await browser.close();
})();
