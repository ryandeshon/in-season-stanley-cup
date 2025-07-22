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

// Import all team logos
import ANA from '@/assets/team-logos/ANA.png';
import BOS from '@/assets/team-logos/BOS.png';
import BUF from '@/assets/team-logos/BUF.png';
import CGY from '@/assets/team-logos/CGY.png';
import CAR from '@/assets/team-logos/CAR.png';
import CHI from '@/assets/team-logos/CHI.png';
import COL from '@/assets/team-logos/COL.png';
import CBJ from '@/assets/team-logos/CBJ.png';
import DAL from '@/assets/team-logos/DAL.png';
import DET from '@/assets/team-logos/DET.png';
import EDM from '@/assets/team-logos/EDM.png';
import FLA from '@/assets/team-logos/FLA.png';
import LAK from '@/assets/team-logos/LAK.png';
import MIN from '@/assets/team-logos/MIN.png';
import MTL from '@/assets/team-logos/MTL.png';
import NSH from '@/assets/team-logos/NSH.png';
import NJD from '@/assets/team-logos/NJD.png';
import NYI from '@/assets/team-logos/NYI.png';
import NYR from '@/assets/team-logos/NYR.png';
import OTT from '@/assets/team-logos/OTT.png';
import PHI from '@/assets/team-logos/PHI.png';
import PIT from '@/assets/team-logos/PIT.png';
import SJS from '@/assets/team-logos/SJS.png';
import SEA from '@/assets/team-logos/SEA.png';
import STL from '@/assets/team-logos/STL.png';
import TBL from '@/assets/team-logos/TBL.png';
import TOR from '@/assets/team-logos/TOR.png';
import UTA from '@/assets/team-logos/UTA.png';
import VAN from '@/assets/team-logos/VAN.png';
import VGK from '@/assets/team-logos/VGK.png';
import WSH from '@/assets/team-logos/WSH.png';
import WPG from '@/assets/team-logos/WPG.png';

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
  return teamLogos[props.team] || '';
});
</script>
