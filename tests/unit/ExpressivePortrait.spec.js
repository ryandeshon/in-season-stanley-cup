import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ExpressivePortrait from '@/components/arcade/ExpressivePortrait.vue';
describe('portrait atlas', () => {
  it('shows one quadrant per expression and preserves readable labels', async () => {
    const wrapper = mount(ExpressivePortrait, {
      props: { name: 'Cooper', emotion: 'Happy' },
    });
    expect(wrapper.attributes('data-art')).toBe('fallback');
    await wrapper.find('.atlas-loader').trigger('load');
    for (const [emotion, position] of Object.entries({
      Happy: '0% 0%',
      Angry: '100% 0%',
      Anguish: '0% 100%',
      Sad: '100% 100%',
    })) {
      await wrapper.setProps({ emotion });
      expect(wrapper.attributes('aria-label')).toBe(`Cooper: ${emotion}`);
      expect(
        wrapper.find('.expression-tile').element.style.backgroundPosition
      ).toBe(position);
    }
    await wrapper.setProps({ flipped: true });
    expect(wrapper.classes()).toContain('flipped');
    wrapper.unmount();
  });
  it('retains the approved portrait if the atlas fails and retries for a different owner', async () => {
    const wrapper = mount(ExpressivePortrait, { props: { name: 'Ryan' } });
    await wrapper.find('.atlas-loader').trigger('error');
    expect(wrapper.attributes('data-art')).toBe('fallback');
    expect(wrapper.find('img').attributes('src')).toContain('ryan-approved');
    await wrapper.setProps({ name: 'Terry' });
    expect(wrapper.find('.atlas-loader').exists()).toBe(true);
    await wrapper.find('.atlas-loader').trigger('load');
    expect(wrapper.attributes('data-art')).toBe('expressions');
    wrapper.unmount();
  });
});
