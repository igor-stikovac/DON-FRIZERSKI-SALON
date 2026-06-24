const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const {
  getAppointmentsByDate,
  cancelAppointmentByAdmin,
  createManualAppointment
} = require('../controllers/adminController');

router.get(
  '/appointments',
  authMiddleware,
  adminMiddleware,
  getAppointmentsByDate
);

router.post(
  '/appointments/manual',
  authMiddleware,
  adminMiddleware,
  createManualAppointment
);

router.patch(
  '/appointments/:id/cancel',
  authMiddleware,
  adminMiddleware,
  cancelAppointmentByAdmin
);

module.exports = router;