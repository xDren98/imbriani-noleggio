const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '5.4.1',
    message: 'Imbriani Noleggio Server Ready' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Imbriani Noleggio Server`);
  console.log(`📱 Local: http://localhost:${PORT}`);
  console.log(`⚡ Admin: http://localhost:${PORT}/admin`);
  console.log(`🔧 Health: http://localhost:${PORT}/health`);
  console.log(`✅ Ready for testing!\n`);
});