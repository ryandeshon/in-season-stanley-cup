import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import CharacterDossier from '@/components/arcade/CharacterDossier.vue';

it('cycles all four expressions and resets for another character', async () => {
  const wrapper = mount(CharacterDossier, {
    props: { player: { name: 'Ryan', titleDefenses: 5 } },
  });
  const portrait = () =>
    wrapper.find('.portrait-visual').attributes('data-emotion');
  expect(portrait()).toBe('Happy');
  for (const emotion of ['Angry', 'Anguish', 'Sad', 'Happy']) {
    await wrapper.find('button').trigger('click');
    expect(portrait()).toBe(emotion);
  }
  await wrapper.find('button').trigger('click');
  await wrapper.setProps({ player: { name: 'Boz', titleDefenses: 2 } });
  expect(portrait()).toBe('Happy');
  expect(wrapper.text()).toContain('The Showman');
  expect(wrapper.find('[data-test="championship-honors"]').exists()).toBe(
    false
  );
  wrapper.unmount();
});

it('shows confirmed past champions without changing their season counters', () => {
  for (const name of ['Ryan', 'Cooper']) {
    const player = Object.freeze({ name, championships: 0, titleDefenses: 0 });
    const wrapper = mount(CharacterDossier, { props: { player } });
    expect(wrapper.find('[data-test="championship-honors"] img').exists()).toBe(
      true
    );
    expect(player.championships).toBe(0);
    wrapper.unmount();
  }
});
