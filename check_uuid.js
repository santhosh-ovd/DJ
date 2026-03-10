const pool = require('./config/db');

async function checkUsers() {
  try {
    const result = await pool.query('SELECT username, id, partner_uuid FROM users');
    console.table(result.rows);
    
    // Check if any are null and update them
    const nulls = result.rows.filter(u => !u.partner_uuid);
    if (nulls.length > 0) {
      console.log(`Updating ${nulls.length} users with missing UUIDs...`);
      for (const user of nulls) {
        // Use a standard UUID generator if gen_random_uuid() isn't working at default time
        try {
           await pool.query('UPDATE users SET partner_uuid = gen_random_uuid() WHERE id = $1', [user.id]);
        } catch (e) {
           console.error("gen_random_uuid() failed, you might need to run: CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";");
           throw e;
        }
      }
      console.log('Done.');
    }
  } catch (error) {
    console.error('Check failed:', error.message);
  } finally {
    process.exit();
  }
}

checkUsers();
