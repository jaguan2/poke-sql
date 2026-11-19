import { test, expect } from '@playwright/test';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { checkSafariQuery } from '../../src/features/safari/assignments';
import { isSafariSession, recordSafariReply, restoreSafariSession, walkSafari } from '../../src/features/safari/model';
import { nearSafariGrass } from '../fixtures/safari';

const at = '2026-11-18T20:00:00.000Z';
const correct = 'SELECT id, name, type1, type2 FROM pokedex WHERE id=10;';

for (const limit of [5, 8] as const) {
  test(`${limit} wrong answers cause fleeing; a correct final chance still catches`, async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
    try {
      let session = walkSafari(nearSafariGrass(), 'left', 0, 0, 'wild', { weather: 'clear', fleeAfter: limit });
      const wrong = checkSafariQuery(db, 'SELECT 1;', 10, 'field-notes');
      const right = checkSafariQuery(db, correct, 10, 'field-notes');
      for (let attempt = 1; attempt < limit; attempt++) {
        session = recordSafariReply(session, 'wild', wrong, at);
        expect(session.encounter).toMatchObject({ outcome: 'active', attempts: attempt, fleeAfter: limit });
      }
      const caught = recordSafariReply(session, 'wild', right, at);
      expect(caught).toMatchObject({ catches: 1, encounter: { outcome: 'caught', attempts: limit },
        lastCatch: { encounterId: 'wild', pokemon: { id: 10, name: 'Caterpie' }, attempts: limit } });
      expect(isSafariSession(caught)).toBe(true);
      const fled = recordSafariReply(session, 'wild', wrong, at);
      expect(fled).toMatchObject({ catches: 0, encounter: { outcome: 'fled', attempts: limit }, lastCatch: null });
      expect(isSafariSession(fled)).toBe(true);
      expect(recordSafariReply(fled, 'wild', right, at)).toEqual(fled);
      expect(recordSafariReply(caught, 'wild', right, at)).toEqual(caught);
    } finally { db.close(); }
  });
}

test('unlimited encounters stay active after repeated wrong answers and still accept a catch', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    let session = walkSafari(nearSafariGrass(), 'left', 0, 0, 'relaxed');
    const wrong = checkSafariQuery(db, 'SELECT 1;', 10, 'field-notes');
    for (let attempt = 0; attempt < 12; attempt++) session = recordSafariReply(session, 'relaxed', wrong, at);
    expect(session.encounter).toMatchObject({ attempts: 12, outcome: 'active', fleeAfter: null });
    expect(recordSafariReply(session, 'relaxed', checkSafariQuery(db, correct, 10, 'field-notes'), at))
      .toMatchObject({ catches: 1, encounter: { outcome: 'caught', attempts: 13 } });
  } finally { db.close(); }
});

test('query errors, stale replies and unverified successes preserve chances and past catches', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    const session = walkSafari(nearSafariGrass(), 'left', 0, 0, 'current', { weather: 'clear', fleeAfter: 5 });
    const right = checkSafariQuery(db, correct, 10, 'field-notes');
    for (const reply of [{ error: 'Query stopped.' }, { error: 'near SELEC: syntax error' }, {},
      { passed: true }, { ...right, safariPokemon: { ...right.safariPokemon, id: 13 } }]) {
      expect(recordSafariReply(session, 'current', reply, at)).toEqual(session);
    }
    expect(recordSafariReply(session, 'older-encounter', right, at)).toEqual(session);
    const caught = recordSafariReply(session, 'current', right, at);
    expect(caught).toMatchObject({ catches: 1, encounter: { attempts: 1, outcome: 'caught' } });
    let next = walkSafari({ ...caught, encounter: null }, 'right', 0, 0, 'walk', { weather: 'clear', fleeAfter: 5 });
    next = walkSafari(next, 'left', 0, 0, 'next', { weather: 'clear', fleeAfter: 5 });
    const target = next.encounter!;
    for (let attempt = 0; attempt < 5; attempt++) {
      const wrong = checkSafariQuery(db, 'SELECT 1;', target.pokemonId, target.assignmentId);
      next = recordSafariReply(next, target.id, wrong, at);
    }
    expect(next).toMatchObject({ catches: 1, encounter: { outcome: 'fled' }, lastCatch: caught.lastCatch });
  } finally { db.close(); }
});

test('version 2 tasks migrate with unlimited chances, their existing draft and checked attempts', async () => {
  const legacy = { ...nearSafariGrass(), version: 2,
    encounter: { id: 'old-task', pokemonId: 10, assignmentId: 'field-notes', attempts: 12, caught: false }, draft: correct };
  const restored = restoreSafariSession(legacy)!;
  expect(restored).toMatchObject({ version: 3, draft: correct,
    encounter: { id: 'old-task', attempts: 12, outcome: 'active', fleeAfter: null } });
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    const caught = recordSafariReply(restored, 'old-task', checkSafariQuery(db, correct, 10, 'field-notes'), at);
    expect(caught).toMatchObject({ catches: 1, lastCatch: { attempts: 13, pokemon: { name: 'Caterpie' } } });
    const oldCaught = { ...caught, version: 2, encounter: { ...legacy.encounter, attempts: 13, caught: true } };
    expect(restoreSafariSession(oldCaught)).toMatchObject({ version: 3, catches: 1,
      encounter: { outcome: 'caught', fleeAfter: null }, lastCatch: caught.lastCatch });
  } finally { db.close(); }
});

test('saved outcomes reject impossible counters and preserve a genuine fled state', () => {
  const active = walkSafari(nearSafariGrass(), 'left', 0, 0, 'wild', { weather: 'clear', fleeAfter: 5 });
  for (const encounter of [
    { ...active.encounter, outcome: 'fled', attempts: 4 }, { ...active.encounter, outcome: 'fled', attempts: 5, fleeAfter: null },
    { ...active.encounter, attempts: 5 }, { ...active.encounter, fleeAfter: 3 }, { ...active.encounter, outcome: 'unknown' },
  ]) expect(restoreSafariSession({ ...active, encounter })).toBeNull();
  expect(restoreSafariSession({ ...active, encounter: { ...active.encounter, attempts: 5, outcome: 'fled' } }))
    .toMatchObject({ encounter: { id: 'wild', outcome: 'fled', attempts: 5, fleeAfter: 5 } });
});

test('wrong results explain column and row count mismatches', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync('public/pokemon.sqlite'));
  try {
    expect(checkSafariQuery(db, 'SELECT 1;', 10, 'field-notes')).toMatchObject({ passed: false,
      safariFeedback: 'Return exactly 4 columns in the requested order.' });
    expect(checkSafariQuery(db, 'SELECT id, name, type1, type2 FROM pokedex WHERE id IN (10, 13);', 10, 'field-notes'))
      .toMatchObject({ passed: false, safariFeedback: 'Return 1 row; your query returned 2. Check your filters and joins.' });
    expect(checkSafariQuery(db, correct, 10, 'field-notes')).toMatchObject({ passed: true, safariFeedback: undefined });
  } finally { db.close(); }
});
