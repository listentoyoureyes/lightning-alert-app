module.exports = {
    apps: [
      {
        name: 'lightning-alert-app',
        script: 'api/server.js',
        env: {
          NODE_ENV: 'production',
          SMHI_SERVER_URL: process.env.SMHI_SERVER_URL,
          WEBSOCKET_USERNAME: process.env.WEBSOCKET_USERNAME,
          WEBSOCKET_PASSWORD: process.env.WEBSOCKET_PASSWORD
        }
      }
    ]
  };
  