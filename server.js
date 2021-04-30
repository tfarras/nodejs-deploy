'use strict';

const express = require('express');

const PORT = 8080;
const HOST = '0.0.0.0';

const app = express();
app.get('/', (_, res) => {
  res.send({
    message: "It's on DigitalOcean!",
  });
});

app.get('/delayed', async (_, res) => {
  const SECONDS_DELAY = 60000;

  await new Promise((resolve) => {
    setTimeout(() => resolve(), SECONDS_DELAY);
  });

  res.send({ message: 'delayed response' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Running on http://${HOST}:${PORT}`);
});

// Graceful shutdown
function closeGracefully(signal) {
  console.log(`Received signal to terminate: ${signal}`);

  server.close(() => {
    // await db.close() if we have a db connection in this app
    // await other things we should cleanup nicely
    console.log('Http server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);
