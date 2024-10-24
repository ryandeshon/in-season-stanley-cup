const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to set CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

// Handle GET requests and proxy to the NHL API
app.get('/nhl-api/*', async (req, res) => {
  try {
    const apiUrl = process.env.VUE_APP_NHL_API_URL;
    console.log(`Proxying request to: ${apiUrl}`);

    const response = await axios.get(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    console.log("🚀 ~ app.get ~ response:", response.data)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from NHL API:', error);
    res.status(500).send('Error fetching data from NHL API');
  }
});

// Handle OPTIONS requests for CORS preflight
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.status(200).end(); // Return 200 status for preflight
});

// Export the app object. Lambda will use this as the entry point.
module.exports = app;