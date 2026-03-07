const axios = require('axios');
require('dotenv').config();

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1';

/**
 * Send push notification to specific player IDs
 */
async function sendPushNotification({ playerIds, title, message, data = {} }) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.log('⚠️ OneSignal not configured. Skipping push notification.');
    return null;
  }

  if (!playerIds || playerIds.length === 0) {
    console.log('⚠️ No player IDs to send notification to.');
    return null;
  }

  try {
    const response = await axios.post(
      `${ONESIGNAL_API_URL}/notifications`,
      {
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: message },
        data: data,
        ios_badgeType: 'Increase',
        ios_badgeCount: 1,
        android_channel_id: undefined,
        small_icon: 'ic_notification',
        android_accent_color: '6C63FF',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    console.log('✅ Push notification sent:', response.data.id);
    return response.data;
  } catch (error) {
    console.error('❌ Push notification failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Schedule a push notification for a future time
 */
async function schedulePushNotification({ playerIds, title, message, data = {}, sendAfter }) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.log('⚠️ OneSignal not configured. Skipping scheduled notification.');
    return null;
  }

  if (!playerIds || playerIds.length === 0) {
    console.log('⚠️ No player IDs to schedule notification for.');
    return null;
  }

  try {
    const response = await axios.post(
      `${ONESIGNAL_API_URL}/notifications`,
      {
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: message },
        data: data,
        send_after: sendAfter, // ISO 8601 format
        ios_badgeType: 'Increase',
        ios_badgeCount: 1,
        small_icon: 'ic_notification',
        android_accent_color: '6C63FF',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    console.log('✅ Scheduled notification:', response.data.id, 'for', sendAfter);
    return response.data;
  } catch (error) {
    console.error('❌ Scheduled notification failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Cancel a scheduled notification
 */
async function cancelNotification(notificationId) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY || !notificationId) return null;

  try {
    const response = await axios.delete(
      `${ONESIGNAL_API_URL}/notifications/${notificationId}?app_id=${ONESIGNAL_APP_ID}`,
      {
        headers: {
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
      }
    );
    console.log('✅ Notification cancelled:', notificationId);
    return response.data;
  } catch (error) {
    console.error('❌ Cancel notification failed:', error.response?.data || error.message);
    return null;
  }
}

module.exports = {
  sendPushNotification,
  schedulePushNotification,
  cancelNotification,
};
