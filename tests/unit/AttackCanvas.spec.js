import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AttackCanvas from '@/components/arcade/AttackCanvas.vue';
const create = vi.hoisted(() => vi.fn());
vi.mock('@/utilities/attackRenderer', () => ({ createAttackRenderer: create }));
let wrapper;
afterEach(() => {
  wrapper?.unmount();
  vi.clearAllMocks();
});
const props = { enabled: true, phase: 'idle', attack: 'fire', side: '' };
describe('optional GPU attack lifecycle', () => {
  it('does not initialize graphics when motion or effects are disabled', async () => {
    wrapper = mount(AttackCanvas, { props: { ...props, enabled: false } });
    await flushPromises();
    expect(create).not.toHaveBeenCalled();
  });
  it('forwards phases, destroys on disable and unmount, and never replays a stale goal', async () => {
    const first = { setPhase: vi.fn(), destroy: vi.fn() };
    const second = { setPhase: vi.fn(), destroy: vi.fn() };
    create.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    wrapper = mount(AttackCanvas, { props });
    await flushPromises();
    expect(wrapper.attributes('data-renderer')).toBe('pixi');
    await wrapper.setProps({ phase: 'travel', side: 'right', attack: 'acid' });
    expect(first.setPhase).toHaveBeenCalledWith('travel', 'acid', 'right');
    await wrapper.setProps({ enabled: false });
    expect(first.destroy).toHaveBeenCalledOnce();
    await wrapper.setProps({ enabled: true });
    await flushPromises();
    expect(second.setPhase).not.toHaveBeenCalled();
    wrapper.unmount();
    expect(second.destroy).toHaveBeenCalledOnce();
    wrapper = null;
  });
  it('destroys an initialization that finishes after cancellation', async () => {
    let resolve;
    create.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    wrapper = mount(AttackCanvas, { props });
    await flushPromises();
    await wrapper.setProps({ enabled: false });
    const stale = { setPhase: vi.fn(), destroy: vi.fn() };
    resolve(stale);
    await flushPromises();
    expect(stale.destroy).toHaveBeenCalledOnce();
    expect(wrapper.attributes('data-renderer')).toBe('fallback');
  });
  it('keeps a fallback when WebGL initialization fails', async () => {
    create.mockRejectedValue(new Error('WebGL unavailable'));
    wrapper = mount(AttackCanvas, { props });
    await flushPromises();
    expect(wrapper.attributes('data-renderer')).toBe('fallback');
  });
});
