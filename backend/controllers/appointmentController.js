const pool = require('../config/db');
const WORK_START = '10:00';
const {
  sendAppointmentConfirmation,
  sendAdminAppointmentNotification,
  sendAdminCancellationNotification,
  sendCustomerCancellationNotification
} = require('../utils/email');

function getWorkEndByDate(date) {
  const day = new Date(`${date}T00:00:00`).getDay();

  // 0 = nedelja, 6 = subota
  if (day === 0) return null;
  if (day === 6) return '15:00';

  return '20:00';
}

const DEFAULT_STEP_MINUTES = 30;
const BUFFER_MINUTES = 5;

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getTodayString() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getCurrentMinutes() {
  const now = new Date();

  return now.getHours() * 60 + now.getMinutes();
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

exports.getAvailableSlots = async (req, res) => {
  try {
    const { date, serviceId } = req.query;

    if (!date || !serviceId) {
      return res.status(400).json({
        message: 'Datum i usluga su obavezni.'
      });
    }

    const todayString = getTodayString();

    if (date < todayString) {
      return res.json({
        availableSlots: []
      });
    }


    const serviceResult = await pool.query(
      `SELECT duration_minutes
       FROM services
       WHERE id = $1
       AND is_active = true`,
      [serviceId]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Usluga nije pronađena.'
      });
    }

    const workEnd = getWorkEndByDate(date);

    if (!workEnd) {
      return res.json({
        availableSlots: []
      });
    }

    const duration = Number(serviceResult.rows[0].duration_minutes);

    const appointmentsResult = await pool.query(
      `
      SELECT start_time, end_time
      FROM appointments
      WHERE appointment_date = $1
      AND status = 'booked'
      `,
      [date]
    );

    const blocksResult = await pool.query(
      `
      SELECT start_time, end_time
      FROM blocked_slots
      WHERE block_date = $1
      `,
      [date]
    );

    const unavailable = [
      ...appointmentsResult.rows.map(row => ({
        start: timeToMinutes(row.start_time.slice(0, 5)),
        end: timeToMinutes(row.end_time.slice(0, 5))
      })),

      ...blocksResult.rows.map(row => ({
        start: timeToMinutes(row.start_time.slice(0, 5)),
        end: timeToMinutes(row.end_time.slice(0, 5))
      }))
    ];

    const startDay = timeToMinutes(WORK_START);
    const endDay = timeToMinutes(workEnd);

    const currentMinutes = getCurrentMinutes();

    const minStart =
      date === todayString
        ? Math.max(startDay, currentMinutes + BUFFER_MINUTES)
        : startDay;

    const candidateStarts = new Set();

    for (
      let start = startDay;
      start + duration <= endDay;
      start += DEFAULT_STEP_MINUTES
    ) {
      if (start >= minStart) {
        candidateStarts.add(start);
      }
    }

    unavailable.forEach(slot => {
      const candidate = slot.end + BUFFER_MINUTES;

      if (candidate >= minStart && candidate + duration <= endDay) {
        candidateStarts.add(candidate);
      }
    });

    const availableSlots = [];

    [...candidateStarts]
      .sort((a, b) => a - b)
      .forEach(start => {
        const end = start + duration;

        const isUnavailable = unavailable.some(slot => {
          return overlaps(
            start,
            end,
            slot.start - BUFFER_MINUTES,
            slot.end + BUFFER_MINUTES
          );
        });

        if (!isUnavailable) {
          availableSlots.push({
            start: minutesToTime(start),
            end: minutesToTime(end)
          });
        }
      });

    res.json({
      availableSlots
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri učitavanju slobodnih termina.'
    });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { serviceId, date, time } = req.body;

    if (!serviceId || !date || !time) {
      return res.status(400).json({
        message: 'Usluga, datum i vreme su obavezni.'
      });
    }

    const serviceResult = await pool.query(
      `SELECT id, name, duration_minutes, price
       FROM services
       WHERE id = $1
       AND is_active = true`,
      [serviceId]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Usluga nije pronađena.'
      });
    }

    const service = serviceResult.rows[0];
    const duration = Number(service.duration_minutes);

    const workEnd = getWorkEndByDate(date);

    if (!workEnd) {
      return res.status(400).json({
        message: 'Salon ne radi nedeljom.'
      });
    }

    const startMinutes = timeToMinutes(time);
    const endMinutes = startMinutes + duration;

    const todayString = getTodayString();

    if (date < todayString) {
      return res.status(400).json({
        message: 'Ne možete zakazati termin u prošlosti.'
      });
    }

    if (date === todayString && startMinutes < getCurrentMinutes() + BUFFER_MINUTES) {
      return res.status(400).json({
        message: 'Ne možete zakazati termin koji je već prošao.'
      });
    }

    const startDay = timeToMinutes(WORK_START);
    const endDay = timeToMinutes(workEnd);

    if (startMinutes < startDay || endMinutes > endDay) {
      return res.status(400).json({
        message: 'Izabrani termin nije u okviru radnog vremena.'
      });
    }

    const bookedResult = await pool.query(
      `SELECT start_time, end_time
       FROM appointments
       WHERE appointment_date = $1
       AND status = 'booked'`,
      [date]
    );

    const blocksResult = await pool.query(
      `SELECT start_time, end_time
       FROM blocked_slots
       WHERE block_date = $1`,
      [date]
    );

    const unavailable = [
      ...bookedResult.rows.map(row => ({
        start: timeToMinutes(row.start_time.slice(0, 5)),
        end: timeToMinutes(row.end_time.slice(0, 5))
      })),
      ...blocksResult.rows.map(row => ({
        start: timeToMinutes(row.start_time.slice(0, 5)),
        end: timeToMinutes(row.end_time.slice(0, 5))
      }))
    ];

    const hasOverlap = unavailable.some(slot => {
      return overlaps(
        startMinutes,
        endMinutes,
        slot.start - BUFFER_MINUTES,
        slot.end + BUFFER_MINUTES
      );
    });

    if (hasOverlap) {
      return res.status(409).json({
        message: 'Termin više nije slobodan.'
      });
    }

    const result = await pool.query(
      `INSERT INTO appointments 
       (user_id, service_id, appointment_date, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
        serviceId,
        date,
        minutesToTime(startMinutes),
        minutesToTime(endMinutes)
      ]
    );

    try {
      const userResult = await pool.query(
        `SELECT first_name, last_name, phone, email
         FROM users
         WHERE id = $1`,
        [userId]
      );

      const user = userResult.rows[0];

      const customerName = user
        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
        : 'Nepoznata mušterija';

      if (user && user.email) {
        await sendAppointmentConfirmation({
          to: user.email,
          firstName: user.first_name,
          serviceName: service.name,
          date,
          startTime: minutesToTime(startMinutes),
          endTime: minutesToTime(endMinutes),
          price: service.price
        });
      }

      await sendAdminAppointmentNotification({
        customerName,
        customerEmail: user?.email || '-',
        customerPhone: user?.phone || '-',
        serviceName: service.name,
        date,
        startTime: minutesToTime(startMinutes),
        endTime: minutesToTime(endMinutes),
        price: service.price
      });

    } catch (emailError) {
      console.error(
        'Termin je zakazan, ali jedan od emailova nije poslat:',
        emailError.message
      );
    }

    res.status(201).json({
      message: 'Uspešno ste zakazali termin.',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri zakazivanju termina.'
    });
  }
};

exports.getMyAppointments = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
          a.id,
          TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
          a.start_time,
          a.end_time,
          a.status,
          a.cancellation_fee,
          s.name AS service_name,
          s.price
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.user_id = $1
       ORDER BY a.appointment_date, a.start_time`,
      [userId]
    );

    res.json({ appointments: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Greška pri učitavanju termina.' });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const appointmentResult = await pool.query(
      `
      SELECT 
        a.id,
        TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
        a.start_time,
        a.end_time,
        a.status,
        s.name AS service_name,
        s.price,
        u.first_name,
        u.last_name,
        u.email,
        u.phone
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      JOIN users u ON u.id = a.user_id
      WHERE a.id = $1
      AND a.user_id = $2
      `,
      [id, userId]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Termin nije pronađen.'
      });
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.status !== 'booked') {
      return res.status(400).json({
        message: 'Termin je već otkazan.'
      });
    }

    const today = new Date();
    const appointmentDate = new Date(`${appointment.appointment_date}T00:00:00`);

    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (appointmentDate - today) / (1000 * 60 * 60 * 24)
    );

    let cancellationFee = 0;

    if (diffDays === 0) {
      cancellationFee = Number(appointment.price || 0);
    } else if (diffDays === 1) {
      cancellationFee = Math.round(Number(appointment.price || 0) * 0.8);
    }

    const result = await pool.query(
      `
      UPDATE appointments
      SET status = 'cancelled',
          cancellation_fee = $1,
          cancelled_at = CURRENT_TIMESTAMP
      WHERE id = $2
      AND user_id = $3
      RETURNING *
      `,
      [cancellationFee, id, userId]
    );

    try {
      const customerName =
        `${appointment.first_name || ''} ${appointment.last_name || ''}`.trim();

      await sendAdminCancellationNotification({
        customerName,
        customerEmail: appointment.email,
        customerPhone: appointment.phone,
        serviceName: appointment.service_name,
        date: appointment.appointment_date,
        startTime: appointment.start_time.slice(0, 5),
        endTime: appointment.end_time.slice(0, 5),
        cancellationFee
      });

    } catch (emailError) {
      console.error(
        'Termin je otkazan, ali admin email nije poslat:',
        emailError.message
      );
    }

    res.json({
      message:
        cancellationFee > 0
          ? `Termin je otkazan. Naknada za otkazivanje je ${cancellationFee} RSD.`
          : 'Termin je otkazan bez naknade.',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri otkazivanju termina.'
    });
  }
};

