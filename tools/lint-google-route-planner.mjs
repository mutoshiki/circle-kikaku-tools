import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const routeFiles = [
  'maps-config.js','assets/js/core/google-maps-loader.js','assets/js/features/settlement/01-state.js',
  'assets/js/features/settlement/04-route-helper.js','assets/js/templates/settlement/08-route-helper-templates.js',
  'assets/css/settlement/route-helper/01-route-shell.css','assets/css/settlement/route-helper/02-route-stops.css',
  'assets/css/settlement/route-helper/03-route-candidates.css'
];
for (const file of routeFiles) if (!fs.existsSync(path.join(root,file))) failures.push(`missing ${file}`);
const all=[];
(function walk(dir){ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(['node_modules','dist','test-results','playwright-report','.git'].includes(e.name)) continue; const f=path.join(dir,e.name); if(e.isDirectory()) walk(f); else if(/\.(?:js|mjs|html|css|json)$/.test(e.name)) all.push(f); } })(root);
const key=read('maps-config.js').match(/apiKey:\s*['"]([^'"]+)['"]/)?.[1]||'';
const owners=key?all.filter(f=>fs.readFileSync(f,'utf8').includes(key)):[];
if(!key || owners.length!==1 || path.relative(root,owners[0])!=='maps-config.js') failures.push(`Google Maps API key must exist only in maps-config.js; found ${owners.map(f=>path.relative(root,f)).join(', ')}`);
const route=read('assets/js/features/settlement/04-route-helper.js');
const combined=route+read('assets/js/templates/settlement/08-route-helper-templates.js')+read('index.html');
for(const x of ['DirectionsService','DistanceMatrixService','AutocompleteService','PlaceAutocompleteElement','gmp-place-autocomplete']) if(route.includes(x)) failures.push(`forbidden Google/legacy UI usage: ${x}`);
for(const x of ['AutocompleteSuggestion.fetchAutocompleteSuggestions','AutocompleteSessionToken','.toPlace()','fetchFields','locationBias: JAPAN_SEARCH_BIAS',"language: 'ja'","region: 'jp'",'Route.computeRoutes','computeAlternativeRoutes','routeModifiers','requestSequence','scheduleRouteRequest','refreshMapAfterOpen']) if(!route.includes(x)) failures.push(`missing route contract: ${x}`);
if(!combined.includes('<cds-text-input')) failures.push('route place fields must use Carbon Text Input');
if(!combined.includes('<cds-button')) failures.push('route actions must use Carbon Button');
if(/\bunits\s*:/.test(route)) failures.push('Routes request must omit units');
if(/includedRegionCodes/.test(route)) failures.push('Japan preference must not hard-restrict results');
if(!route.includes('retryRoutePlanner')) failures.push('Google failures need retry');
for(const file of routeFiles.filter(f=>f.endsWith('.css'))){const css=read(file).replace(/\/\*[\s\S]*?\*\//g,'');if((css.match(/{/g)||[]).length!==(css.match(/}/g)||[]).length)failures.push(`unbalanced CSS braces: ${file}`);if(/!important/.test(css))failures.push(`route owner must not use !important: ${file}`);}
for(const file of routeFiles.filter(f=>/\.m?js$/.test(f))){const r=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});if(r.status!==0)failures.push(`${file}: ${r.stderr||r.stdout}`);}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}console.log(`Google route planner lint: PASS (${routeFiles.length} owner files)`);
