// Render the bundled game Poké Ball sprite; wrap the PNG in a Windows ICO container.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
  const sprite = await readFile(new URL('../public/sprites/items/poke-ball.png', import.meta.url));
  await page.setContent(`<style>body{margin:0;background:transparent}img{width:256px;height:256px;image-rendering:pixelated}</style><img src="data:image/png;base64,${sprite.toString('base64')}" />`);
  await page.locator('img').evaluate(image => image.decode());
  const png = await page.screenshot({ omitBackground: true });
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  await writeFile(new URL('../desktop/icon.ico', import.meta.url), Buffer.concat([header, png]));
  console.log('Created desktop/icon.ico from the bundled Poké Ball sprite');
} finally { await browser.close(); }
