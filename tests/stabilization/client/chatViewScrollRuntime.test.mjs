import test from 'node:test';
import assert from 'node:assert/strict';

import { bindChatViewScrollRuntime } from '../../../client/src/features/messaging/chatViewScrollRuntime.mjs';

function createMediaNode(tagName, { ready = false } = {}) {
  const listeners = new Map();
  return {
    tagName,
    complete: ready,
    naturalWidth: ready ? 64 : 0,
    readyState: ready ? 1 : 0,
    listeners,
    addEventListener(eventName, handler) {
      listeners.set(eventName, handler);
    },
    removeEventListener(eventName, handler) {
      if (listeners.get(eventName) === handler) {
        listeners.delete(eventName);
      }
    },
    trigger(eventName) {
      listeners.get(eventName)?.();
    },
  };
}

test('chat view scroll runtime pins the feed while media loads without ResizeObserver', () => {
  const img = createMediaNode('IMG');
  const video = createMediaNode('VIDEO');
  const content = {
    querySelectorAll(selector) {
      assert.equal(selector, 'img,video');
      return [img, video];
    },
  };

  const scheduledDelays = [];
  const scrollCalls = [];
  const cleanup = bindChatViewScrollRuntime({
    scrollRef: { current: { scrollTop: 0, scrollHeight: 1000 } },
    messagesContentRef: { current: content },
    wasAtBottomRef: { current: true },
    scrollingRef: { current: false },
    pendingInitialScrollRef: { current: true },
    initialScrollPinnedUntilRef: { current: 0 },
    scrollToBottomFn: () => scrollCalls.push('scroll'),
    scheduleInitialBottomReleaseFn: (delayMs) => scheduledDelays.push(delayMs),
    requestAnimationFrameFn: (callback) => callback(),
    ResizeObserverCtor: null,
    MutationObserverCtor: null,
  });

  assert.equal(scrollCalls.length, 1);
  assert.deepEqual(scheduledDelays, [1700]);

  img.trigger('load');
  assert.equal(scrollCalls.length, 2);
  assert.deepEqual(scheduledDelays, [1700, 1450]);

  video.trigger('loadedmetadata');
  assert.equal(scrollCalls.length, 3);
  assert.deepEqual(scheduledDelays, [1700, 1450, 280, 280]);

  cleanup?.();
  img.trigger('load');
  video.trigger('loadedmetadata');
  assert.equal(scrollCalls.length, 3);
  assert.deepEqual(scheduledDelays, [1700, 1450, 280, 280]);
  assert.equal(img.listeners.size, 0);
  assert.equal(video.listeners.size, 0);
});

test('chat view scroll runtime binds resize and mutation observers when available', () => {
  const observerCalls = [];

  class ResizeObserverStub {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      this.disconnected = false;
    }

    observe(target) {
      this.observed.push(target);
    }

    disconnect() {
      this.disconnected = true;
    }
  }

  class MutationObserverStub {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      this.disconnected = false;
    }

    observe(target, options) {
      this.observed.push([target, options]);
    }

    disconnect() {
      this.disconnected = true;
    }
  }

  const content = {
    querySelectorAll() {
      return [];
    },
  };
  const resizeObserverInstances = [];
  const mutationObserverInstances = [];

  const cleanup = bindChatViewScrollRuntime({
    scrollRef: { current: { scrollTop: 0, scrollHeight: 500 } },
    messagesContentRef: { current: content },
    wasAtBottomRef: { current: false },
    scrollingRef: { current: false },
    pendingInitialScrollRef: { current: false },
    initialScrollPinnedUntilRef: { current: 0 },
    scrollToBottomFn: () => observerCalls.push('scroll'),
    scheduleInitialBottomReleaseFn: () => observerCalls.push('release'),
    shouldKeepPinnedToBottomFn: () => false,
    requestAnimationFrameFn: (callback) => callback(),
    ResizeObserverCtor: class extends ResizeObserverStub {
      constructor(callback) {
        super(callback);
        resizeObserverInstances.push(this);
      }
    },
    MutationObserverCtor: class extends MutationObserverStub {
      constructor(callback) {
        super(callback);
        mutationObserverInstances.push(this);
      }
    },
  });

  assert.equal(resizeObserverInstances.length, 1);
  assert.equal(mutationObserverInstances.length, 1);
  assert.deepEqual(resizeObserverInstances[0].observed, [content]);
  assert.deepEqual(mutationObserverInstances[0].observed, [[content, { childList: true, subtree: true }]]);

  mutationObserverInstances[0].callback();
  resizeObserverInstances[0].callback();
  assert.deepEqual(observerCalls, []);

  cleanup?.();
  assert.equal(resizeObserverInstances[0].disconnected, true);
  assert.equal(mutationObserverInstances[0].disconnected, true);
});
