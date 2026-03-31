// routes/qr.js
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

router.get('/', async (req, res) => {
  const { url, format } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param required' });
  try {
    if (format === 'svg') {
      const svg = await QRCode.toString(url, { type: 'svg', margin: 2 });
      res.set('Content-Type', 'image/svg+xml');
      res.set('Content-Disposition', 'attachment; filename="utm-qr.svg"');
      res.send(svg);
    } else {
      const buffer = await QRCode.toBuffer(url, { type: 'png', width: 400, margin: 2 });
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', 'attachment; filename="utm-qr.png"');
      res.send(buffer);
    }
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

module.exports = router;
