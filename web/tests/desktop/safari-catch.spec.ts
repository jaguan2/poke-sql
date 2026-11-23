import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createSafariSession, walkSafari } from '../../src/features/safari/model';
import { nearSafariGrass, openSafariQuery } from '../fixtures/safari';
import { safariAssignment } from '../../src/features/safari/assignments';
import { zoneById } from '../../src/features/safari/zones';
import { collectionSnapshot } from '../fixtures/pc';

for (const assignmentId of ['field-notes', 'tracking'] as const) {
  test(`Windows ${assignmentId} catches once and survives restart`, async ({}, info) => {
    test.setTimeout(60000);
    const data = info.outputPath('profile'); await mkdir(data, { recursive: true });
    const env = { ...process.env, POKESQL_TEST: '1', POKESQL_TEST_DATA: data };
    delete env.ELECTRON_RUN_AS_NODE;
    const launch = () => electron.launch({ executablePath: process.env.POKESQL_EXECUTABLE,
      args: process.env.POKESQL_EXECUTABLE ? [] : ['.'], env });
    let app: Awaited<ReturnType<typeof launch>> | undefined;
    try {
      app = await launch(); let page = await app.firstWindow();
      expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(data);
      await page.locator('.cm-content').waitFor();
      let session = walkSafari(nearSafariGrass(), 'left', 1, 0, `windows-catch-${assignmentId}`);
      if (assignmentId === 'tracking') session = { ...createSafariSession('volcano'),
        encounter: { ...session.encounter!, pokemonId: 58 }, draft: 'SELECT ' };
      session.encounter!.assignmentId = assignmentId;
      const species = zoneById(session.zoneId).species.find(item => item.id === session.encounter!.pokemonId)!;
      const sql = safariAssignment(assignmentId, species).sql;
      await page.evaluate(session => {
        localStorage.setItem('pokesql:safari', JSON.stringify(session));
      }, session);
      await page.reload(); await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'Explore', exact: true }).click();
      await openSafariQuery(page);
      if (assignmentId === 'tracking') {
        await page.locator('.cm-content').fill(sql);
        await page.getByRole('button', { name: 'Preview SQL', exact: true }).click();
        expect((await collectionSnapshot(page)).captures).toHaveLength(0);
        await page.locator('.cm-content').press('ControlOrMeta+Enter');
      } else {
        await expect(page.locator('.cm-content')).toHaveText('SELECT * FROM pokedex\nWHERE name = ', { useInnerText: true });
        await page.locator('.cm-content').focus(); await page.keyboard.press('ControlOrMeta+End');
        await page.keyboard.insertText(`'${species.name.replaceAll("'", "''")}';`);
        await page.getByRole('button', { name: 'Catch Pokémon', exact: true }).click();
      }
      await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible({ timeout: 15000 });
      expect((await collectionSnapshot(page)).captures.map(item => item.pokemon.name)).toEqual([species.name]);
      await app.close(); app = await launch(); page = await app.firstWindow();
      await page.getByRole('button', { name: 'Explore', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeVisible();
      expect((await collectionSnapshot(page)).captures).toHaveLength(1);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokesql:safari')!).catches)).toBe(1);
    } finally { await app?.close(); }
  });
}
