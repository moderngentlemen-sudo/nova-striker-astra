// Reproducible browser package: local Three.js imports and a genuinely offline single file.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceHash } from './source-hash.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const threeRoot = resolve(root, 'node_modules/three');
const vendor = resolve(root, 'game/vendor/three');
const seen = new Set();
async function copyDependency(path) {
  path = resolve(path); if (seen.has(path)) return; seen.add(path);
  const rel = relative(threeRoot, path);
  if (rel.startsWith('..')) throw new Error(`Dependency escapes Three package: ${path}`);
  const target = join(vendor, rel); await mkdir(dirname(target), {recursive:true}); await copyFile(path,target);
  const source = await readFile(path,'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
    if (match[1].startsWith('.')) await copyDependency(resolve(dirname(path), match[1]));
  }
}
await copyDependency(join(threeRoot,'build/three.module.js'));
const sources = (await readdir(join(root,'game/js'))).filter(f=>f.endsWith('.js'));
const allImports = (await Promise.all(sources.map(f=>readFile(join(root,'game/js',f),'utf8')))).join('\n');
// Entry points currently used by the renderer; their relative dependencies are copied recursively.
for (const m of allImports.matchAll(/['"]three\/addons\/([^'"]+)['"]/g)) await copyDependency(join(threeRoot,'examples/jsm',m[1]));
await copyFile(join(threeRoot,'LICENSE'),join(vendor,'LICENSE'));
let html = await readFile(join(root,'game/index.html'),'utf8');
html = html.replace('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js','./vendor/three/build/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/','./vendor/three/examples/jsm/');
await writeFile(join(root,'game/index.html'),html);
const output = await build({entryPoints:[join(root,'game/js/main.js')],bundle:true,format:'iife',platform:'browser',target:'es2020',write:false,minify:true,legalComments:'inline'});
const css = await readFile(join(root,'game/astra.css'),'utf8');
let standalone = html.replace('<link rel="stylesheet" href="./astra.css">',`<style>\n${css}\n</style>`).replace(/<script type="importmap">[\s\S]*?<\/script>/,'');
// Font downloads are optional in the source view; the standalone uses installed fonts without network requests.
standalone = standalone.replace(/<link[^>]*https:\/\/fonts\.[^>]+>\s*/g,'');
const boot = /<script type="module">([\s\S]*?)<\/script>/;
const handler = html.match(boot)[1].split('.catch(err => {')[1].replace(/\}\);\s*$/,'');
const js = output.outputFiles[0].text.replaceAll('</script','<\\/script');
standalone = standalone.replace(boot,()=>`<script>\ntry {\n${js}\ndocument.getElementById('loading')?.remove();\n} catch(err) {${handler}}\n</script>`);
const out = join(root,'standalone/nova-striker-prototype.html'); await writeFile(out,standalone);
const fingerprint = await sourceHash(root);
const license = await readFile(join(threeRoot,'LICENSE'),'utf8');
standalone = standalone.replace('<html lang="en">',`<html lang="en">\n<meta name="astra-source-sha256" content="${fingerprint}">\n<!-- Bundled Three.js 0.170.0 license:\n${license}\n-->`);
await writeFile(out,standalone.replace(/[\t ]+$/gm,''));
console.log(`Built ${relative(root,out)} (${Math.round(Buffer.byteLength(standalone)/1024)} KiB); ${seen.size} local Three.js modules.`);
