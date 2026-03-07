const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ==================== GET ALL LABOURS ====================
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM labours WHERE user_id = $1 ORDER BY name ASC',
      [req.userId]
    );

    const labours = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      wage: parseFloat(row.wage) || 0,
      specialization: row.specialization,
      createdAt: row.created_at,
    }));

    res.json(labours);
  } catch (error) {
    console.error('Get labours error:', error);
    res.status(500).json({ error: 'Failed to fetch labours' });
  }
});

// ==================== CREATE LABOUR ====================
router.post('/', async (req, res) => {
  try {
    const { name, phone, wage, specialization } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(
      `INSERT INTO labours (user_id, name, phone, wage, specialization)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, name, phone || null, wage || 0, specialization || null]
    );

    const labour = result.rows[0];

    res.status(201).json({
      message: 'Labour added successfully!',
      labour: {
        id: labour.id,
        name: labour.name,
        phone: labour.phone,
        wage: parseFloat(labour.wage) || 0,
        specialization: labour.specialization,
        createdAt: labour.created_at,
      },
    });
  } catch (error) {
    console.error('Create labour error:', error);
    res.status(500).json({ error: 'Failed to add labour' });
  }
});

// ==================== UPDATE LABOUR ====================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, wage, specialization } = req.body;

    const result = await pool.query(
      `UPDATE labours SET
        name = COALESCE($1, name),
        phone = $2,
        wage = COALESCE($3, wage),
        specialization = $4
      WHERE id = $5 AND user_id = $6
      RETURNING *`,
      [name, phone, wage, specialization, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Labour not found' });
    }

    const labour = result.rows[0];

    res.json({
      message: 'Labour updated successfully!',
      labour: {
        id: labour.id,
        name: labour.name,
        phone: labour.phone,
        wage: parseFloat(labour.wage) || 0,
        specialization: labour.specialization,
        createdAt: labour.created_at,
      },
    });
  } catch (error) {
    console.error('Update labour error:', error);
    res.status(500).json({ error: 'Failed to update labour' });
  }
});

// ==================== DELETE LABOUR ====================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM labours WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Labour not found' });
    }

    res.json({ message: 'Labour deleted successfully' });
  } catch (error) {
    console.error('Delete labour error:', error);
    res.status(500).json({ error: 'Failed to delete labour' });
  }
});

module.exports = router;
