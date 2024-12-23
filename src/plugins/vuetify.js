// src/plugins/vuetify.js
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';

import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const lightTheme = {
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

const darkTheme = {
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

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: lightTheme,
      dark: darkTheme,
    },
    variations: {
      colors: ['primary', 'secondary'],
      lighten: 3,
      darken: 3,
    },
  },
});