exports.cancelAppointmentByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const appointmentResult = await pool.query(
      `
      SELECT 
        a.id,
        TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
        a.start_time,
        a.end_time,
        a.status,
        a.manual_customer_name,
        a.manual_customer_phone,
        s.name AS service_name,
        u.first_name,
        u.last_name,
        u.email
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.id = $1
      `,
      [id]
    );

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Termin nije pronađen.'
      });
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.status !== 'booked') {
      return res.status(400).json({
        message: 'Termin je već otkazan.'
      });
    }

    const result = await pool.query(
      `
      UPDATE appointments
      SET status = 'cancelled',
          cancellation_fee = 0,
          cancelled_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    try {
      if (appointment.email) {
        await sendCustomerCancellationNotification({
          to: appointment.email,
          firstName: appointment.first_name,
          serviceName: appointment.service_name,
          date: appointment.appointment_date,
          startTime: appointment.start_time.slice(0, 5),
          endTime: appointment.end_time.slice(0, 5),
          cancellationFee: 0
        });
      }
    } catch (emailError) {
      console.error(
        'Termin je otkazan, ali email mušteriji nije poslat:',
        emailError.message
      );
    }

    res.json({
      message: 'Termin je otkazan.',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri admin otkazivanju termina.'
    });
  }
};