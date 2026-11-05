import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/bus';
import type { PipEvent } from '../../src/types';

const ev: PipEvent = { type: 'paste', at: 1, data: { chars: 300 } };

describe('EventBus', () => {
  it('calls every subscriber with the same event', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on(a);
    bus.on(b);
    bus.emit(ev);
    expect(a).toHaveBeenCalledWith(ev);
    expect(b).toHaveBeenCalledWith(ev);
    expect(a.mock.calls[0][0]).toBe(b.mock.calls[0][0]);
  });

  it('stops delivery after unsubscribe', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const off = bus.on(a);
    bus.emit(ev);
    off();
    bus.emit(ev);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('keeps delivering when a subscriber throws', () => {
    const bus = new EventBus();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    bus.on(() => { throw new Error('boom'); });
    bus.on(after);
    expect(() => bus.emit(ev)).not.toThrow();
    expect(after).toHaveBeenCalledWith(ev);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
