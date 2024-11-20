<template>
  <v-container class="max-w-screen-md">
    <h1 class="text-4xl font-bold mb-4">About</h1>
    <div class="text-left">
      <p>Welcome to "In Season Cup", a game where NHL teams battle for daily glory and you compete to become the ultimate season champion! Here’s how it works:</p>

      <ul class="list-disc list-inside m-4">
        <li class="mb-2">Drafting Teams: Each player begins the season by drafting a selection of NHL teams. Once the season kicks off, the last Stanley cup winner is chosen to start with the virtual "Stanley Cup".</li>
        <li class="mb-2">Winning the Cup: Each day, the Cup is held by the team that won it the night before. If the Cup-holding team wins their next game, they retain the Cup and add to their streak as reigning champion. However, if they lose, the Cup is passed to the winning team, who becomes the new champion.</li>
        <li class="mb-2">Becoming the Season Champion: At the end of the season, the player whose teams held the Cup for the most days will be crowned the season’s champion!</li>
        <li class="mb-2">Viewing Stats: On each player’s profile page, you can see their current stats, including how games they defended or won the cup and their total "championships" over the years.</li>
      </ul>

      <p>The concept of the game I came across from the "32 Thoughts" hockey podcast and wanted to use this as an excuse to build an app and learn a new language and sharpen some skills. As well as a passive way to root for teams I otherwise might not pay attention too.</p>

      <p>The code for this site is completely open source and free to use for yourself. <a href="https://github.com/ryandeshon/in-season-stanley-cup" target="_blank" rel="noopener noreferrer">Github code here</a></p>

      <div class="disclaimer mt-10">
        <h3 class="text-lg">Disclaimer</h3>
        <p class="text-xs mb-2">
          This game is an independent fan project and is not affiliated with, endorsed, or sponsored by the National Hockey League (NHL), its teams, or any of its subsidiaries. All NHL team logos, names, and related marks are the property of the NHL and respective teams. These trademarks are used for informational and entertainment purposes only, to reference the NHL teams involved in the game.
        </p>
        <p class="text-xs mb-2">
          For official information, schedules, and updates, please visit <a href="https://www.nhl.com" target="_blank" rel="noopener noreferrer">nhl.com</a>.
        </p>
      </div>

    </div>
  </v-container>
</template>
<script>
export default {
  name: 'AboutPage',
};
</script>