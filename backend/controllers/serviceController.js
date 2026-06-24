const pool = require('../config/db');

exports.getServices = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, duration_minutes, price FROM services ORDER BY id'
    );

    res.json({ services: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Greška pri učitavanju usluga.' });
  }
};