const express = require('express');
const pool = require('../config/db');
const router = express.Router();

/**
 * DEV ONLY API: Make a user superadmin by username
 * Useful for local setup and testing
 */
router.post('/make-superadmin', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const result = await pool.query(
      "UPDATE users SET role = 'superadmin', is_approved = true WHERE username = $1 RETURNING id, username, role",
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: `User ${username} is now a superadmin`,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Dev make-superadmin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DEV ONLY API: Approve a lead by ID
 * Converts a lead to an event without requiring authenticated session
 */
router.post('/approve-lead', async (req, res) => {
  try {
    const { leadId, userId } = req.body;
    if (!leadId) return res.status(400).json({ error: 'leadId is required' });

    // If userId not provided, pick the first superadmin or admin
    let finalUserId = userId;
    if (!finalUserId) {
      const userRes = await pool.query("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1");
      if (userRes.rows.length > 0) finalUserId = userRes.rows[0].id;
    }

    const result = await pool.query(
      "UPDATE events SET is_lead = false, status = 'upcoming', user_id = $1 WHERE id = $2 RETURNING id, client_name, status",
      [finalUserId, leadId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({
      message: 'Lead approved successfully via dev API',
      event: result.rows[0]
    });
  } catch (error) {
    console.error('Dev approve-lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DEV ONLY API: Verify/Approve a partner account
 * Sets is_approved = true for a user
 */
router.post('/verify-user', async (req, res) => {
  try {
    const { username, userId } = req.body;
    if (!username && !userId) {
      return res.status(400).json({ error: 'username or userId is required' });
    }

    const query = username 
      ? "UPDATE users SET is_approved = true WHERE username = $1 RETURNING id, username, is_approved"
      : "UPDATE users SET is_approved = true WHERE id = $1 RETURNING id, username, is_approved";
    
    const value = username ? username.toLowerCase() : userId;

    const result = await pool.query(query, [value]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: `Partner account ${result.rows[0].username} has been verified`,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Dev verify-user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
