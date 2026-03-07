const pool = require('./db');

async function initializeDatabase() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(200),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table ready');

    // Events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL DEFAULT 'other',
        client_name VARCHAR(200) NOT NULL,
        client_phone VARCHAR(20),
        venue VARCHAR(300),
        address TEXT,
        event_date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        total_amount DECIMAL(12,2) DEFAULT 0,
        advance_amount DECIMAL(12,2) DEFAULT 0,
        shipping_charge DECIMAL(12,2) DEFAULT 0,
        labour_charge DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'upcoming',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Events table ready');

    // Labours table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS labours (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        phone VARCHAR(20),
        wage DECIMAL(10,2) DEFAULT 0,
        specialization VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Labours table ready');

    // Event-Labour assignment table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_labours (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        labour_id INTEGER REFERENCES labours(id) ON DELETE CASCADE,
        UNIQUE(event_id, labour_id)
      );
    `);
    console.log('✅ Event-Labours table ready');

    // Notification tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL,
        sent_at TIMESTAMP,
        scheduled_for TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        onesignal_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Notifications table ready');

    // User devices table (for OneSignal player IDs)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        onesignal_player_id VARCHAR(200) NOT NULL,
        device_type VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, onesignal_player_id)
      );
    `);
    console.log('✅ User devices table ready');

    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

module.exports = initializeDatabase;
