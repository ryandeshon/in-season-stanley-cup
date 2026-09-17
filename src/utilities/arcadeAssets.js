import ryan from '@/assets/arcade/ryan-approved.png';
import cooper from '@/assets/arcade/cooper-approved.png';
import boz from '@/assets/arcade/boz-approved.png';
import terry from '@/assets/arcade/terry-approved.png';
export const isArcadeSeason = (season) => season === 'season3';
export const characters = {
  Ryan: {
    portrait: ryan,
    title: 'The Tournament Keeper',
    attack: 'fire',
    color: '#e77c51',
    finisher: 'The Final Decree',
    lore: 'The reigning champion now keeps the keys to the tournament. Behind the armor and the ceremony, his grip on the cup grows tighter.',
  },
  Cooper: {
    portrait: cooper,
    title: 'The Former Steward',
    attack: 'lightning',
    color: '#9ecbff',
    finisher: 'Judgment of the Cup',
    lore: 'Once entrusted with the cup, Cooper returns to restore its honor. His challenge is to the keeper as much as to the tournament itself.',
  },
  Boz: {
    portrait: boz,
    title: 'The Showman',
    attack: 'orb',
    color: '#7dd7ff',
    finisher: 'Last Take',
    lore: 'Every entrance is a performance. Every win deserves an encore. Boz arrives with his sunglasses on and his confidence unshaken.',
  },
  Terry: {
    portrait: terry,
    title: 'The Quiet Threat',
    attack: 'acid',
    color: '#a2d478',
    finisher: 'Below the Ice',
    lore: 'Terry watches the ice and waits for an opening. Beneath the green armor is a calculating opponent who gives little away.',
  },
};
// Approved identity art is the honest fallback until aligned pose atlases arrive.
export const livePoseManifest = Object.fromEntries(
  Object.entries(characters).map(([name, c]) => [
    name,
    {
      ready: c.portrait,
      confident: c.portrait,
      guarded: c.portrait,
      attack: c.portrait,
      recoil: c.portrait,
      launch: { x: 0.8, y: 0.5 },
      impact: { x: 0.5, y: 0.45 },
      body: { x: 0.15, y: 0.1, width: 0.7, height: 0.85 },
      facing: ['Ryan', 'Terry'].includes(name) ? 'left' : 'right',
      scale: 1,
      usesPortraitFallback: true,
    },
  ])
);
