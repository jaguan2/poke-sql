const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setImmediate: nextTurn } = require('node:timers/promises');
const { startUpdates } = require('../../desktop/updates.cjs');

test('an offline check returns immediately, reports the failure and can recover later', async () => {
  const updater = new EventEmitter();
  const warnings = [], announcements = [];
  updater.checkForUpdates = async () => {
    const error = new Error('Offline'); updater.emit('error', error); throw error;
  };
  const stop = startUpdates(updater, version => announcements.push(version), { warn: (...args) => warnings.push(args) });
  await nextTurn();
  assert.equal(warnings[0][0], 'PokéSQL update unavailable; the installed app remains usable.');
  assert.equal(warnings[0][1].message, 'Offline');
  assert.deepEqual(announcements, []);
  updater.emit('update-downloaded', { version: '0.2.1' });
  await nextTurn();
  assert.deepEqual(announcements, ['0.2.1']);
  assert.equal(updater.autoInstallOnAppQuit, true);
  assert.equal(updater.autoRunAppAfterInstall, false);
  stop();
});

test('a queued announcement is suppressed when the app is already quitting', async () => {
  const updater = new EventEmitter(), announcements = [];
  updater.checkForUpdates = async () => null;
  const stop = startUpdates(updater, version => announcements.push(version));
  updater.emit('update-downloaded', { version: '0.2.1' });
  stop();
  await nextTurn();
  assert.deepEqual(announcements, []);
});

test('a failed background download is consumed after its error is reported', async () => {
  const updater = new EventEmitter(), warnings = [];
  updater.checkForUpdates = async () => ({ downloadPromise: Promise.resolve().then(() => {
    const error = new Error('Checksum mismatch'); updater.emit('error', error); throw error;
  }) });
  const stop = startUpdates(updater, () => { throw new Error('Failed downloads must not be announced.'); }, { warn: (...args) => warnings.push(args) });
  await nextTurn();
  assert.equal(warnings[0][1].message, 'Checksum mismatch');
  stop();
});

test('downloaded updates are announced once per version without restarting the application', async () => {
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => null;
  updater.quitAndInstall = () => { throw new Error('An update must wait for the user to close the app.'); };
  const announcements = [];
  const stop = startUpdates(updater, version => announcements.push(version));
  updater.emit('update-downloaded', { version: '0.2.1' });
  updater.emit('update-downloaded', { version: '0.2.1' });
  updater.emit('update-downloaded', { version: '0.2.2' });
  await nextTurn();
  assert.deepEqual(announcements, ['0.2.1', '0.2.2']);
  stop();
  updater.emit('update-downloaded', { version: '0.2.3' });
  await nextTurn();
  assert.deepEqual(announcements, ['0.2.1', '0.2.2']);
});

test('a notification failure is handled and cannot block the installed application', async () => {
  const updater = new EventEmitter(), warnings = [];
  updater.checkForUpdates = async () => null;
  const stop = startUpdates(updater, () => { throw new Error('Window closed'); }, { warn: (...args) => warnings.push(args) });
  updater.emit('update-downloaded', { version: '0.2.1' });
  await nextTurn();
  assert.equal(warnings[0][1].message, 'Window closed');
  stop();
});
