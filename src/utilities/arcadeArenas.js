import blackRink from '@/assets/arcade/black-rink-arena-v2.webp';
import thunderkeep from '@/assets/arcade/thunderkeep-ice-v1.webp';
import spotlight from '@/assets/arcade/spotlight-pit-v1.webp';
import venom from '@/assets/arcade/venom-vault-v1.webp';
import portal from '@/assets/arcade/portal-rink-v1.webp';

export const neutralArena = { name: 'The Portal Rink', background: portal };
const championArenas = {
  Ryan: { name: 'The Black Rink', background: blackRink },
  Cooper: { name: 'Thunderkeep Ice', background: thunderkeep },
  Boz: { name: 'The Spotlight Pit', background: spotlight },
  Terry: { name: 'The Venom Vault', background: venom },
};
export const arenaForOwner = (name) => championArenas[name] || neutralArena;
