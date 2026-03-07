const express = require('express');
const cors = require('cors');
require('dotenv').config();

const initializeDatabase = require('./config/initDb');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const labourRoutes = require('./routes/labours');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/labours', labourRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🎵 DJ Event Manager API is running!',
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    // Try to initialize database tables
    await initializeDatabase();
  } catch (error) {
    console.error('');
    console.error('⚠️  Database connection failed. The server will start but API calls will fail.');
    console.error('⚠️  Please update your DATABASE_URL in backend/.env with the correct password.');
    console.error('');
  }

  app.listen(PORT, () => {
    console.log('');
    console.log('🎵 =============================================');
    console.log(`🎵  DJ Event Manager API Server`);
    console.log(`🎵  Running on: http://localhost:${PORT}`);
    console.log(`🎵  Health:     http://localhost:${PORT}/api/health`);
    console.log('🎵 =============================================');
    console.log('');
  });
}

startServer();
