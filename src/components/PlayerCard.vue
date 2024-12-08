<template>
  <v-card class="pb-3 sm:min-w-52">
    <v-card-text class="flex flex-col justify-center items-center">
      <router-link :to="`/player/${player?.name}`"
        ><h3 class="mb-0">{{ player?.name }}</h3></router-link
      >
      <p v-if="subtitle" class="text-center">{{ subtitle }}</p>
      <p v-if="team?.placeName.default" class="mb-1">
        <strong>{{ team?.placeName.default }}</strong>
      </p>
      <div v-if="isGameLive" class="text-sm">
        <div>Score: {{ team?.score }}</div>
        <div>SOG: {{ team?.sog }}</div>
      </div>
      <div class="avatar">
        <img
          :src="getImage(player?.name, imageType)"
          class="my-2"
          :class="{
            'saturate-50 contrast-125 brightness-75': isMirrorMatch,
            '-scale-x-100': isChampion,
          }"
          :alt="`${player?.name} Avatar`"
        />
        <div v-if="team" class="team-logo">
          <img
            :src="`https://assets.nhle.com/logos/nhl/svg/${team.abbrev}_light.svg`"
            :alt="`${team.placeName.default} Logo`"
          />
        </div>
        <div v-else class="team-logo">
          <img
            :src="`https://assets.nhle.com/logos/nhl/svg/${currentChampion}_light.svg`"
            :alt="`${currentChampion} Logo`"
          />
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script>
import bozWinnerImage from '@/assets/players/boz-winner.png';
import terryWinnerImage from '@/assets/players/terry-winner.png';
import cooperWinnerImage from '@/assets/players/cooper-winner.png';
import ryanWinnerImage from '@/assets/players/ryan-winner.png';
import bozChallengerImage from '@/assets/players/boz-challenger.png';
import terryChallengerImage from '@/assets/players/terry-challenger.png';
import cooperChallengerImage from '@/assets/players/cooper-challenger.png';
import ryanChallengerImage from '@/assets/players/ryan-challenger.png';
import bozSadImage from '@/assets/players/boz-sad.png';
import terrySadImage from '@/assets/players/terry-sad.png';
import cooperSadImage from '@/assets/players/cooper-sad.png';
import ryanSadImage from '@/assets/players/ryan-sad.png';

export default {
  name: 'PlayerCard',
  props: {
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
  },
  data() {
    return {
      bozWinnerImage,
      terryWinnerImage,
      cooperWinnerImage,
      ryanWinnerImage,
      bozChallengerImage,
      terryChallengerImage,
      cooperChallengerImage,
      ryanChallengerImage,
      bozSadImage,
      terrySadImage,
      cooperSadImage,
      ryanSadImage,
    };
  },
  methods: {
    getImage(playerName, type) {
      const images = {
        Boz: {
          Winner: this.bozWinnerImage,
          Challenger: this.bozChallengerImage,
          Sad: this.bozSadImage,
        },
        Terry: {
          Winner: this.terryWinnerImage,
          Challenger: this.terryChallengerImage,
          Sad: this.terrySadImage,
        },
        Cooper: {
          Winner: this.cooperWinnerImage,
          Challenger: this.cooperChallengerImage,
          Sad: this.cooperSadImage,
        },
        Ryan: {
          Winner: this.ryanWinnerImage,
          Challenger: this.ryanChallengerImage,
          Sad: this.ryanSadImage,
        },
      };
      return images[playerName]?.[type] || null;
    },
  },
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
