-- =============================================
-- DJ Event Manager - Database Setup Script
-- Run this in your SQL Playground / psql
-- =============================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(200),
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Events Table
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

-- 3. Labours Table
CREATE TABLE IF NOT EXISTS labours (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  wage DECIMAL(10,2) DEFAULT 0,
  specialization VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Event-Labour Assignment Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS event_labours (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  labour_id INTEGER REFERENCES labours(id) ON DELETE CASCADE,
  UNIQUE(event_id, labour_id)
);

-- 5. Notifications Tracking Table
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

-- 6. User Devices Table (for OneSignal Player IDs)
CREATE TABLE IF NOT EXISTS user_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  onesignal_player_id VARCHAR(200) NOT NULL,
  device_type VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, onesignal_player_id)
);

-- =============================================
-- INDEXES for better query performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_labours_user_id ON labours(user_id);
CREATE INDEX IF NOT EXISTS idx_event_labours_event_id ON event_labours(event_id);
CREATE INDEX IF NOT EXISTS idx_event_labours_labour_id ON event_labours(labour_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);

-- =============================================
-- VERIFY: Check all tables were created
-- =============================================

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
