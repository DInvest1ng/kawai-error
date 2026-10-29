import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { ErrorBus } from '../errorBus';
import type { ErrorBurst, ErrorEvent } from '../types';

const err = (message: string): ErrorEvent => ({ source: 'diagnostics', severity: 'error', message });
const warn = (message: string): ErrorEvent => ({ source: 'terminal', severity: 'warning', message });

describe('ErrorBus', () => {
  let bus: ErrorBus;
  let bursts: ErrorBurst[];

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
    bus = new ErrorBus({ debounceMs: 1500, cooldownMs: 10_000 });
    bursts = [];
    bus.onBurst((b) => bursts.push(b));
  });

  afterEach(() => {
    bus.dispose();
    mock.timers.reset();
  });

  it('emits a single event after the debounce delay', () => {
    bus.push(err('a'));
    mock.timers.tick(1499);
    assert.equal(bursts.length, 0);
    mock.timers.tick(1);
    assert.deepEqual(bursts, [{ ...err('a'), count: 1 }]);
  });

  it('collapses a burst into one emission, restarting the debounce on each event', () => {
    bus.push(err('a'));
    mock.timers.tick(1000);
    bus.push(err('b'));
    mock.timers.tick(1000);
    bus.push(err('c'));
    mock.timers.tick(1499);
    assert.equal(bursts.length, 0);
    mock.timers.tick(1);
    assert.equal(bursts.length, 1);
    assert.equal(bursts[0].count, 3);
    assert.equal(bursts[0].message, 'c');
  });

  it('drops bursts inside the cooldown and allows them after it expires', () => {
    bus.push(err('first'));
    mock.timers.tick(1500);
    assert.equal(bursts.length, 1);

    // Flushes 1500ms + 3000ms after the first emit: still in cooldown.
    mock.timers.tick(3000);
    bus.push(err('suppressed'));
    mock.timers.tick(1500);
    assert.equal(bursts.length, 1);

    // Flushes 10_500ms after the first emit: cooldown is over.
    mock.timers.tick(4500);
    bus.push(err('allowed'));
    mock.timers.tick(1500);
    assert.equal(bursts.length, 2);
    assert.equal(bursts[1].message, 'allowed');
  });

  it('keeps the most severe event of a burst', () => {
    bus.push(warn('w1'));
    bus.push(err('e1'));
    bus.push(warn('w2'));
    mock.timers.tick(1500);
    assert.equal(bursts.length, 1);
    assert.equal(bursts[0].severity, 'error');
    assert.equal(bursts[0].message, 'e1');
    assert.equal(bursts[0].count, 3);
  });

  it('uses the latest event when severities are equal', () => {
    bus.push(warn('w1'));
    bus.push(warn('w2'));
    mock.timers.tick(1500);
    assert.equal(bursts[0].message, 'w2');
  });

  it('applies new options to later events', () => {
    bus.setOptions({ debounceMs: 100, cooldownMs: 0 });
    bus.push(err('a'));
    mock.timers.tick(100);
    bus.push(err('b'));
    mock.timers.tick(100);
    assert.deepEqual(
      bursts.map((b) => b.message),
      ['a', 'b'],
    );
  });

  it('emitNow bypasses debounce and starts the cooldown', () => {
    bus.emitNow({ ...err('test'), source: 'test', count: 1 });
    assert.equal(bursts.length, 1);
    bus.push(err('a'));
    mock.timers.tick(1500);
    assert.equal(bursts.length, 1);
  });

  it('cancels pending events on dispose', () => {
    bus.push(err('a'));
    bus.dispose();
    mock.timers.tick(5000);
    assert.equal(bursts.length, 0);
  });
});
