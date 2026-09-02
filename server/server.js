require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Blueprint AI API running', version: '1.0.0' });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ollama: process.env.OLLAMA_HOST || process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Blueprint AI server running on http://localhost:${PORT}`));
});
