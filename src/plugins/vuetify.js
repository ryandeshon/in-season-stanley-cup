// src/plugins/vuetify.js
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';

import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const Season1LightTheme = {
  dark: false,
  colors: {
    background: '#cee6ff',
    surface: '#ffffff',
    primary: '#7fbfff',
    secondary: '#99c2ff',
    error: '#B00020',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FB8C00',
  },
};

const Season1DarkTheme = {
  dark: true,
  colors: {
    background: '#1e1e1e',
    surface: '#373737',
    primary: '#003366',
    secondary: '#00509d',
    error: '#CF6679',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FB8C00',
  },
};

const Season2LightTheme = {
  dark: false,
  colors: {
    background: '#FFF8E1', // very light, warm yellow
    surface: '#fffdf8', // soft cream
    primary: '#FFA000', // mellow amber
    secondary: '#42A5F5', // sky–blue
    error: '#E53935', // softened red
    info: '#64B5F6', // lighter blue
    success: '#81C784', // sage green
    warning: '#FFEB3B', // mellow yellow
  },
};

const Season2DarkTheme = {
  dark: true,
  colors: {
    background: '#1E1E1E', // near-black charcoal
    surface: '#666666', // softer charcoal
    primary: '#FFB300', // goldenrod
    secondary: '#64B5F6', // lighter blue for contrast
    error: '#EF5350', // muted red
    info: '#90CAF9', // pale blue
    success: '#A5D6A7', // light sage
    warning: '#FFF176', // soft yellow
  },
};

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'season2-light',
    themes: {
      'season1-light': Season1LightTheme,
      'season1-dark': Season1DarkTheme,
      'season2-light': Season2LightTheme,
      'season2-dark': Season2DarkTheme,
      // Keep legacy theme names for backward compatibility
      light: Season2LightTheme,
      dark: Season2DarkTheme,
    },
    variations: {
      colors: ['primary', 'secondary'],
      lighten: 3,
      darken: 3,
    },
  },
});
