const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

app.get('/api', async (req, res) => {
  // Simple proxy-less setup: frontend should call GAS directly with GET
  res.json({ ok: true, message: 'Use frontend to call GAS directly via GET to avoid CORS.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
