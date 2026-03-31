// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/links', require('./routes/links'));
app.use('/api/ga4',   require('./routes/ga4'));
app.use('/api/qr',    require('./routes/qr'));

const PORT = process.env.PORT || 3002;
if (require.main === module) {
  require('./services/ga4').scheduleGa4Refresh();
  app.listen(PORT, () => console.log(`UTM Maestro on port ${PORT}`));
}

module.exports = app;
