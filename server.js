// ════════════════════════════════════════════════
//  SolarView — ESP32 Bridge Server
//  Run: node server.js
//  Requires: npm install express cors
// ════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const app     = express();
const PORT    = 3000;

app.use(cors());          // allow the dashboard HTML to fetch from here
app.use(express.json());  // parse JSON body from ESP32

// ── Latest reading (updated every time ESP32 POSTs) ──
let latestData = {
  voltage:     0,
  current:     0,
  power:       0,
  irradiance:  0,
  temperature: 0,
  timestamp:   null,
  connected:   false
};

// ── History log (keeps last 500 readings) ──
const history = [];
const MAX_HISTORY = 500;

const path = require('path');

// Serve the dashboard HTML at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ────────────────────────────────────────────────
//  POST /data  ← ESP32 sends readings here
// ────────────────────────────────────────────────
app.post('/data', (req, res) => {
  const { voltage, current, power, irradiance, temperature } = req.body;

  // Validate — reject obviously bad values
  if (
    voltage     === undefined || isNaN(voltage)     ||
    current     === undefined || isNaN(current)     ||
    irradiance  === undefined || isNaN(irradiance)  ||
    temperature === undefined || isNaN(temperature)
  ) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  // Calculate power if ESP32 doesn't send it
  const calculatedPower = power !== undefined ? +power : +(voltage * current).toFixed(2);

  latestData = {
    voltage:     +parseFloat(voltage).toFixed(2),
    current:     +parseFloat(current).toFixed(2),
    power:       +calculatedPower.toFixed(2),
    irradiance:  +parseFloat(irradiance).toFixed(1),
    temperature: +parseFloat(temperature).toFixed(1),
    timestamp:   new Date().toISOString(),
    connected:   true
  };

  // Save to history
  history.push({ ...latestData });
  if (history.length > MAX_HISTORY) history.shift();

  console.log(`[${new Date().toLocaleTimeString()}] Received: V=${latestData.voltage}V  I=${latestData.current}A  P=${latestData.power}W  Irr=${latestData.irradiance}W/m²  T=${latestData.temperature}°C`);

  res.json({ status: 'ok', received: latestData });
});

// ────────────────────────────────────────────────
//  GET /data  ← Dashboard polls this
// ────────────────────────────────────────────────
app.get('/data', (req, res) => {
  // Mark as disconnected if no reading in 10 seconds
  if (latestData.timestamp) {
    const age = (Date.now() - new Date(latestData.timestamp)) / 1000;
    latestData.connected = age < 10;
  }
  res.json(latestData);
});

// ────────────────────────────────────────────────
//  GET /history  ← Dashboard uses this for charts
// ────────────────────────────────────────────────
app.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(history.slice(-limit));
});

// ────────────────────────────────────────────────
//  GET /status  ← Health check
// ────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({
    server:   'SolarView Bridge',
    version:  '1.0.0',
    uptime:   process.uptime().toFixed(0) + 's',
    readings: history.length,
    connected: latestData.connected
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ☀  SolarView Bridge Server');
  console.log(`  Listening on http://0.0.0.0:${PORT}`);
  console.log('');
  console.log('  Endpoints:');
  console.log(`    POST http://YOUR_LAPTOP_IP:${PORT}/data   ← ESP32 sends here`);
  console.log(`    GET  http://localhost:${PORT}/data        ← Dashboard reads here`);
  console.log(`    GET  http://localhost:${PORT}/history     ← Chart history`);
  console.log('');
  console.log('  Waiting for ESP32 data...');
  console.log('');
});
