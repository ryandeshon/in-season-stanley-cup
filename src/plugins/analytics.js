import Vue from 'vue';
import VueAnalytics from 'vue-analytics';
import router from '@/router';

Vue.use(VueAnalytics, {
  id: 'G-KPL5ZVDJC7', // Replace with your tracking ID
  router
});