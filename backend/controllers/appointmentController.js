const pool = require('../config/db');

const WORK_START = '10:00';

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

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

exports.getAvailableSlots = async (req, res) => {
  try {
    const { date, serviceId } = req.query;

    if (!date || !serviceId) {
      return res.status(400).json({ message: 'Datum i usluga su obavezni.' });
    }

    const serviceResult = await pool.query(
      'SELECT duration_minutes FROM services WHERE id = $1',
      [serviceId]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usluga nije pronađena.' });
    }

    const duration = serviceResult.rows[0].duration_minutes;

    const appointmentsResult = await pool.query(
      `SELECT start_time, end_time
       FROM appointments
       WHERE appointment_date = $1
       AND status = 'booked'`,
      [date]
    );

    const booked = appointmentsResult.rows.map(row => ({
      start: timeToMinutes(row.start_time.slice(0, 5)),
      end: timeToMinutes(row.end_time.slice(0, 5))
    }));
    
    const workEnd = getWorkEndByDate(date);

    if (!workEnd) {
      return res.json({ availableSlots: [] });
    }

    const startDay = timeToMinutes(WORK_START);
    const endDay = timeToMinutes(workEnd);

    // const availableSlots = [];

    // for (let start = startDay; start + duration <= endDay; start += STEP_MINUTES) {
    //   const end = start + duration;

    //   const isBusy = booked.some(b =>
    //     overlaps(start, end, b.start - BUFFER_MINUTES, b.end + BUFFER_MINUTES)
    //   );

    //   if (!isBusy) {
    //     availableSlots.push({
    //       start: minutesToTime(start),
    //       end: minutesToTime(end)
    //     });
    //   }
    // }

    const candidateStarts = new Set();

    for (let start = startDay; start + duration <= endDay; start += DEFAULT_STEP_MINUTES) {
      candidateStarts.add(start);
    }

    /* dodatni termini posle već zakazanih termina */
    booked.forEach(b => {
      const candidate = b.end + BUFFER_MINUTES;

      if (candidate + duration <= endDay) {
        candidateStarts.add(candidate);
      }
    });

    const availableSlots = [];

    [...candidateStarts]
      .sort((a, b) => a - b)
      .forEach(start => {
        const end = start + duration;

        const isBusy = booked.some(b =>
          overlaps(
            start,
            end,
            b.start - BUFFER_MINUTES,
            b.end + BUFFER_MINUTES
          )
        );

        if (!isBusy) {
          availableSlots.push({
            start: minutesToTime(start),
            end: minutesToTime(end)
          });
        }
      });

    res.json({ availableSlots });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Greška pri učitavanju termina.' });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { serviceId, date, time } = req.body;

    if (!serviceId || !date || !time) {
      return res.status(400).json({ message: 'Usluga, datum i vreme su obavezni.' });
    }

    const serviceResult = await pool.query(
      'SELECT duration_minutes FROM services WHERE id = $1',
      [serviceId]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usluga nije pronađena.' });
    }

    const duration = serviceResult.rows[0].duration_minutes;

    const workEnd = getWorkEndByDate(date);

    if (!workEnd) {
      return res.status(400).json({
        message: 'Salon ne radi nedeljom.'
      });
    }

    const startMinutes = timeToMinutes(time);
    const endMinutes = startMinutes + duration;

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
      return res.status(409).json({ message: 'Termin više nije slobodan.' });
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

    res.status(201).json({
      message: 'Uspešno ste zakazali termin.',
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Greška pri zakazivanju termina.' });
  }
};

exports.getMyAppointments = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
          a.id,
          a.appointment_date,
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
    const appointmentId = req.params.id;

    const result = await pool.query(
      `SELECT 
          a.id,
          a.appointment_date,
          a.status,
          s.price
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [appointmentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Termin nije pronađen.' });
    }

    const appointment = result.rows[0];

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ message: 'Termin je već otkazan.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointmentDate = new Date(appointment.appointment_date);
    appointmentDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((appointmentDate - today) / (1000 * 60 * 60 * 24));

    let fee = 0;

    if (diffDays === 0) {
      fee = appointment.price;
    } else if (diffDays === 1) {
      fee = Math.round(appointment.price * 0.8);
    }

    await pool.query(
      `UPDATE appointments
       SET status = 'cancelled',
           cancellation_fee = $1,
           cancelled_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [fee, appointmentId]
    );

    res.json({
      message: fee > 0
        ? `Termin je otkazan. Naknada za otkazivanje je ${fee} RSD.`
        : 'Termin je uspešno otkazan bez naknade.',
      cancellationFee: fee
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Greška pri otkazivanju termina.' });
  }
};