const express = require('express');
const router = express.Router();

const {
  getAvailableSlots,
  createAppointment,
  getMyAppointments,
  cancelAppointment
} = require('../controllers/appointmentController');

const authMiddleware = require('../middleware/authMiddleware');

router.get('/available', getAvailableSlots);
router.post('/', authMiddleware, createAppointment);
router.get('/my', authMiddleware, getMyAppointments);
router.patch('/:id/cancel', authMiddleware, cancelAppointment);

module.exports = router;