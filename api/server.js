const express = require('express');
const serverless = require('serverless-http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

let lightningData = [];
const cities = require('./cities.json');
const logFilePath = path.join(__dirname, 'logs.txt');

const logMessage = (message) => {
  const logEntry = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync(logFilePath, logEntry);
  console.log(message);
};

try {
  lightningData = JSON.parse(fs.readFileSync(path.join(__dirname, 'lightningData.json')));
} catch (err) {
  logMessage('Failed to load lightningData.json: ' + err);
}

const config = {
  smhiServerUrl: process.env.SMHI_SERVER_URL,
  username: process.env.WEBSOCKET_USERNAME,
  password: process.env.WEBSOCKET_PASSWORD
};

// Determine the WebSocket URL to use based on configuration
const WEBSOCKET_URL = config.smhiServerUrl;
const WEBSOCKET_USERNAME = config.username;
const WEBSOCKET_PASSWORD = config.password;

// Use CORS middleware
app.use(cors());

// Serve the lightning data file to the frontend
app.use('/.netlify/functions/server/lightning-data', express.static(path.join(__dirname, 'lightningData.json')));

// Serve the log file to the frontend
app.use('/.netlify/functions/server/logs', express.static(logFilePath));

// Serve frontend files
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Create the WebSocket connection with basic authentication to the SMHI server
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
  const dLon = toRad(lat2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Function to handle heartbeat messages
const handleHeartbeat = (message) => {
  logMessage('Heartbeat message received: ' + JSON.stringify(message));
};

// Handle WebSocket messages from the SMHI server
ws.onmessage = (message) => {
  const strike = JSON.parse(message.data);
  logMessage('Received data: ' + JSON.stringify(strike));  // Log received data

  if (strike.countryCode === 'ZZ') {
    handleHeartbeat(strike);
    return;
  }

  const { lat, lon } = strike.pos;
  const peakCurrent = strike.meta.peakCurrent;

  // Check if the lightning strike meets the threshold
  if (peakCurrent < 5000) {
    logMessage(`Condition not met: peakCurrent (${peakCurrent}) < 5000`);
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
    logMessage('Transformed data: ' + JSON.stringify(newStrike));  // Log transformed data
  } else {
    logMessage('Condition not met: Lightning strike not within 10 km of any city.');
  }
};

module.exports.handler = serverless(app);
