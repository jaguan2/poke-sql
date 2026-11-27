import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createSafariSession } from '../../src/features/safari/model';

test('Windows smooth overworld restores Surf after a local-only application restart', async ({}, info) => {
  test.setTimeout(75000);
  const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
  const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data }; delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
    args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch(); let page = await app.firstWindow();
    expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(data);
    await page.locator('.cm-content').waitFor();
    await page.evaluate(session => localStorage.setItem('pokesql:safari', JSON.stringify(session)), {
      ...createSafariSession('route-103'), position: { x: 21, y: 9 }, direction: 'right',
      exploration: { enabled: true, mapId: 'route-103', x: 21, y: 9, direction: 'right', mode: 'walking', autoSurf: false },
    });
    await page.reload();
    await page.clock.install({ time: new Date('2026-11-27T12:00:00Z') }); await page.clock.pauseAt('2026-11-27T12:00:01Z');
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    const map = page.locator('.smooth-overworld'); await expect(map).toHaveAttribute('data-ready', 'true');
    await page.clock.runFor(100); await map.focus(); await page.keyboard.press('f'); await page.clock.runFor(300);
    await expect(map).toHaveAttribute('data-mode', 'surfing');
    await map.focus(); await page.keyboard.down('d'); await page.clock.runFor(350); await page.keyboard.up('d'); await page.clock.runFor(200);
    const x = Number(await map.getAttribute('data-x')); expect(x).toBeGreaterThan(22.5);
    await page.screenshot({ path: info.outputPath('desktop-surf.png') });
    await writeFile(info.outputPath('overworld-state.json'), await page.evaluate(() => localStorage.getItem('pokesql:safari')!));
    await app.close(); app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await expect(page.locator('.smooth-overworld')).toHaveAttribute('data-mode', 'surfing');
    expect(Math.abs(Number(await page.locator('.smooth-overworld').getAttribute('data-x')) - x)).toBeLessThan(.05);
    expect(await page.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');
    expect(page.url()).toContain('pokesql://app');
  } finally { await app?.close().catch(() => {}); }
});
