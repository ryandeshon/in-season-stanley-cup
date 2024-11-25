// src/plugins/vuetify.js
import { createVuetify } from 'vuetify';
import 'vuetify/styles'; // Ensure you have Vuetify styles
import '@mdi/font/css/materialdesignicons.css'; // Import Material Design Icons (optional)

// Vuetify components and directives (if using Vuetify 3)
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

export default createVuetify({
  components,
  directives,
});
