import { test, expect } from '@playwright/test';
import { createBag, itemQuantity, useBagItem } from '../../src/features/safari/bag-model';
import { changeSafariZone, createSafariSession, restoreSafariSession, walkSafari } from '../../src/features/safari/model';
import { nearSafariGrass } from '../fixtures/safari';

test('Repel prevents a guaranteed encounter, consumes real steps, and expires before the next encounter', () => {
  const initial = nearSafariGrass();
  const used = useBagItem(createBag(), 0, 'repel');
  expect(itemQuantity(0, 'repel')).toBe(Infinity);
  const session = { ...initial, bag: { ...used, repelSteps: 1 } };
  const finalProtectedStep = walkSafari(session, 'left', 0, 0, 'protected');
  expect(finalProtectedStep).toMatchObject({ encounter: null, bag: { repelSteps: 0 }, steps: 1, grassSteps: 0 });
  const nextEncounter = walkSafari({ ...finalProtectedStep, position: initial.position }, 'left', 0, 0, 'unprotected');
  expect(nextEncounter.encounter).toMatchObject({ pokemonId: 10, id: 'unprotected' });
});

test('blocked walking, existing encounters, and stacking Repels never spend steps or supplies', () => {
  const bag = useBagItem(createBag(), 0, 'super-repel');
  const session = { ...createSafariSession('forest'), position: { x: 2, y: 8 }, bag };
  expect(walkSafari(session, 'left', 0, 0, 'wall')).toMatchObject({ steps: 0, bag: { repelSteps: 200 } });
  expect(useBagItem(bag, 0, 'max-repel')).toEqual(bag);
  expect(itemQuantity(0, 'max-repel')).toBe(Infinity);
  const encounter = walkSafari(nearSafariGrass(), 'left', 0, 0, 'first');
  expect(walkSafari({ ...encounter, bag }, 'left', 0, 0, 'again')).toMatchObject({ bag: { repelSteps: 200 }, encounter: { id: 'first' } });
});

test('Shiny Charm changes future encounter rolls only after unlocking and activating', () => {
  const bag = createBag();
  const roll = { shinyRoll: 0.01 };
  const base = { ...nearSafariGrass(), catches: 10, grassSteps: 5, bag };
  expect(walkSafari(base, 'left', 0, 0, 'normal', roll).encounter?.shiny).toBe(false);
  const enabled = useBagItem(bag, 10, 'shiny-charm');
  expect(walkSafari({ ...base, bag: enabled }, 'left', 0, 0, 'boosted', roll).encounter).toMatchObject({ shiny: true, pokemonId: 10 });
  expect(walkSafari({ ...base, bag: enabled, catches: 9 }, 'left', 0, 0, 'locked', roll).encounter?.shiny).toBe(false);
  expect(walkSafari({ ...base, bag: useBagItem(enabled, 10, 'shiny-charm') }, 'left', 0, 0, 'off', roll).encounter?.shiny).toBe(false);
});

test('all Repels remain usable after repeated use and depleted legacy supplies', () => {
  for (const [id, steps] of [['repel', 100], ['super-repel', 200], ['max-repel', 250]] as const) {
    let bag = { ...createBag(), used: { repel: 999, 'super-repel': 999, 'max-repel': 999 } };
    for (let use = 0; use < 6; use++) {
      const active = useBagItem(bag, 0, id);
      expect(active).toMatchObject({ repelSteps: steps, used: { repel: 999, 'super-repel': 999, 'max-repel': 999 } });
      expect(itemQuantity(0, id)).toBe(Infinity);
      bag = { ...active, used: bag.used, repelSteps: 0 };
    }
  }
});

test('old expeditions and damaged inventory retain their encounter and SQL draft', () => {
  const active = { ...walkSafari(nearSafariGrass(), 'left', 0, 0, 'saved'), draft: "SELECT * FROM pokedex WHERE name = 'Caterpie';" };
  expect(restoreSafariSession(active)).toEqual(active);
  expect(restoreSafariSession({ ...active, bag: { used: {}, repelSteps: -1 } })).toEqual(active);
  const saved = { ...active, bag: useBagItem(createBag(), 0, 'max-repel') };
  expect(restoreSafariSession(JSON.parse(JSON.stringify(saved)))).toMatchObject({ bag: { repelSteps: 250 }, encounter: { id: 'saved' }, draft: active.draft });
});


test('walking across a region exit spends one Repel step; direct travel preserves it', () => {
  const bag = useBagItem(createBag(), 0, 'repel');
  const session = { ...createSafariSession(), bag, position: { x: 12, y: 0 } };
  const walked = walkSafari(session, 'up', 0, 0, 'exit');
  expect(walked).toMatchObject({ zoneId: 'route-1', position: { x: 12, y: 39 }, steps: 1, bag: { repelSteps: 99 }, encounter: null });
  expect(changeSafariZone(walked, 'wetlands')).toMatchObject({ zoneId: 'wetlands', steps: 1, bag: { repelSteps: 99 } });
});
