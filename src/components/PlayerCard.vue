<template>
  <v-card
    class="pb-3 sm:min-w-52 border-spacing-2 border-2 border-black rounded-lg cursor-pointer"
    :class="{
      'border-white': isDarkOrLight === 'dark',
      'border-black': isDarkOrLight === 'light',
    }"
    @click="$emit('card-click')"
  >
    <v-card-text class="flex flex-col justify-center items-center">
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
          class="my-2"
          :class="{
            'saturate-50 contrast-125 brightness-75': props.isMirrorMatch,
            '-scale-x-100': props.isChampion,
          }"
          :alt="`${props.player?.name} Avatar`"
        />
        <template v-if="showTeamLogo">
          <div v-if="props.team" class="team-logo">
            <img
              :src="`https://assets.nhle.com/logos/nhl/svg/${props.team?.abbrev}_light.svg`"
              :alt="`${team.placeName.default} Logo`"
            />
          </div>
          <div v-else class="team-logo">
            <img
              :src="`https://assets.nhle.com/logos/nhl/svg/${props.currentChampion}_light.svg`"
              :alt="`${props.currentChampion} Logo`"
            />
          </div>
        </template>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { useTheme } from '@/composables/useTheme';

import bozAngryImage from '@/assets/players/simpsons/boz-angry.png';
import bozSadImage from '@/assets/players/simpsons/boz-sad.png';
import bozHappyImage from '@/assets/players/simpsons/boz-happy.png';
import bozAnguishImage from '@/assets/players/simpsons/boz-anguish.png';
import cooperAngryImage from '@/assets/players/simpsons/cooper-angry.png';
import cooperSadImage from '@/assets/players/simpsons/cooper-sad.png';
import cooperHappyImage from '@/assets/players/simpsons/cooper-happy.png';
import cooperAnguishImage from '@/assets/players/simpsons/cooper-anguish.png';
import ryanAngryImage from '@/assets/players/simpsons/ryan-angry.png';
import ryanSadImage from '@/assets/players/simpsons/ryan-sad.png';
import ryanHappyImage from '@/assets/players/simpsons/ryan-happy.png';
import ryanAnguishImage from '@/assets/players/simpsons/ryan-anguish.png';
import terryAngryImage from '@/assets/players/simpsons/terry-angry.png';
import terrySadImage from '@/assets/players/simpsons/terry-sad.png';
import terryHappyImage from '@/assets/players/simpsons/terry-happy.png';
import terryAnguishImage from '@/assets/players/simpsons/terry-anguish.png';

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
  @apply absolute flex align-middle justify-center -bottom-6 w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full border-2;
}
</style>
