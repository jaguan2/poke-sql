import { readFile } from 'node:fs/promises';
import initSqlJs from 'sql.js';
const SQL = await initSqlJs();
const db = new SQL.Database(await readFile(new URL('../public/pokemon.sqlite', import.meta.url)));
const ids = db.exec('SELECT id FROM pokemon')[0].values.map(row => row[0]);
db.close();
const missing = [];
for (const id of ids) {
  try {
    const data = await readFile(new URL(`../public/sprites/${id}.png`, import.meta.url));
    if (data.length < 32 || data.readUInt32BE(0) !== 0x89504e47) missing.push(id);
  } catch { missing.push(id); }
}
if (missing.length) throw new Error(`${missing.length} sprites missing or invalid. Run npm run sprites before building.`);
console.log(`Verified ${ids.length} bundled sprites.`);
