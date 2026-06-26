const pool = require('../config/db');

exports.getPublicSettings = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT setting_key, setting_value
      FROM site_settings
      `
    );

    const settings = {};

    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    res.json({ settings });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri učitavanju podešavanja sajta.'
    });
  }
};