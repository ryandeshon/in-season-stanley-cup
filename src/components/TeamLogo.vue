<template>
  <v-img
    :src="teamLogoSrc"
    :width="width"
    :height="height"
    :alt="team"
    v-bind="$attrs"
  />
</template>

<script setup>
import { computed } from 'vue';
import { useSeasonStore } from '@/store/seasonStore';
import { useTheme } from '@/composables/useTheme';

// Import all team logos for Season 2 (custom logos)
import ANA from '@/assets/team-logos/season2/ANA.png';
import BOS from '@/assets/team-logos/season2/BOS.png';
import BUF from '@/assets/team-logos/season2/BUF.png';
import CGY from '@/assets/team-logos/season2/CGY.png';
import CAR from '@/assets/team-logos/season2/CAR.png';
import CHI from '@/assets/team-logos/season2/CHI.png';
import COL from '@/assets/team-logos/season2/COL.png';
import CBJ from '@/assets/team-logos/season2/CBJ.png';
import DAL from '@/assets/team-logos/season2/DAL.png';
import DET from '@/assets/team-logos/season2/DET.png';
import EDM from '@/assets/team-logos/season2/EDM.png';
import FLA from '@/assets/team-logos/season2/FLA.png';
import LAK from '@/assets/team-logos/season2/LAK.png';
import MIN from '@/assets/team-logos/season2/MIN.png';
import MTL from '@/assets/team-logos/season2/MTL.png';
import NSH from '@/assets/team-logos/season2/NSH.png';
import NJD from '@/assets/team-logos/season2/NJD.png';
import NYI from '@/assets/team-logos/season2/NYI.png';
import NYR from '@/assets/team-logos/season2/NYR.png';
import OTT from '@/assets/team-logos/season2/OTT.png';
import PHI from '@/assets/team-logos/season2/PHI.png';
import PIT from '@/assets/team-logos/season2/PIT.png';
import SJS from '@/assets/team-logos/season2/SJS.png';
import SEA from '@/assets/team-logos/season2/SEA.png';
import STL from '@/assets/team-logos/season2/STL.png';
import TBL from '@/assets/team-logos/season2/TBL.png';
import TOR from '@/assets/team-logos/season2/TOR.png';
import UTA from '@/assets/team-logos/season2/UTA.png';
import VAN from '@/assets/team-logos/season2/VAN.png';
import VGK from '@/assets/team-logos/season2/VGK.png';
import WSH from '@/assets/team-logos/season2/WSH.png';
import WPG from '@/assets/team-logos/season2/WPG.png';

const seasonStore = useSeasonStore();
const { isDarkOrLight } = useTheme();

const props = defineProps({
  team: {
    type: String,
    required: true,
  },
  width: {
    type: [String, Number],
    default: 40,
  },
  height: {
    type: [String, Number],
    default: 40,
  },
});

const teamLogos = {
  ANA,
  BOS,
  BUF,
  CGY,
  CAR,
  CHI,
  COL,
  CBJ,
  DAL,
  DET,
  EDM,
  FLA,
  LAK,
  MIN,
  MTL,
  NSH,
  NJD,
  NYI,
  NYR,
  OTT,
  PHI,
  PIT,
  SJS,
  SEA,
  STL,
  TBL,
  TOR,
  UTA,
  VAN,
  VGK,
  WSH,
  WPG,
};

const teamLogoSrc = computed(() => {
  // Season 1: Use NHL SVG logos
  if (seasonStore.currentSeason === 'season1') {
    const themeMode = isDarkOrLight.value === 'dark' ? 'dark' : 'light';
    return `https://assets.nhle.com/logos/nhl/svg/${props.team}_${themeMode}.svg`;
  }

  // Season 2: Use custom logos
  return teamLogos[props.team] || '';
});
</script>
