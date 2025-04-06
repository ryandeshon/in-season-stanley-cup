<template>
  <div class="container mx-auto py-10">
    <div class="grid grid-cols-4 gap-4 mb-8">
      {{ currentPlayerId }}
      <div
        v-for="player in players"
        :key="player.playerId"
        class="flex flex-col items-center"
      >
        <img
          :src="player.avatarUrl"
          class="w-24 h-24 rounded-full mb-2 border-2 border-gray-300"
        />
        <h3 class="text-xl font-bold mb-2">{{ player.name }}</h3>
        <ul class="list-disc text-sm text-gray-600">
          <li v-for="team in player.teams" :key="team">{{ team }}</li>
        </ul>
      </div>
    </div>

    <div class="text-center text-xl font-semibold mb-4">
      <span v-if="currentPickerId === currentPlayerId" class="text-green-500"
        >It's your turn!</span
      >
      <span v-else class="text-gray-500"
        >Waiting for {{ currentPickerName }}...</span
      >
      <div class="mt-2 text-sm text-gray-500">
        Time Remaining: {{ countdown }} seconds
      </div>
    </div>

    <div class="grid grid-cols-6 gap-4">
      <div v-for="team in allTeams" :key="team.id" class="relative">
        <img
          :src="team.logo"
          :class="[
            'cursor-pointer border-2 rounded',
            team.available
              ? 'border-green-400 hover:border-green-600'
              : 'grayscale opacity-50 border-gray-300 cursor-not-allowed',
          ]"
          @click="selectTeam(team)"
        />
        <span
          v-if="!team.available"
          class="absolute top-1 right-1 bg-gray-800 text-white text-xs px-1 rounded"
        >
          Picked
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const currentPlayerId = route.params.playerId;

const players = ref([]);
const allTeams = ref([]);
const currentPickerId = ref('');
const countdown = ref(60);

const currentPickerName = computed(() => {
  const picker = players.value.find(
    (p) => p.playerId === currentPickerId.value
  );
  return picker ? picker.name : '';
});

const fetchDraftState = async () => {
  // Fetch from DynamoDB or your API
};

const selectTeam = (team) => {
  if (!team.available || currentPickerId.value !== currentPlayerId) return;

  // API call to select team
};

onMounted(() => {
  fetchDraftState();

  setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) countdown.value = 60;
    fetchDraftState();
  }, 1000);
});
</script>

<style scoped>
/* Additional custom styling if necessary */
</style>
