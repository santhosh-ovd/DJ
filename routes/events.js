const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { schedulePushNotification, cancelNotification } = require('../services/onesignal');

const router = express.Router();

// ==================== PUBLIC: BOOK EVENT (LEAD) ====================
router.post('/public/book', async (req, res) => {
  try {
    const {
      eventType, clientName, clientPhone, venue, address,
      date, startTime, endTime, notes, partnerUuid
    } = req.body;

    if (!clientName || !date) {
      return res.status(400).json({ error: 'Client name and date are required' });
    }

    // Lookup user_id from partnerUuid
    let finalUserId = null;
    if (partnerUuid) {
      const userResult = await pool.query('SELECT id FROM users WHERE partner_uuid = $1', [partnerUuid]);
      if (userResult.rows.length > 0) {
        finalUserId = userResult.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO events (
        user_id, event_type, client_name, client_phone, venue, address,
        event_date, start_time, end_time, status, is_lead, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        finalUserId,
        eventType || 'other', clientName, clientPhone || null,
        venue || null, address || null, date,
        startTime || null, endTime || null,
        'pending', true, notes || null,
      ]
    );

    res.status(201).json({
      message: 'Booking request sent successfully! An admin will contact you soon.',
      leadId: result.rows[0].id,
    });
  } catch (error) {
    console.error('Public book error:', error);
    res.status(500).json({ error: 'Failed to submit booking request' });
  }
});

// All other routes require authentication
router.use(authMiddleware);

// ==================== ADMIN: GET ALL LEADS ====================
router.get('/leads', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*,
        COALESCE(
          json_agg(
            json_build_object('id', el.labour_id)
          ) FILTER (WHERE el.labour_id IS NOT NULL),
          '[]'
        ) as assigned_labourers
      FROM events e
      LEFT JOIN event_labours el ON e.id = el.event_id
      WHERE e.is_lead = true AND (e.user_id = $1 OR $2 = 'superadmin')
      GROUP BY e.id
      ORDER BY e.created_at DESC`,
      [req.userId, req.userRole]
    );

    const leads = result.rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      clientName: row.client_name,
      clientPhone: row.client_phone,
      venue: row.venue,
      address: row.address,
      date: row.event_date?.toISOString().split('T')[0],
      startTime: row.start_time?.substring(0, 5),
      endTime: row.end_time?.substring(0, 5),
      totalAmount: parseFloat(row.total_amount) || 0,
      advanceAmount: parseFloat(row.advance_amount) || 0,
      shippingCharge: parseFloat(row.shipping_charge) || 0,
      labourCharge: parseFloat(row.labour_charge) || 0,
      assignedLabourers: row.assigned_labourers.map(l => l.id),
      status: row.status,
      isLead: row.is_lead,
      notes: row.notes,
      createdAt: row.created_at,
    }));

    res.json(leads);
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// ==================== ADMIN: APPROVE/REJECT LEAD ====================
router.patch('/leads/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE events SET is_lead = false, status = 'upcoming', user_id = $1 WHERE id = $2",
      [req.userId, id]
    );
    res.json({ message: 'Lead converted to event successfully!' });
  } catch (error) {
    console.error('Approve lead error:', error);
    res.status(500).json({ error: 'Failed to approve lead' });
  }
});

router.patch('/leads/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await pool.query(
      "UPDATE events SET status = 'rejected', rejection_reason = $1 WHERE id = $2",
      [reason, id]
    );
    res.json({ message: 'Lead rejected' });
  } catch (error) {
    console.error('Reject lead error:', error);
    res.status(500).json({ error: 'Failed to reject lead' });
  }
});

// ==================== GET ALL EVENTS ====================
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*,
        COALESCE(
          json_agg(
            json_build_object('id', el.labour_id)
          ) FILTER (WHERE el.labour_id IS NOT NULL),
          '[]'
        ) as assigned_labourers
      FROM events e
      LEFT JOIN event_labours el ON e.id = el.event_id
      WHERE e.is_lead = false AND (e.user_id = $1 OR $2 = 'superadmin')
      GROUP BY e.id
      ORDER BY e.event_date DESC`,
      [req.userId, req.userRole]
    );

    const events = result.rows.map(row => ({
      id: row.id,
      eventType: row.event_type,
      clientName: row.client_name,
      clientPhone: row.client_phone,
      venue: row.venue,
      address: row.address,
      date: row.event_date?.toISOString().split('T')[0],
      startTime: row.start_time?.substring(0, 5),
      endTime: row.end_time?.substring(0, 5),
      totalAmount: parseFloat(row.total_amount) || 0,
      advanceAmount: parseFloat(row.advance_amount) || 0,
      shippingCharge: parseFloat(row.shipping_charge) || 0,
      labourCharge: parseFloat(row.labour_charge) || 0,
      assignedLabourers: row.assigned_labourers.map(l => l.id),
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
    }));

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ==================== GET SINGLE EVENT ====================
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*,
        COALESCE(
          json_agg(
            json_build_object('id', el.labour_id)
          ) FILTER (WHERE el.labour_id IS NOT NULL),
          '[]'
        ) as assigned_labourers
      FROM events e
      LEFT JOIN event_labours el ON e.id = el.event_id
      WHERE e.id = $1 AND (e.user_id = $2 OR $3 = 'superadmin')
      GROUP BY e.id`,
      [req.params.id, req.userId, req.userRole]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      eventType: row.event_type,
      clientName: row.client_name,
      clientPhone: row.client_phone,
      venue: row.venue,
      address: row.address,
      date: row.event_date?.toISOString().split('T')[0],
      startTime: row.start_time?.substring(0, 5),
      endTime: row.end_time?.substring(0, 5),
      totalAmount: parseFloat(row.total_amount) || 0,
      advanceAmount: parseFloat(row.advance_amount) || 0,
      shippingCharge: parseFloat(row.shipping_charge) || 0,
      labourCharge: parseFloat(row.labour_charge) || 0,
      assignedLabourers: row.assigned_labourers.map(l => l.id),
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// ==================== CREATE EVENT ====================
router.post('/', async (req, res) => {
  try {
    const {
      eventType, clientName, clientPhone, venue, address,
      date, startTime, endTime, totalAmount, advanceAmount,
      shippingCharge, labourCharge, assignedLabourers, status, notes,
    } = req.body;

    if (!clientName || !date) {
      return res.status(400).json({ error: 'Client name and date are required' });
    }

    const result = await pool.query(
      `INSERT INTO events (
        user_id, event_type, client_name, client_phone, venue, address,
        event_date, start_time, end_time, total_amount, advance_amount,
        shipping_charge, labour_charge, status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        req.userId, eventType || 'other', clientName, clientPhone || null,
        venue || null, address || null, date,
        startTime || null, endTime || null,
        totalAmount || 0, advanceAmount || 0,
        shippingCharge || 0, labourCharge || 0,
        status || 'upcoming', notes || null,
      ]
    );

    const event = result.rows[0];

    // Assign labourers
    if (assignedLabourers && assignedLabourers.length > 0) {
      const labourValues = assignedLabourers
        .map((labourId) => `(${event.id}, ${labourId})`)
        .join(',');
      await pool.query(
        `INSERT INTO event_labours (event_id, labour_id) VALUES ${labourValues} ON CONFLICT DO NOTHING`
      );
    }

    // Schedule OneSignal push notifications
    await scheduleEventNotifications(req.userId, event);

    res.status(201).json({
      message: 'Event created successfully!',
      event: {
        id: event.id,
        eventType: event.event_type,
        clientName: event.client_name,
        clientPhone: event.client_phone,
        venue: event.venue,
        address: event.address,
        date: event.event_date?.toISOString().split('T')[0],
        startTime: event.start_time?.substring(0, 5),
        endTime: event.end_time?.substring(0, 5),
        totalAmount: parseFloat(event.total_amount) || 0,
        advanceAmount: parseFloat(event.advance_amount) || 0,
        shippingCharge: parseFloat(event.shipping_charge) || 0,
        labourCharge: parseFloat(event.labour_charge) || 0,
        assignedLabourers: assignedLabourers || [],
        status: event.status,
        notes: event.notes,
        createdAt: event.created_at,
      },
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// ==================== UPDATE EVENT ====================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      eventType, clientName, clientPhone, venue, address,
      date, startTime, endTime, totalAmount, advanceAmount,
      shippingCharge, labourCharge, assignedLabourers, status, notes,
    } = req.body;

    // Verify ownership
    const existing = await pool.query(
      'SELECT id FROM events WHERE id = $1 AND (user_id = $2 OR $3 = $4)', 
      [id, req.userId, req.userRole, 'superadmin']
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const result = await pool.query(
      `UPDATE events SET
        event_type = COALESCE($1, event_type),
        client_name = COALESCE($2, client_name),
        client_phone = $3,
        venue = $4,
        address = $5,
        event_date = COALESCE($6, event_date),
        start_time = $7,
        end_time = $8,
        total_amount = COALESCE($9, total_amount),
        advance_amount = COALESCE($10, advance_amount),
        shipping_charge = COALESCE($11, shipping_charge),
        labour_charge = COALESCE($12, labour_charge),
        status = COALESCE($13, status),
        notes = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15 AND (user_id = $16 OR $17 = $18)
      RETURNING *`,
      [
        eventType, 
        clientName, 
        clientPhone || null, 
        venue || null, 
        address || null,
        date, 
        startTime || null, 
        endTime || null, 
        totalAmount, 
        advanceAmount,
        shippingCharge, 
        labourCharge, 
        status, 
        notes || null, 
        id, 
        req.userId, 
        req.userRole, 
        'superadmin'
      ]
    );

    const event = result.rows[0];

    // Update labour assignments
    if (assignedLabourers) {
      await pool.query('DELETE FROM event_labours WHERE event_id = $1', [id]);
      if (assignedLabourers.length > 0) {
        const labourValues = assignedLabourers
          .map((labourId) => `(${id}, ${labourId})`)
          .join(',');
        await pool.query(
          `INSERT INTO event_labours (event_id, labour_id) VALUES ${labourValues} ON CONFLICT DO NOTHING`
        );
      }
    }

    // Reschedule notifications
    await cancelEventNotifications(id);
    await scheduleEventNotifications(req.userId, event);

    res.json({
      message: 'Event updated successfully!',
      event: {
        id: event.id,
        eventType: event.event_type,
        clientName: event.client_name,
        clientPhone: event.client_phone,
        venue: event.venue,
        address: event.address,
        date: event.event_date?.toISOString().split('T')[0],
        startTime: event.start_time?.substring(0, 5),
        endTime: event.end_time?.substring(0, 5),
        totalAmount: parseFloat(event.total_amount) || 0,
        advanceAmount: parseFloat(event.advance_amount) || 0,
        shippingCharge: parseFloat(event.shipping_charge) || 0,
        labourCharge: parseFloat(event.labour_charge) || 0,
        assignedLabourers: assignedLabourers || [],
        status: event.status,
        notes: event.notes,
        createdAt: event.created_at,
      },
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.patch('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] Mark as Completed - EventID: ${id}, UserID: ${req.userId}, Role: ${req.userRole}`);
    
    // Fetch the event to check ownership
    const eventResult = await pool.query('SELECT user_id FROM events WHERE id = $1', [id]);
    
    if (eventResult.rows.length === 0) {
      console.log(`[DEBUG] Event ${id} not found`);
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];
    
    // Permission check: owner or superadmin
    if (event.user_id !== req.userId && req.userRole !== 'superadmin') {
      console.log(`[DEBUG] Permission Denied: Event owner is ${event.user_id}, requester is ${req.userId}`);
      return res.status(403).json({ error: 'You do not have permission to complete this event' });
    }

    await pool.query(
      "UPDATE events SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    console.log(`[DEBUG] Event ${id} successfully marked as completed`);
    res.json({ message: 'Event marked as completed successfully!' });
  } catch (error) {
    console.error('[DEBUG] Complete event error ERROR:', error);
    res.status(500).json({ error: 'Failed to mark event as completed', details: error.message });
  }
});

// ==================== DELETE EVENT ====================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await cancelEventNotifications(id);

    const result = await pool.query(
      'DELETE FROM events WHERE id = $1 AND (user_id = $2 OR $3 = $4) RETURNING id',
      [id, req.userId, req.userRole, 'superadmin']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ==================== HELPER: Schedule OneSignal Notifications ====================
async function scheduleEventNotifications(userId, event) {
  try {
    // Get user devices
    const devices = await pool.query(
      'SELECT onesignal_player_id FROM user_devices WHERE user_id = $1',
      [userId]
    );

    if (devices.rows.length === 0) return;

    const playerIds = devices.rows.map(d => d.onesignal_player_id);
    const eventDate = new Date(event.event_date);
    const startTime = event.start_time || '10:00:00';
    const [hours, minutes] = startTime.split(':');
    eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const now = new Date();
    const eventTypeName = (event.event_type || 'event').replace('_', ' ').toUpperCase();

    // 1 day before
    const oneDayBefore = new Date(eventDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    if (oneDayBefore > now) {
      const result1d = await schedulePushNotification({
        playerIds,
        title: '🎵 DJ Event Tomorrow!',
        message: `${eventTypeName} at ${event.venue || 'TBD'}\nClient: ${event.client_name}\nTime: ${startTime.substring(0, 5)}`,
        data: { eventId: event.id, type: '1_day' },
        sendAfter: oneDayBefore.toISOString(),
      });

      if (result1d?.id) {
        await pool.query(
          `INSERT INTO notifications (user_id, event_id, type, scheduled_for, onesignal_id)
           VALUES ($1, $2, '1_day', $3, $4)`,
          [userId, event.id, oneDayBefore, result1d.id]
        );
      }
    }

    // 1 hour before
    const oneHourBefore = new Date(eventDate);
    oneHourBefore.setHours(oneHourBefore.getHours() - 1);
    if (oneHourBefore > now) {
      const result1h = await schedulePushNotification({
        playerIds,
        title: '🎶 DJ Event in 1 Hour!',
        message: `${eventTypeName} at ${event.venue || 'TBD'}\nClient: ${event.client_name}\nGet ready!`,
        data: { eventId: event.id, type: '1_hour' },
        sendAfter: oneHourBefore.toISOString(),
      });

      if (result1h?.id) {
        await pool.query(
          `INSERT INTO notifications (user_id, event_id, type, scheduled_for, onesignal_id)
           VALUES ($1, $2, '1_hour', $3, $4)`,
          [userId, event.id, oneHourBefore, result1h.id]
        );
      }
    }
  } catch (error) {
    console.error('Schedule notifications error:', error.message);
  }
}

// ==================== HELPER: Cancel OneSignal Notifications ====================
async function cancelEventNotifications(eventId) {
  try {
    const result = await pool.query(
      "SELECT onesignal_id FROM notifications WHERE event_id = $1 AND status = 'pending'",
      [eventId]
    );

    for (const row of result.rows) {
      if (row.onesignal_id) {
        await cancelNotification(row.onesignal_id);
      }
    }

    await pool.query(
      "UPDATE notifications SET status = 'cancelled' WHERE event_id = $1 AND status = 'pending'",
      [eventId]
    );
  } catch (error) {
    console.error('Cancel notifications error:', error.message);
  }
}

module.exports = router;
