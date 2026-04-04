const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attachVoiceWorkerLifecycle,
  getNextVoiceWorker,
  refillVoiceWorkers,
  scheduleVoiceWorkerRefill,
} = require('../../../server/src/domain/voice/voiceWorkerRuntime');

test('voice worker runtime rotates workers and resets the next index through the shared contract', () => {
  const workers = [{ pid: 1 }, { pid: 2 }];
  let nextWorkerIndex = 0;

  const first = getNextVoiceWorker({
    workers,
    nextWorkerIndex,
    setNextWorkerIndexFn: (value) => {
      nextWorkerIndex = value;
    },
  });
  const second = getNextVoiceWorker({
    workers,
    nextWorkerIndex,
    setNextWorkerIndexFn: (value) => {
      nextWorkerIndex = value;
    },
  });

  assert.equal(first.pid, 1);
  assert.equal(second.pid, 2);
  assert.equal(nextWorkerIndex, 0);
  assert.throws(() => getNextVoiceWorker({ workers: [] }), /No mediasoup workers available/);
});

test('voice worker runtime schedules refill only when capacity and timers allow it', async () => {
  let timer = null;
  let capturedCallback = null;
  const events = [];

  const scheduled = scheduleVoiceWorkerRefill({
    workers: [],
    targetWorkerCount: 2,
    getWorkerRefillPromiseFn: () => null,
    getWorkerRefillTimerFn: () => timer,
    setWorkerRefillTimerFn: (value) => {
      timer = value;
    },
    delayMs: 1000,
    refillWorkersFn: async () => {
      events.push('refill');
    },
    setTimeoutFn: (callback) => {
      capturedCallback = callback;
      return { id: 'timer-1' };
    },
    logErrorFn: () => {},
  });

  assert.equal(scheduled, true);
  assert.deepEqual(timer, { id: 'timer-1' });
  await capturedCallback();
  assert.deepEqual(events, ['refill']);
  assert.equal(timer, null);

  assert.equal(scheduleVoiceWorkerRefill({
    workers: [{ pid: 1 }, { pid: 2 }],
    targetWorkerCount: 2,
    getWorkerRefillPromiseFn: () => null,
    getWorkerRefillTimerFn: () => null,
  }), false);
});

test('voice worker runtime removes dead workers, drops affected rooms, and requests refill', () => {
  const handlers = {};
  const deadWorker = { pid: 1 };
  const healthyWorker = { pid: 2 };
  const workers = [deadWorker, healthyWorker];
  const rooms = new Map([
    ['voice-1', { workerPid: 1, router: { closed: false } }],
    ['voice-2', { workerPid: 9, router: { closed: true } }],
    ['voice-3', { workerPid: 2, router: { closed: false } }],
  ]);
  let nextWorkerIndex = 4;
  const dropped = [];
  let refillCount = 0;
  deadWorker.on = (event, handler) => {
    handlers[event] = handler;
  };
  const worker = deadWorker;

  attachVoiceWorkerLifecycle({
    worker,
    workers,
    rooms,
    getNextWorkerIndexFn: () => nextWorkerIndex,
    setNextWorkerIndexFn: (value) => {
      nextWorkerIndex = value;
    },
    dropVoiceRoomReferenceFn: (_rooms, channelId) => {
      dropped.push(channelId);
      _rooms.delete(channelId);
    },
    scheduleVoiceWorkerRefillFn: () => {
      refillCount += 1;
    },
    logErrorFn: () => {},
  });

  handlers.died();

  assert.deepEqual(workers.map((entry) => entry.pid), [2]);
  assert.equal(nextWorkerIndex, 0);
  assert.deepEqual(dropped.sort(), ['voice-1', 'voice-2']);
  assert.equal(refillCount, 1);
});

test('voice worker runtime refills toward the target and reschedules on partial failure', async () => {
  const workers = [];
  let refillPromise = null;
  let refillScheduleCount = 0;
  let attempts = 0;

  const result = await refillVoiceWorkers({
    workers,
    targetWorkerCount: 2,
    getWorkerRefillPromiseFn: () => refillPromise,
    setWorkerRefillPromiseFn: (value) => {
      refillPromise = value;
    },
    scheduleVoiceWorkerRefillFn: () => {
      refillScheduleCount += 1;
    },
    spawnWorkerFn: async () => {
      attempts += 1;
      if (attempts === 1) {
        workers.push({ pid: 1 });
        return;
      }
      throw new Error('boom');
    },
    logErrorFn: () => {},
  });

  assert.equal(result, 1);
  assert.equal(refillScheduleCount, 1);
  assert.equal(refillPromise, null);

  await assert.rejects(() => refillVoiceWorkers({
    workers: [],
    targetWorkerCount: 1,
    getWorkerRefillPromiseFn: () => null,
    setWorkerRefillPromiseFn: () => {},
    scheduleVoiceWorkerRefillFn: () => {},
    spawnWorkerFn: async () => {
      throw new Error('fatal');
    },
    logErrorFn: () => {},
  }), /fatal/);
});
