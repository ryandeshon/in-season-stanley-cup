<template>
  <v-card class="pb-3 sm:min-w-52">
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
import bozWinnerImage from '@/assets/players/boz-winner.png';
import terryWinnerImage from '@/assets/players/terry-winner.png';
import cooperWinnerImage from '@/assets/players/cooper-winner.png';
import ryanWinnerImage from '@/assets/players/ryan-winner.png';
import bozSimpsonsWinnerImage from '@/assets/players//simpsons/boz-winner.png';
import terrySimpsonsWinnerImage from '@/assets/players//simpsons/terry-winner.png';
import cooperSimpsonsWinnerImage from '@/assets/players//simpsons/cooper-winner.png';
import ryanSimpsonsWinnerImage from '@/assets/players//simpsons/ryan-winner.png';
import bozChallengerImage from '@/assets/players/boz-challenger.png';
import terryChallengerImage from '@/assets/players/terry-challenger.png';
import cooperChallengerImage from '@/assets/players/cooper-challenger.png';
import ryanChallengerImage from '@/assets/players/ryan-challenger.png';
import bozSadImage from '@/assets/players/boz-sad.png';
import terrySadImage from '@/assets/players/terry-sad.png';
import cooperSadImage from '@/assets/players/cooper-sad.png';
import ryanSadImage from '@/assets/players/ryan-sad.png';

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
    default: 'Winner',
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

const images = {
  Boz: {
    Winner: bozWinnerImage,
    Challenger: bozChallengerImage,
    Sad: bozSadImage,
    Simpsons: bozSimpsonsWinnerImage,
  },
  Terry: {
    Winner: terryWinnerImage,
    Challenger: terryChallengerImage,
    Sad: terrySadImage,
    Simpsons: terrySimpsonsWinnerImage,
  },
  Cooper: {
    Winner: cooperWinnerImage,
    Challenger: cooperChallengerImage,
    Sad: cooperSadImage,
    Simpsons: cooperSimpsonsWinnerImage,
  },
  Ryan: {
    Winner: ryanWinnerImage,
    Challenger: ryanChallengerImage,
    Sad: ryanSadImage,
    Simpsons: ryanSimpsonsWinnerImage,
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
