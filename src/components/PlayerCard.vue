<template>
  <v-card
    class="sm:min-w-52 border-spacing-2 border-2 border-black rounded-lg"
    :class="{
      'border-white': isDarkOrLight === 'dark',
      'border-black': isDarkOrLight === 'light',
    }"
    :ripple="clickable"
    @click="clickable && $emit('card-click')"
  >
    <v-card-text
      class="flex flex-col justify-center items-center"
      :class="showTeamLogo ? 'mb-6' : 'pb-0'"
    >
      <router-link :to="`/player/${props.player?.name}`"
        ><h3 class="text-xl font-bold mb-0">
          {{ props.player?.name }}
        </h3></router-link
      >
      <p v-if="props.subtitle" class="text-center">{{ props.subtitle }}</p>
      <p v-if="props.team?.placeName.default" class="mb-1">
        <strong>{{ props.team?.placeName.default }}</strong>
      </p>
      <div v-if="props.isGameLive" class="text-sm">
        <div>Score: {{ props.team?.score }}</div>
        <div v-if="props.team?.sog > 0">SOG: {{ props.team?.sog }}</div>
      </div>
      <div class="avatar">
        <img
          :src="getImage(props.player?.name, props.imageType)"
          :class="{
            'saturate-50 contrast-125 brightness-75': props.isMirrorMatch,
            '-scale-x-100': props.isChampion,
          }"
          :alt="`${props.player?.name} Avatar`"
        />
        <template v-if="showTeamLogo">
          <div v-if="props.team" class="team-logo">
            <TeamLogo :team="props.team.abbrev" :width="55" :height="55" />
          </div>
          <div v-else class="team-logo">
            <TeamLogo :team="props.currentChampion" :width="55" :height="55" />
          </div>
        </template>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { useTheme } from '@/composables/useTheme';

import bozAngryImage from '@/assets/players/season2/boz-angry.png';
import bozSadImage from '@/assets/players/season2/boz-sad.png';
import bozHappyImage from '@/assets/players/season2/boz-happy.png';
import bozAnguishImage from '@/assets/players/season2/boz-anguish.png';
import cooperAngryImage from '@/assets/players/season2/cooper-angry.png';
import cooperSadImage from '@/assets/players/season2/cooper-sad.png';
import cooperHappyImage from '@/assets/players/season2/cooper-happy.png';
import cooperAnguishImage from '@/assets/players/season2/cooper-anguish.png';
import ryanAngryImage from '@/assets/players/season2/ryan-angry.png';
import ryanSadImage from '@/assets/players/season2/ryan-sad.png';
import ryanHappyImage from '@/assets/players/season2/ryan-happy.png';
import ryanAnguishImage from '@/assets/players/season2/ryan-anguish.png';
import terryAngryImage from '@/assets/players/season2/terry-angry.png';
import terrySadImage from '@/assets/players/season2/terry-sad.png';
import terryHappyImage from '@/assets/players/season2/terry-happy.png';
import terryAnguishImage from '@/assets/players/season2/terry-anguish.png';

import TeamLogo from '@/components/TeamLogo.vue';

const { isDarkOrLight } = useTheme();

const props = defineProps({
  player: {
    type: Object,
    required: true,
  },
  team: {
    type: Object,
    default: null,
  },
  subtitle: {
    type: String,
    default: '',
  },
  imageType: {
    type: String,
    default: 'Happy',
  },
  currentChampion: {
    type: String,
    default: '',
  },
  isChampion: {
    type: Boolean,
    default: false,
  },
  isGameLive: {
    type: Boolean,
    default: false,
  },
  isMirrorMatch: {
    type: Boolean,
    default: false,
  },
  showTeamLogo: {
    type: Boolean,
    default: true,
  },
  clickable: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['card-click']);

const images = {
  Boz: {
    Happy: bozHappyImage,
    Angry: bozAngryImage,
    Sad: bozSadImage,
    Anguish: bozAnguishImage,
  },
  Terry: {
    Happy: terryHappyImage,
    Angry: terryAngryImage,
    Sad: terrySadImage,
    Anguish: terryAnguishImage,
  },
  Cooper: {
    Happy: cooperHappyImage,
    Angry: cooperAngryImage,
    Sad: cooperSadImage,
    Anguish: cooperAnguishImage,
  },
  Ryan: {
    Happy: ryanHappyImage,
    Angry: ryanAngryImage,
    Sad: ryanSadImage,
    Anguish: ryanAnguishImage,
  },
};

const getImage = (playerName, type) => {
  return images[playerName]?.[type] || null;
};
</script>

<style scoped>
.avatar {
  @apply relative flex flex-col justify-center items-center text-center my-auto w-28 sm:w-52;
}
.team-logo {
  @apply absolute flex items-center justify-center -bottom-6 w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full border-2 left-1/2 transform -translate-x-1/2;
}
</style>
