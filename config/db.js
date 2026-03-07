const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;

// Only enable SSL for remote databases (not local)
const useSSL = dbUrl && !dbUrl.includes('localhost') && !dbUrl.includes('sslmode=disable');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected at:', res.rows[0].now);
  }
});

module.exports = pool;
