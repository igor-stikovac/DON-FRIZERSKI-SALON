/**
 * Reminder Job — šalje podsetnik emailove mušterijama.
 *
 * Pokreće se svaki dan u 08:00 i proverava termine koji su:
 *   - za 2 dana (reminder_2_days_sent = false)
 *   - za 1 dan  (reminder_1_day_sent  = false)
 *   - danas     (reminder_same_day_sent = false)
 *
 * Fajl se require()-uje u server.js i cron se registruje automatski.
 */

const cron = require('node-cron');
const pool = require('../config/db');
const { sendAppointmentReminder } = require('../utils/notifications');

async function sendReminders() {
  console.log('[reminderJob] Pokrenuta provera podsetnika...', new Date().toISOString());

  try {
    // ── Termini za 2 dana ──────────────────────────────────
    const twoDays = await pool.query(
      `SELECT
          a.id,
          TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
          a.start_time, a.end_time,
          s.name AS service_name,
          u.first_name, u.email, u.phone,
          a.manual_customer_name, a.manual_customer_email, a.manual_customer_phone
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.status = 'booked'
         AND a.appointment_date = CURRENT_DATE + INTERVAL '2 days'
         AND a.reminder_2_days_sent = false`
    );

    for (const row of twoDays.rows) {
      const email     = row.email || row.manual_customer_email;
      const phone     = row.phone || row.manual_customer_phone;
      const firstName = row.first_name || row.manual_customer_name || '';

      if (email || phone) {
        try {
          await sendAppointmentReminder({
            to:          email,
            phone,
            firstName,
            serviceName: row.service_name,
            date:        row.appointment_date,
            startTime:   row.start_time.slice(0, 5),
            endTime:     row.end_time.slice(0, 5),
            daysLeft:    2,
          });
          console.log(`[reminderJob] 2-day reminder poslat: ${email}`);
        } catch (e) {
          console.error(`[reminderJob] Greška za ${email}:`, e.message);
        }
      }

      await pool.query(
        `UPDATE appointments SET reminder_2_days_sent = true WHERE id = $1`,
        [row.id]
      );
    }

    // ── Termini za 1 dan ───────────────────────────────────
    const oneDay = await pool.query(
      `SELECT
          a.id,
          TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
          a.start_time, a.end_time,
          s.name AS service_name,
          u.first_name, u.email, u.phone,
          a.manual_customer_name, a.manual_customer_email, a.manual_customer_phone
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.status = 'booked'
         AND a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
         AND a.reminder_1_day_sent = false`
    );

    for (const row of oneDay.rows) {
      const email     = row.email || row.manual_customer_email;
      const phone     = row.phone || row.manual_customer_phone;
      const firstName = row.first_name || row.manual_customer_name || '';

      if (email || phone) {
        try {
          await sendAppointmentReminder({
            to:          email,
            phone,
            firstName,
            serviceName: row.service_name,
            date:        row.appointment_date,
            startTime:   row.start_time.slice(0, 5),
            endTime:     row.end_time.slice(0, 5),
            daysLeft:    1,
          });
          console.log(`[reminderJob] 1-day reminder poslat: ${email}`);
        } catch (e) {
          console.error(`[reminderJob] Greška za ${email}:`, e.message);
        }
      }

      await pool.query(
        `UPDATE appointments SET reminder_1_day_sent = true WHERE id = $1`,
        [row.id]
      );
    }

    // ── Termini danas ──────────────────────────────────────
    const sameDay = await pool.query(
      `SELECT
          a.id,
          TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
          a.start_time, a.end_time,
          s.name AS service_name,
          u.first_name, u.email, u.phone,
          a.manual_customer_name, a.manual_customer_email, a.manual_customer_phone
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.status = 'booked'
         AND a.appointment_date = CURRENT_DATE
         AND a.reminder_same_day_sent = false`
    );

    for (const row of sameDay.rows) {
      const email     = row.email || row.manual_customer_email;
      const phone     = row.phone || row.manual_customer_phone;
      const firstName = row.first_name || row.manual_customer_name || '';

      if (email || phone) {
        try {
          await sendAppointmentReminder({
            to:          email,
            phone,
            firstName,
            serviceName: row.service_name,
            date:        row.appointment_date,
            startTime:   row.start_time.slice(0, 5),
            endTime:     row.end_time.slice(0, 5),
            daysLeft:    0,
          });
          console.log(`[reminderJob] Same-day reminder poslat: ${email}`);
        } catch (e) {
          console.error(`[reminderJob] Greška za ${email}:`, e.message);
        }
      }

      await pool.query(
        `UPDATE appointments SET reminder_same_day_sent = true WHERE id = $1`,
        [row.id]
      );
    }

    const total = twoDays.rows.length + oneDay.rows.length + sameDay.rows.length;
    console.log(`[reminderJob] Završeno. Obrađeno ${total} termina.`);

  } catch (error) {
    console.error('[reminderJob] Kritična greška:', error.message);
  }
}

// Svaki dan u 08:00
cron.schedule('0 8 * * *', sendReminders, {
  timezone: 'Europe/Belgrade',
});

console.log('[reminderJob] Scheduler registrovan — pokretanje svaki dan u 08:00 (Belgrade)');
