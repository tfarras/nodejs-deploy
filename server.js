'use strict';

const express = require('express');

const PORT = 8080;
const HOST = '0.0.0.0';

const app = express();
app.get('/', (req, res) => {
  res.send("It's on Digitalocean!");
});

app.listen(PORT, HOST);
console.log('\x1b[36m', `Running on http://${HOST}:${PORT}`);
