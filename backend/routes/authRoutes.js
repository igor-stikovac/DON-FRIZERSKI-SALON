const express = require('express');
const router  = express.Router();

const {
  register,
  login,
  getMe,
  updateMe,
} = require('../controllers/authController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login',    login);
router.get('/me',        authMiddleware, getMe);
router.put('/me',        authMiddleware, updateMe);

module.exports = router;

// NAPOMENA: exports.getMe koji je ranije bio ovde (ispod module.exports)
// bio je mrtav kod i nikad se nije izvršavao — obrisan.
