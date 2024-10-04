<template>
  <v-app>
    <!-- App Bar / Navigation Bar -->
    <v-app-bar app color="primary" dark>
      <v-toolbar-title>In Season Stanley Cup</v-toolbar-title>
      <v-spacer></v-spacer>
      <div class="flex gap-1">
        <v-btn text to="/">Home</v-btn>
        <v-btn text to="/standings">Standings</v-btn>
        <v-btn text to="/about">About</v-btn>
      </div>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <router-view></router-view>
    </v-main>

    <!-- Footer (Optional) -->
    <v-footer app color="primary" dark>
      <span class="mx-auto">© 2024 In Season Stanley Cup</span>
    </v-footer>
  </v-app>
</template>

<script>
export default {
  name: 'App',
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
