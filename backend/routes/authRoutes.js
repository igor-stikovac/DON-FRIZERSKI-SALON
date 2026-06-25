const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const {
  register,
  login,
  getMe,
  updateMe
} = require('../controllers/authController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateMe);

module.exports = router;

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, first_name, last_name, phone, email, role
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Korisnik nije pronađen.' });
    }

    res.json({
      user: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Greška pri učitavanju korisnika.' });
  }
};