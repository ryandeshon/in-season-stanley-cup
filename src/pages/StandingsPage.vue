<template>
  <v-container>
    <h1 class="text-4xl font-bold mb-4">Standings</h1>
    <p>View the standings of the players based on their teams' cup reigns.</p>
  </v-container>
</template>

<script>
export default {

  name: 'StandingsPage',
  data() {
    return {
      standings: [],
    };
  },
};
</script>
