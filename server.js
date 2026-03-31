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

// Short link redirect — must be after static files and /api routes
const db = require('./db');
const logClick = db.prepare('INSERT INTO clicks (link_id, ip, user_agent, referrer) VALUES (?, ?, ?, ?)');
app.get('/:slug', (req, res) => {
  const link = db.prepare('SELECT id, utm_url FROM links WHERE slug = ?').get(req.params.slug);
  if (!link) return res.status(404).send('Not found');
  logClick.run(link.id, req.headers['x-real-ip'] || req.ip, req.headers['user-agent'] || '', req.headers['referer'] || '');
  res.redirect(302, link.utm_url);
});

const PORT = process.env.PORT || 3002;
if (require.main === module) {
  require('./services/ga4').scheduleGa4Refresh();
  app.listen(PORT, () => console.log(`UTM Maestro on port ${PORT}`));
}

module.exports = app;
