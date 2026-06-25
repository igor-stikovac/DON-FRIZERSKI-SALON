const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const {
  getAppointmentsByDate,
  cancelAppointmentByAdmin,
  createManualAppointment,
  updateAppointmentByAdmin,
  createBlockedSlot,
  deleteBlockedSlot,
  getAdminServices,
  createServiceByAdmin,
  updateServiceByAdmin,
  deleteServiceByAdmin,
  getAdminStats
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

router.post(
  '/blocks',
  authMiddleware,
  adminMiddleware,
  createBlockedSlot
);

router.delete(
  '/blocks/:id',
  authMiddleware,
  adminMiddleware,
  deleteBlockedSlot
);

router.put(
  '/appointments/:id',
  authMiddleware,
  adminMiddleware,
  updateAppointmentByAdmin
);

router.get(
  '/services',
  authMiddleware,
  adminMiddleware,
  getAdminServices
);

router.post(
  '/services',
  authMiddleware,
  adminMiddleware,
  createServiceByAdmin
);

router.put(
  '/services/:id',
  authMiddleware,
  adminMiddleware,
  updateServiceByAdmin
);

router.delete(
  '/services/:id',
  authMiddleware,
  adminMiddleware,
  deleteServiceByAdmin
);

router.get(
  '/stats',
  authMiddleware,
  adminMiddleware,
  getAdminStats
);

module.exports = router;