import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
export async function sourceHash(root) {
  const files = ['game/index.html','game/astra.css',...(await readdir(join(root,'game/js'))).filter(f=>f.endsWith('.js')).map(f=>'game/js/'+f)].sort();
  const hash=createHash('sha256');
  for(const file of files){hash.update(file);hash.update((await readFile(join(root,file),'utf8')).replace(/\r\n/g,'\n'));}
  return hash.digest('hex');
}
