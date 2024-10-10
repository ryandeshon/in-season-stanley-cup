const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to set CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins; change to specific origin if needed
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // Allow specified methods
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With'); // Allow specified headers
  res.setHeader('Access-Control-Allow-Credentials', true); // Allow credentials such as cookies or auth headers
  next();
});

// Handle GET requests and proxy to the NHL API
app.get('/nhl-api/*', async (req, res) => {
  try {
    // Dynamically build the API URL using the incoming request's path
    const apiUrl = `https://api-web.nhle.com${req.originalUrl.replace('/nhl-api', '')}`;
    console.log(`Proxying request to: ${apiUrl}`);

    const response = await axios.get(apiUrl);
    // Ensure CORS headers are included in the successful response
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
