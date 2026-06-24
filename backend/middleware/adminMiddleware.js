const pool = require('../config/db');

module.exports = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Korisnik nije pronađen.' });
    }

    if (result.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Nemate admin pristup.' });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Greška pri proveri admin pristupa.' });
  }
};