const { Pool } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;

// Only enable SSL for remote databases (not local)
const useSSL = dbUrl && !dbUrl.includes('localhost') && !dbUrl.includes('sslmode=disable');

// Render / Supabase connection issues are usually due to IPV6 resolving first.
// `pg` pool config supports providing `host` logic, but the simplest option
// is just to force pg to use ipv4 only if it hits ENETUNREACH on an ipv6
const pool = new Pool({
  connectionString: dbUrl,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

// Force PostgreSQL connections to use IPv4 to fix ENETUNREACH errors on Render
const pg = require('pg');
pg.defaults.family = 4;

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected at:', res.rows[0].now);
  }
});

module.exports = pool;
