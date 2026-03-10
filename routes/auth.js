const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ==================== REGISTER ====================
router.post('/register', async (req, res) => {
  try {
    const { username, password, fullName, phone } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken. Choose another one.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    // First user is superadmin, others are admin and need approval
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const role = parseInt(userCount.rows[0].count) === 0 ? 'superadmin' : 'admin';
    const isApproved = role === 'superadmin'; // Superadmin is auto-approved

    const result = await pool.query(
      'INSERT INTO users (username, password, full_name, phone, role, is_approved) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, full_name, phone, role, is_approved, partner_uuid, theme_color, custom_domain, created_at',
      [username.toLowerCase(), hashedPassword, fullName || null, phone || null, role, isApproved]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const configRes = await pool.query("SELECT value FROM system_config WHERE key = 'frontend_url'");
    const frontendUrl = configRes.rows[0]?.value || 'http://localhost:8081';

    res.status(201).json({
      message: 'Account created successfully!',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        isApproved: user.is_approved,
        partnerUuid: user.partner_uuid,
        themeColor: user.theme_color,
        customDomain: user.custom_domain,
        frontendUrl,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const configRes = await pool.query("SELECT value FROM system_config WHERE key = 'frontend_url'");
    const frontendUrl = configRes.rows[0]?.value || 'http://localhost:8081';

    res.json({
      message: 'Login successful!',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        isApproved: user.is_approved,
        partnerUuid: user.partner_uuid,
        themeColor: user.theme_color,
        customDomain: user.custom_domain,
        frontendUrl,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ==================== GET PROFILE ====================
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, phone, role, is_approved, partner_uuid, theme_color, custom_domain, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const configRes = await pool.query("SELECT value FROM system_config WHERE key = 'frontend_url'");
    const frontendUrl = configRes.rows[0]?.value || 'http://localhost:8081';

    res.json({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      phone: user.phone,
      role: user.role,
      isApproved: user.is_approved,
      partnerUuid: user.partner_uuid,
      themeColor: user.theme_color,
      customDomain: user.custom_domain,
      frontendUrl,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GET ALL ADMINS (Super Admin only) ====================
router.get('/admins', authMiddleware, async (req, res) => {
  try {
    // Check if requester is superadmin
    const requester = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (requester.rows[0].role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can manage admins' });
    }

    const result = await pool.query(
      'SELECT id, username, full_name, phone, role, is_approved, theme_color, custom_domain, created_at FROM users WHERE role = $1 ORDER BY created_at DESC',
      ['admin']
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      phone: row.phone,
      role: row.role,
      isApproved: row.is_approved,
      themeColor: row.theme_color,
      customDomain: row.custom_domain,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== APPROVE ADMIN (Super Admin only) ====================
router.patch('/admins/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if requester is superadmin
    const requester = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (requester.rows[0].role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can approve admins' });
    }

    await pool.query(
      'UPDATE users SET is_approved = true WHERE id = $1 AND role = $2',
      [id, 'admin']
    );

    res.json({ message: 'Admin approved successfully' });
  } catch (error) {
    console.error('Approve admin error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== UPDATE PARTNER THEME (Super Admin only) ====================
router.patch('/admins/:id/theme', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { themeColor } = req.body;

    if (!themeColor) return res.status(400).json({ error: 'themeColor is required' });

    // Check if requester is superadmin
    const requester = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (requester.rows[0].role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can update partner settings' });
    }

    await pool.query(
      'UPDATE users SET theme_color = $1 WHERE id = $2 AND role = $3',
      [themeColor, id, 'admin']
    );

    res.json({ message: 'Partner theme updated successfully', themeColor });
  } catch (error) {
    console.error('Update partner theme error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== UPDATE PARTNER SETTINGS (Super Admin only) ====================
router.patch('/admins/:id/settings', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { themeColor, customDomain } = req.body;

    // Check if requester is superadmin
    const requester = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (requester.rows[0].role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can update partner settings' });
    }

    const updates = [];
    const values = [];
    let valIdx = 1;

    if (themeColor !== undefined) {
      updates.push(`theme_color = $${valIdx++}`);
      values.push(themeColor);
    }

    if (customDomain !== undefined) {
      updates.push(`custom_domain = $${valIdx++}`);
      values.push(customDomain);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No settings provided to update' });
    }

    values.push(id);
    values.push('admin');

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${valIdx++} AND role = $${valIdx++}`,
      values
    );

    res.json({ message: 'Partner settings updated successfully', themeColor, customDomain });
  } catch (error) {
    console.error('Update partner settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== UPDATE SYSTEM CONFIG (Super Admin only) ====================
router.patch('/system-config', authMiddleware, async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    // Check if requester is superadmin
    const requester = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (requester.rows[0].role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can update system settings' });
    }

    await pool.query(
      'INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ' +
      'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP',
      [key, value]
    );

    res.json({ message: `System setting '${key}' updated successfully`, key, value });
  } catch (error) {
    console.error('Update system config error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
