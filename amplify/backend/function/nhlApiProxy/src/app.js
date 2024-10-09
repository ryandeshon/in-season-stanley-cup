const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to set CORS headers for all incoming requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins; change to specific origin if needed
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // Allow specified methods
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With'); // Allow specified headers
  res.setHeader('Access-Control-Allow-Credentials', true); // Allow credentials such as cookies or auth headers
  next();
});

app.get('/nhl-api/*', async (req, res) => {
  try {
    const apiUrl = process.env.VUE_APP_NHL_API_URL;
    console.log(`Proxying request to: ${apiUrl}`);

    const response = await axios.get(apiUrl);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Add CORS header for successful response
    res.json(response.data);

    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from NHL API:', error);
    res.status(500).send('Error fetching data from NHL API');
  }
});

app.use((req, res) => {
  res.status(404).send('Endpoint not found');
});

// Export the app object. Lambda will use this as the entry point.
module.exports = app;
