const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRuntimeMetricsState,
  trimTimeline,
  pushEvent,
  addNote,
  sumEventsSince,
  valuesSince,
} = require('../../../server/src/monitoring/runtimeMetricsState');

test('runtime metrics state creates the canonical metrics buckets', () => {
  const state = createRuntimeMetricsState();
  assert.deepEqual(Object.keys(state), ['http', 'sockets', 'chat', 'voice', 'notes']);
  assert.equal(state.http.inflight, 0);
  assert.equal(state.sockets.totalConnections, 0);
  assert.equal(state.chat.roomMessagesTotal, 0);
  assert.equal(state.voice.errorsTotal, 0);
});

test('runtime metrics state trims timelines, pushes events, and limits notes', () => {
  const events = [
    { at: 0, value: 1 },
    { at: 10, value: 1 },
  ];
  trimTimeline(events, 6 * 60 * 60 * 1000 + 10);
  assert.deepEqual(events, [{ at: 10, value: 1 }]);

  const pushed = [];
  const event = pushEvent(pushed, { value: 3, event: 'chat' }, {
    nowFn: () => 50,
  });
  assert.deepEqual(event, { at: 50, value: 3, event: 'chat' });
  assert.deepEqual(pushed, [{ at: 50, value: 3, event: 'chat' }]);

  const state = createRuntimeMetricsState();
  for (let i = 0; i < 62; i += 1) {
    addNote(state, 'warn', `note-${i}`, null, {
      nowIsoFn: () => `t-${i}`,
    });
  }
  assert.equal(state.notes.length, 60);
  assert.equal(state.notes[0].message, 'note-61');
  assert.equal(state.notes.at(-1).message, 'note-2');
});

test('runtime metrics state sums and extracts recent values from event timelines', () => {
  const now = 10_000;
  const events = [
    { at: 8_000, value: 2, ms: 15, kind: 'room' },
    { at: 9_500, value: 1, ms: 40, kind: 'dm' },
    { at: 9_900, value: 3, ms: 25, kind: 'room' },
  ];

  assert.equal(sumEventsSince(events, 2_000, { nowFn: () => now }), 6);
  assert.equal(sumEventsSince(events, 2_000, {
    nowFn: () => now,
    predicate: (event) => event.kind === 'room',
  }), 5);
  assert.deepEqual(valuesSince(events, 600, 'ms', { nowFn: () => now }), [25, 40]);
});
