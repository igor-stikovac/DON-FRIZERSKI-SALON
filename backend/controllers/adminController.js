const pool = require('../config/db');

const WORK_START = '10:00';
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

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function getWorkEndByDate(date) {
  const day = new Date(`${date}T00:00:00`).getDay();

  if (day === 0) return null;
  if (day === 6) return '15:00';

  return '20:00';
}

exports.getAppointmentsByDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        message: 'Datum je obavezan.'
      });
    }

    const result = await pool.query(
      `
      SELECT 
        a.id,
        a.appointment_date,
        a.start_time,
        a.end_time,
        a.status,
        a.cancellation_fee,
        a.manual_customer_name,
        a.manual_customer_phone,
        a.note,

        u.first_name,
        u.last_name,
        u.phone,
        u.email,

        s.name AS service_name,
        s.price
      FROM appointments a
      LEFT JOIN users u ON a.user_id = u.id
      JOIN services s ON a.service_id = s.id
      WHERE a.appointment_date = $1
      ORDER BY a.start_time
      `,
      [date]
    );

    res.json({
      appointments: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri učitavanju termina.'
    });
  }
};

exports.cancelAppointmentByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

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

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Termin nije pronađen.'
      });
    }

    res.json({
      message: 'Termin je otkazan.',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri otkazivanju termina.'
    });
  }
};

exports.createManualAppointment = async (req, res) => {
  try {
    const {
      serviceId,
      date,
      time,
      customerName,
      customerPhone,
      note
    } = req.body;

    if (!serviceId || !date || !time || !customerName) {
      return res.status(400).json({
        message: 'Usluga, datum, vreme i ime mušterije su obavezni.'
      });
    }

    const serviceResult = await pool.query(
      'SELECT duration_minutes FROM services WHERE id = $1',
      [serviceId]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Usluga nije pronađena.'
      });
    }

    const workEnd = getWorkEndByDate(date);

    if (!workEnd) {
      return res.status(400).json({
        message: 'Salon ne radi nedeljom.'
      });
    }

    const duration = serviceResult.rows[0].duration_minutes;

    const startMinutes = timeToMinutes(time);
    const endMinutes = startMinutes + duration;

    const startDay = timeToMinutes(WORK_START);
    const endDay = timeToMinutes(workEnd);

    if (startMinutes < startDay || endMinutes > endDay) {
      return res.status(400).json({
        message: 'Termin nije u okviru radnog vremena.'
      });
    }

    const bookedResult = await pool.query(
      `
      SELECT start_time, end_time
      FROM appointments
      WHERE appointment_date = $1
      AND status = 'booked'
      `,
      [date]
    );

    const hasOverlap = bookedResult.rows.some(row => {
      const bookedStart = timeToMinutes(row.start_time.slice(0, 5));
      const bookedEnd = timeToMinutes(row.end_time.slice(0, 5));

      return overlaps(
        startMinutes,
        endMinutes,
        bookedStart - BUFFER_MINUTES,
        bookedEnd + BUFFER_MINUTES
      );
    });

    if (hasOverlap) {
      return res.status(409).json({
        message: 'Taj termin je već zauzet.'
      });
    }

    const result = await pool.query(
      `
      INSERT INTO appointments
      (
        user_id,
        service_id,
        appointment_date,
        start_time,
        end_time,
        manual_customer_name,
        manual_customer_phone,
        note,
        status
      )
      VALUES
      (
        NULL, $1, $2, $3, $4, $5, $6, $7, 'booked'
      )
      RETURNING *
      `,
      [
        serviceId,
        date,
        minutesToTime(startMinutes),
        minutesToTime(endMinutes),
        customerName,
        customerPhone || null,
        note || null
      ]
    );

    res.status(201).json({
      message: 'Termin je ručno dodat.',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri ručnom dodavanju termina.'
    });
  }
};