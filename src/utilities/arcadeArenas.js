import blackRink from '@/assets/arcade/black-rink-arena-v2.png';
import thunderkeep from '@/assets/arcade/thunderkeep-ice-v1.png';
import spotlight from '@/assets/arcade/spotlight-pit-v1.png';
import venom from '@/assets/arcade/venom-vault-v1.png';
import portal from '@/assets/arcade/portal-rink-v1.png';

export const neutralArena = { name: 'The Portal Rink', background: portal };
const championArenas = {
  Ryan: { name: 'The Black Rink', background: blackRink },
  Cooper: { name: 'Thunderkeep Ice', background: thunderkeep },
  Boz: { name: 'The Spotlight Pit', background: spotlight },
  Terry: { name: 'The Venom Vault', background: venom },
};
export const arenaForOwner = (name) => championArenas[name] || neutralArena;
