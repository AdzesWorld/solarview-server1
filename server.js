// ════════════════════════════════════════════════
//  SolarView — Full Server (Frontend + Backend)
//  Serves dashboard HTML + receives ESP32 data
//  Deploy on Railway — node server.js
// ════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Serve the SolarView dashboard at root URL ──
// When someone visits your Railway URL they get the full dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Latest reading from ESP32 ──────────────────
let latestData = {
  voltage:     0,
  current:     0,
  power:       0,
  irradiance:  0,
  temperature: 0,
  timestamp:   null,
  connected:   false
};

const history = [];
const MAX_HISTORY = 500;

// ── POST /data  ← ESP32 sends readings here ────
app.post('/data', (req, res) => {
  const { voltage, current, power, irradiance, temperature } = req.body;

  if (
    voltage     === undefined || isNaN(voltage)    ||
    current     === undefined || isNaN(current)    ||
    irradiance  === undefined || isNaN(irradiance) ||
    temperature === undefined || isNaN(temperature)
  ) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  const calculatedPower = power !== undefined
    ? +power
    : +(voltage * current).toFixed(2);

  latestData = {
    voltage:     +parseFloat(voltage).toFixed(2),
    current:     +parseFloat(current).toFixed(2),
    power:       +calculatedPower.toFixed(2),
    irradiance:  +parseFloat(irradiance).toFixed(1),
    temperature: +parseFloat(temperature).toFixed(1),
    timestamp:   new Date().toISOString(),
    connected:   true
  };

  history.push({ ...latestData });
  if (history.length > MAX_HISTORY) history.shift();

  console.log(`[${new Date().toLocaleTimeString()}] ESP32 -> V=${latestData.voltage}V  I=${latestData.current}A  P=${latestData.power}W  Irr=${latestData.irradiance}  T=${latestData.temperature}C`);

  res.json({ status: 'ok', received: latestData });
});

// ── GET /data  ← Dashboard polls this ─────────
app.get('/data', (req, res) => {
  if (latestData.timestamp) {
    const age = (Date.now() - new Date(latestData.timestamp)) / 1000;
    latestData.connected = age < 10;
  }
  res.json(latestData);
});

// ── GET /history  ← Chart history ─────────────
app.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(history.slice(-limit));
});

// ── GET /status  ← Health check ───────────────
app.get('/status', (req, res) => {
  res.json({
    server:    'SolarView',
    version:   '1.0.0',
    uptime:    process.uptime().toFixed(0) + 's',
    readings:  history.length,
    connected: latestData.connected
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ☀  SolarView Server');
  console.log(`  Dashboard : http://localhost:${PORT}`);
  console.log(`  Data API  : http://localhost:${PORT}/data`);
  console.log(`  History   : http://localhost:${PORT}/history`);
  console.log(`  Status    : http://localhost:${PORT}/status`);
  console.log('');
  console.log('  Waiting for ESP32...');
  console.log('');
});