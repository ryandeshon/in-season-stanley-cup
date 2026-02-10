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
import { useSeasonStore } from '@/store/seasonStore';

import TeamLogo from '@/components/TeamLogo.vue';

const { isDarkOrLight } = useTheme();
const seasonStore = useSeasonStore();

// Season 1 images
import bozAngryImageS1 from '@/assets/players/season1/boz-angry.png';
import bozSadImageS1 from '@/assets/players/season1/boz-sad.png';
import bozHappyImageS1 from '@/assets/players/season1/boz-happy.png';
import cooperAngryImageS1 from '@/assets/players/season1/cooper-angry.png';
import cooperSadImageS1 from '@/assets/players/season1/cooper-sad.png';
import cooperHappyImageS1 from '@/assets/players/season1/cooper-happy.png';
import ryanAngryImageS1 from '@/assets/players/season1/ryan-angry.png';
import ryanSadImageS1 from '@/assets/players/season1/ryan-sad.png';
import ryanHappyImageS1 from '@/assets/players/season1/ryan-happy.png';
import terryAngryImageS1 from '@/assets/players/season1/terry-angry.png';
import terrySadImageS1 from '@/assets/players/season1/terry-sad.png';
import terryHappyImageS1 from '@/assets/players/season1/terry-happy.png';

// Season 2 images
import bozAngryImageS2 from '@/assets/players/season2/boz-angry.png';
import bozSadImageS2 from '@/assets/players/season2/boz-sad.png';
import bozHappyImageS2 from '@/assets/players/season2/boz-happy.png';
import bozAnguishImageS2 from '@/assets/players/season2/boz-anguish.png';
import bozOlympicImageS2 from '@/assets/players/season2/boz-olympic.png';
import cooperAngryImageS2 from '@/assets/players/season2/cooper-angry.png';
import cooperSadImageS2 from '@/assets/players/season2/cooper-sad.png';
import cooperHappyImageS2 from '@/assets/players/season2/cooper-happy.png';
import cooperAnguishImageS2 from '@/assets/players/season2/cooper-anguish.png';
import ryanAngryImageS2 from '@/assets/players/season2/ryan-angry.png';
import ryanSadImageS2 from '@/assets/players/season2/ryan-sad.png';
import ryanHappyImageS2 from '@/assets/players/season2/ryan-happy.png';
import ryanAnguishImageS2 from '@/assets/players/season2/ryan-anguish.png';
import terryAngryImageS2 from '@/assets/players/season2/terry-angry.png';
import terrySadImageS2 from '@/assets/players/season2/terry-sad.png';
import terryHappyImageS2 from '@/assets/players/season2/terry-happy.png';
import terryAnguishImageS2 from '@/assets/players/season2/terry-anguish.png';

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

const imagesSeason1 = {
  Boz: {
    Happy: bozHappyImageS1,
    Angry: bozAngryImageS1,
    Sad: bozSadImageS1,
    Anguish: bozSadImageS1, // Fallback to sad since anguish doesn't exist
  },
  Terry: {
    Happy: terryHappyImageS1,
    Angry: terryAngryImageS1,
    Sad: terrySadImageS1,
    Anguish: terrySadImageS1, // Fallback to sad since anguish doesn't exist
  },
  Cooper: {
    Happy: cooperHappyImageS1,
    Angry: cooperAngryImageS1,
    Sad: cooperSadImageS1,
    Anguish: cooperSadImageS1, // Fallback to sad since anguish doesn't exist
  },
  Ryan: {
    Happy: ryanHappyImageS1,
    Angry: ryanAngryImageS1,
    Sad: ryanSadImageS1,
    Anguish: ryanSadImageS1, // Fallback to sad since anguish doesn't exist
  },
};

const imagesSeason2 = {
  Boz: {
    Happy: bozHappyImageS2,
    Angry: bozAngryImageS2,
    Sad: bozSadImageS2,
    Anguish: bozAnguishImageS2,
    Olympic: bozOlympicImageS2,
  },
  Terry: {
    Happy: terryHappyImageS2,
    Angry: terryAngryImageS2,
    Sad: terrySadImageS2,
    Anguish: terryAnguishImageS2,
  },
  Cooper: {
    Happy: cooperHappyImageS2,
    Angry: cooperAngryImageS2,
    Sad: cooperSadImageS2,
    Anguish: cooperAnguishImageS2,
  },
  Ryan: {
    Happy: ryanHappyImageS2,
    Angry: ryanAngryImageS2,
    Sad: ryanSadImageS2,
    Anguish: ryanAnguishImageS2,
  },
};

const getImage = (playerName, type) => {
  const images =
    seasonStore.currentSeason === 'season1' ? imagesSeason1 : imagesSeason2;
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
