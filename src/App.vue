<template>
  <v-app>
    <!-- App Bar / Navigation Bar -->
    <v-app-bar app color="primary" dark class="px-2">
      <v-toolbar-title>
        <a href="/"
          ><img
            :src="logo"
            alt="In Season Cup Logo"
            class="hover:cursor-pointer mr-2 h-10"
        /></a>
      </v-toolbar-title>
      <v-spacer></v-spacer>
      <div class="flex gap-1">
        <v-btn text to="/standings">Standings</v-btn>
        <v-btn text to="/about">About</v-btn>
      </div>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <router-view></router-view>
    </v-main>

    <!-- Footer -->
    <v-footer app color="primary" dark>
      <span class="mx-auto"
        >© {{ new Date().getFullYear() }} In Season Cup</span
      >
    </v-footer>
  </v-app>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      logo: require('@/assets/in-season-logo.png'),
    };
  },
};
</script>

<style>
/* Import CSS files from the assets folder */
@import '@/assets/_variables.css';
@import '@/assets/style.css';
</style>
