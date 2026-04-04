function getNextVoiceWorker({
  workers = [],
  nextWorkerIndex = 0,
  setNextWorkerIndexFn = () => {},
} = {}) {
  if (workers.length === 0) {
    throw new Error('No mediasoup workers available - all workers have died');
  }

  const worker = workers[nextWorkerIndex % workers.length];
  setNextWorkerIndexFn((nextWorkerIndex + 1) % workers.length);
  return worker;
}

function scheduleVoiceWorkerRefill({
  workers = [],
  targetWorkerCount = 0,
  getWorkerRefillPromiseFn = () => null,
  getWorkerRefillTimerFn = () => null,
  setWorkerRefillTimerFn = () => {},
  delayMs = 0,
  refillWorkersFn = async () => {},
  setTimeoutFn = setTimeout,
  logErrorFn = console.error,
} = {}) {
  if (
    workers.length >= targetWorkerCount
    || getWorkerRefillPromiseFn()
    || getWorkerRefillTimerFn()
  ) {
    return false;
  }

  const timer = setTimeoutFn(() => {
    setWorkerRefillTimerFn(null);
    Promise.resolve(refillWorkersFn()).catch((err) => {
      logErrorFn('[mediasoup] Worker refill failed:', err?.message || err);
    });
  }, delayMs);
  setWorkerRefillTimerFn(timer);
  return true;
}

function attachVoiceWorkerLifecycle({
  worker,
  workers = [],
  rooms = new Map(),
  getNextWorkerIndexFn = () => 0,
  setNextWorkerIndexFn = () => {},
  dropVoiceRoomReferenceFn = () => {},
  scheduleVoiceWorkerRefillFn = () => {},
  logErrorFn = console.error,
} = {}) {
  worker.on('died', () => {
    logErrorFn(`mediasoup Worker ${worker.pid} died - removing from pool`);
    const idx = workers.indexOf(worker);
    if (idx !== -1) workers.splice(idx, 1);
    if (workers.length === 0 || getNextWorkerIndexFn() >= workers.length) {
      setNextWorkerIndexFn(0);
    }
    for (const [channelId, room] of rooms) {
      if (room.workerPid === worker.pid || room.router.closed) {
        dropVoiceRoomReferenceFn(rooms, channelId, room);
      }
    }
    scheduleVoiceWorkerRefillFn();
  });
}

function refillVoiceWorkers({
  workers = [],
  targetWorkerCount = 0,
  getWorkerRefillPromiseFn = () => null,
  setWorkerRefillPromiseFn = () => {},
  scheduleVoiceWorkerRefillFn = () => {},
  spawnWorkerFn = async () => {},
  logErrorFn = console.error,
} = {}) {
  const existingPromise = getWorkerRefillPromiseFn();
  if (existingPromise) {
    return existingPromise;
  }

  const refillPromise = (async () => {
    let lastError = null;

    while (workers.length < targetWorkerCount) {
      try {
        await spawnWorkerFn();
      } catch (err) {
        lastError = err;
        logErrorFn('[mediasoup] Failed to create worker:', err?.message || err);
        break;
      }
    }

    if (workers.length < targetWorkerCount) {
      scheduleVoiceWorkerRefillFn();
    }

    if (workers.length === 0 && lastError) {
      throw lastError;
    }

    return workers.length;
  })().finally(() => {
    setWorkerRefillPromiseFn(null);
  });

  setWorkerRefillPromiseFn(refillPromise);
  return refillPromise;
}

module.exports = {
  attachVoiceWorkerLifecycle,
  getNextVoiceWorker,
  refillVoiceWorkers,
  scheduleVoiceWorkerRefill,
};
