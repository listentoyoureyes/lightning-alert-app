const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

let lightningData = [];
const citiesPath = path.join(__dirname, 'cities.json');
const logFilePath = path.join(__dirname, 'logs.txt');
const lightningDataPath = path.join(__dirname, 'lightningData.json');

// Log environment variables
console.log('SMHI_SERVER_URL:', process.env.SMHI_SERVER_URL);
console.log('WEBSOCKET_USERNAME:', process.env.WEBSOCKET_USERNAME);
console.log('WEBSOCKET_PASSWORD:', process.env.WEBSOCKET_PASSWORD);

// Load cities data
let cities;
try {
  cities = JSON.parse(fs.readFileSync(citiesPath));
} catch (err) {
  console.error('Failed to load cities.json:', err);
}

// Load existing lightning data
try {
  if (fs.existsSync(lightningDataPath)) {
    lightningData = JSON.parse(fs.readFileSync(lightningDataPath));
  }
} catch (err) {
  console.error('Failed to load lightningData.json:', err);
}

// Function to log messages to a file
const logMessage = (message) => {
  const logEntry = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync(logFilePath, logEntry);
  console.log(message);
};

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

// Serve the lightning data to the frontend
app.get('/api/lightning-data', (req, res) => {
  res.json(lightningData);
});

// Serve the logs to the frontend
app.get('/api/logs', (req, res) => {
  fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Failed to read log file');
    }
    res.send(data);
  });
});

// Serve frontend files
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Create the WebSocket connection with basic authentication to the SMHI server
const ws = new WebSocket(WEBSOCKET_URL, {
  headers: {
    'Authorization': 'Basic ' + Buffer.from(`${WEBSOCKET_USERNAME}:${WEBSOCKET_PASSWORD}`).toString('base64')
  }
});

// Save data to file
const saveData = () => {
  fs.writeFileSync(lightningDataPath, JSON.stringify(lightningData, null, 2));
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
      const alreadyNotified = lightningData.some(data => data.cities.includes(city.name) && new Date(data.timestamp).toDateString() === new Date().toDateString());
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

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
