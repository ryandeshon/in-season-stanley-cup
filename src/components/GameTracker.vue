<template>
  <div>
    <h1>Live Game Tracker</h1>
    <p v-if="gameData">Current Score: {{ gameData.score }}</p>
    <p v-else>No game currently available.</p>
  </div>
</template>

<script>
export default {
  data() {
    return {
      gameData: null,
      socket: null,
    };
  },
  async created() {
    // Load initial game data
    this.fetchGameData();

    // Initialize WebSocket connection if there is a game
    if (this.gameData) {
      this.initWebSocket();
    }
  },
  methods: {
    async fetchGameData() {
      try {
        const response = await fetch("https://api.yourservice.com/game");
        this.gameData = await response.json();
      } catch (error) {
        console.error("Error fetching game data:", error);
      }
    },
    initWebSocket() {
      // Replace with your WebSocket server URL
      this.socket = new WebSocket("wss://api.yourservice.com/game-updates");

      this.socket.onopen = () => {
        console.log("WebSocket connection established");
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received game update:", data);

        // Update game data with the new data from WebSocket
        this.gameData = data;
      };

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      this.socket.onclose = () => {
        console.log("WebSocket connection closed");
      };
    },
  },
  beforeUnmount() {
    // Clean up WebSocket connection when the component is destroyed
    if (this.socket) {
      this.socket.close();
    }
  },
};
</script>
