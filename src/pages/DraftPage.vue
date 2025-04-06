<template>
  <v-container class="py-10">
    {{ currentPickerName }}
    <v-row class="mb-8" dense>
      <v-col
        v-for="player in allPlayersData"
        :key="player.playerId"
        cols="12"
        sm="3"
        class="text-center"
      >
        <PlayerCard
          :player="player"
          image-type="Winner"
          :show-team-logo="false"
        />
      </v-col>
    </v-row>

    <div class="text-center text-h5 font-weight-semibold mb-4">
      <span v-if="currentPickerName === currentPlayerName" class="text-success"
        >It's your turn!</span
      >
      <span v-else class="text-secondary"
        >Waiting for {{ currentPickerName }}...</span
      >
      <div class="mt-2 text-body-2 text-secondary">
        Time Remaining: {{ countdown }} seconds
      </div>
    </div>

    <v-row dense>
      <v-col v-for="team in nhlTeams" :key="team" cols="2">
        <v-card class="cursor-pointer" outlined>
          <v-img
            :src="`https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`"
            height="100px"
          ></v-img>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { getAllPlayers } from '../services/dynamodbService';
import PlayerCard from '@/components/PlayerCard.vue';

const route = useRoute();
const currentPlayerName = route.params.playerName;

const allPlayersData = ref([]);
const countdown = ref(60);

const currentPickerName = computed(() => {
  const picker = allPlayersData.value.find(
    (p) => p.playerId === currentPickerName.value
  );
  return picker ? picker.name : '';
});

const nhlTeams = ref([
  'ANA',
  'ARI',
  'BOS',
  'BUF',
  'CGY',
  'CAR',
  'CHI',
  'COL',
  'CBJ',
  'DAL',
  'DET',
  'EDM',
  'FLA',
  'LAK',
  'MIN',
  'MTL',
  'NSH',
  'NJD',
  'NYI',
  'NYR',
  'OTT',
  'PHI',
  'PIT',
  'SJS',
  'SEA',
  'STL',
  'TBL',
  'TOR',
  'VAN',
  'VGK',
  'WSH',
  'WPG',
]);

onMounted(async () => {
  try {
    allPlayersData.value = await getAllPlayers();
  } catch (error) {
    console.error('Error fetching players:', error);
    allPlayersData.value = [];
  }
});

onMounted(() => {
  setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) countdown.value = 60;
  }, 1000);
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
