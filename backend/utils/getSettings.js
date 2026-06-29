/**
 * Učitava site_settings iz baze i vraća ih kao objekat.
 * Ako tabela nije dostupna ili setting ne postoji,
 * koriste se fallback vrednosti.
 */
const pool = require('../config/db');

const DEFAULTS = {
  work_start:                   '10:00',
  work_end_weekday:             '20:00',
  work_end_saturday:            '15:00',
  cancellation_fee_same_day:    '100',
  cancellation_fee_one_day:     '80',
};

async function getSettings() {
  try {
    const result = await pool.query(
      'SELECT setting_key, setting_value FROM site_settings'
    );

    const settings = { ...DEFAULTS };

    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    return settings;
  } catch {
    // Ako tabela nije postavljena, vrati default vrednosti
    return { ...DEFAULTS };
  }
}

module.exports = getSettings;
