const express = require('express');
const axios = require('axios');
const app = express();

app.get('/nhl-api/*', async (req, res) => {
  try {
    const apiUrl = `https://api-web.nhle.com/v1`;
    const response = await axios.get(apiUrl);
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
