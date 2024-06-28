const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3001;

let lightningData = [];
const cities = require('./cities.json');
let config = {};

try {
  lightningData = JSON.parse(fs.readFileSync(path.join(__dirname, 'lightningData.json')));
} catch (err) {
  console.error('Failed to load lightningData.json:', err);
}

try {
  config = require('./config.json');
} catch (err) {
  console.error('Failed to load config.json:', err);
  process.exit(1); // Exit if config.json cannot be loaded
}

// Determine which WebSocket URL to use based on configuration file
const WEBSOCKET_URL = config.useMockServer ? config.mockServerUrl : config.smhiServerUrl;
const WEBSOCKET_USERNAME = config.username;
const WEBSOCKET_PASSWORD = config.password;

// Use CORS middleware
app.use(cors());

// Serve the lightning data file to the frontend
app.use('/lightning-data', express.static(path.join(__dirname, 'lightningData.json')));

// Create the WebSocket connection with basic authentication to the mock server or SMHI server
const ws = new WebSocket(WEBSOCKET_URL, {
  headers: {
    'Authorization': 'Basic ' + Buffer.from(WEBSOCKET_USERNAME + ':' + WEBSOCKET_PASSWORD).toString('base64')
  }
});

// Save data to file
const saveData = () => {
  fs.writeFileSync(path.join(__dirname, 'lightningData.json'), JSON.stringify(lightningData, null, 2));
};

// Haversine formula to calculate distance between two lat/lon points
const haversine = (lat1, lon1, lat2, lon2) => {
  const toRad = x => (x * Math.PI) / 180;

  const R = 6371; // Radius of the Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Function to handle heartbeat messages
const handleHeartbeat = (message) => {
  console.log('Heartbeat message received:', message);
};

// Handle WebSocket messages from the mock server or SMHI server
ws.onmessage = (message) => {
  const strike = JSON.parse(message.data);
  console.log('Received data:', strike);  // Log received data

  if (strike.countryCode === 'ZZ') {
    handleHeartbeat(strike);
    return;
  }

  const { lat, lon } = strike.pos;
  const peakCurrent = strike.meta.peakCurrent;

  // Check if the lightning strike meets the threshold
  if (peakCurrent < 10) {
    console.log(`Condition not met: peakCurrent (${peakCurrent}) < 10`);
    return;
  }

  // Determine if the strike is within 10 km of any city
  let affectedCities = [];
  for (const city of cities) {
    const distance = haversine(lat, lon, city.lat, city.lon);
    if (distance <= 10) {
      // Check if this city has already been notified today
      const alreadyNotified = lightningData.some(data => data.city === city.name && new Date(data.timestamp).toDateString() === new Date().toDateString());
      if (!alreadyNotified) {
        affectedCities.push(city.name);
      }
    }
  }

  if (affectedCities.length > 0) {
    const newStrike = {
      number: lightningData.length + 1,
      cities: affectedCities,
      timestamp: strike.time,
      peakCurrent
    };
    lightningData.push(newStrike);
    saveData();
    console.log('Transformed data:', newStrike);  // Log transformed data
  } else {
    console.log('Condition not met: Lightning strike not within 10 km of any city.');
  }
};

// Start the backend server
app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
