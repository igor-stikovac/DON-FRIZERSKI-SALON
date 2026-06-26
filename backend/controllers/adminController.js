const pool = require('../config/db');

const WORK_START = '10:00';
const BUFFER_MINUTES = 5;

const {
  sendAppointmentConfirmation
} = require('../utils/email');

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
        a.user_id,
        a.service_id,
        TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
        a.start_time,
        a.end_time,
        a.status,
        a.cancellation_fee,
        a.manual_customer_name,
        a.manual_customer_phone,
        a.manual_customer_email,
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

    const blocksResult = await pool.query(
      `
      SELECT id, block_date, start_time, end_time, reason
      FROM blocked_slots
      WHERE block_date = $1
      ORDER BY start_time
      `,
      [date]
    );

    res.json({
      appointments: result.rows,
      blocks: blocksResult.rows
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
      customerName,
      customerPhone,
      customerEmail,
      serviceId,
      date,
      time,
      note
    } = req.body;

    if (!customerName || !serviceId || !date || !time) {
      return res.status(400).json({
        message: 'Ime mušterije, usluga, datum i vreme su obavezni.'
      });
    }

    const serviceResult = await pool.query(
      `SELECT id, name, duration_minutes, price
       FROM services
       WHERE id = $1`,
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

    const blocksResult = await pool.query(
      `
      SELECT start_time, end_time
      FROM blocked_slots
      WHERE block_date = $1
      `,
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
        message: 'Taj termin je već zauzet ili blokiran.'
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
        manual_customer_email,
        note,
        status
      )
      VALUES
      (
        NULL, $1, $2, $3, $4, $5, $6, $7, $8, 'booked'
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
        customerEmail || null,
        note || null
      ]
    );

    try {
      if (customerEmail) {
        await sendAppointmentConfirmation({
          to: customerEmail,
          firstName: customerName,
          serviceName: service.name,
          date,
          startTime: minutesToTime(startMinutes),
          endTime: minutesToTime(endMinutes),
          price: service.price
        });
      }
    } catch (emailError) {
      console.error(
        'Ručni termin je dodat, ali email mušteriji nije poslat:',
        emailError.message
      );
    }

    res.status(201).json({
      message: 'Termin je uspešno dodat.',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri ručnom dodavanju termina.'
    });
  }
};

exports.createBlockedSlot = async (req, res) => {
  try {
    const { date, startTime, endTime, reason } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        message: 'Datum, početak i kraj blokade su obavezni.'
      });
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      return res.status(400).json({
        message: 'Početak blokade mora biti pre kraja.'
      });
    }

    const result = await pool.query(
      `
      INSERT INTO blocked_slots
      (block_date, start_time, end_time, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [date, startTime, endTime, reason || null]
    );

    res.status(201).json({
      message: 'Vreme je blokirano.',
      block: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri blokiranju vremena.'
    });
  }
};

exports.deleteBlockedSlot = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM blocked_slots
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Blokada nije pronađena.'
      });
    }

    res.json({
      message: 'Blokada je uklonjena.'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri uklanjanju blokade.'
    });
  }
};

exports.updateAppointmentByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      serviceId,
      date,
      time,
      customerName,
      customerPhone,
      note
    } = req.body;

    if (!serviceId || !date || !time) {
      return res.status(400).json({
        message: 'Usluga, datum i vreme su obavezni.'
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
      SELECT id, start_time, end_time
      FROM appointments
      WHERE appointment_date = $1
      AND status = 'booked'
      AND id <> $2
      `,
      [date, id]
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
        message: 'Izabrani termin se preklapa sa drugim terminom ili blokadom.'
      });
    }

    const result = await pool.query(
      `
      UPDATE appointments
      SET service_id = $1,
          appointment_date = $2,
          start_time = $3,
          end_time = $4,
          manual_customer_name = $5,
          manual_customer_phone = $6,
          note = $7
      WHERE id = $8
      RETURNING *
      `,
      [
        serviceId,
        date,
        minutesToTime(startMinutes),
        minutesToTime(endMinutes),
        customerName || null,
        customerPhone || null,
        note || null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Termin nije pronađen.'
      });
    }

    res.json({
      message: 'Termin je uspešno izmenjen.',
      appointment: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri izmeni termina.'
    });
  }
};

exports.getAdminServices = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, duration_minutes, price, is_active
      FROM services
      ORDER BY id
      `
    );

    res.json({
      services: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri učitavanju usluga.'
    });
  }
};

exports.createServiceByAdmin = async (req, res) => {
  try {
    const { name, durationMinutes, price } = req.body;

    if (!name || !durationMinutes) {
      return res.status(400).json({
        message: 'Naziv i trajanje usluge su obavezni.'
      });
    }

    const result = await pool.query(
      `
      INSERT INTO services (name, duration_minutes, price, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING *
      `,
      [name, durationMinutes, price || 0]
    );

    res.status(201).json({
      message: 'Usluga je dodata.',
      service: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri dodavanju usluge.'
    });
  }
};

exports.updateServiceByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, durationMinutes, price, isActive } = req.body;

    const result = await pool.query(
      `
      UPDATE services
      SET name = $1,
          duration_minutes = $2,
          price = $3,
          is_active = $4
      WHERE id = $5
      RETURNING *
      `,
      [name, durationMinutes, price || 0, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Usluga nije pronađena.'
      });
    }

    res.json({
      message: 'Usluga je izmenjena.',
      service: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri izmeni usluge.'
    });
  }
};

exports.deleteServiceByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE services
      SET is_active = false
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Usluga nije pronađena.'
      });
    }

    res.json({
      message: 'Usluga je deaktivirana.'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri deaktiviranju usluge.'
    });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        message: 'Godina i mesec su obavezni.'
      });
    }

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

    const nextMonthDate = new Date(Number(year), Number(month), 1);
    const nextMonthStart = nextMonthDate.toISOString().slice(0, 10);

    const todayStatsResult = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'booked') AS booked_today,
        COUNT(*) FILTER (WHERE a.status = 'cancelled') AS cancelled_today,
        COALESCE(SUM(
          CASE 
            WHEN a.status = 'booked' THEN COALESCE(s.price, 0)
            ELSE 0
          END
        ), 0) AS revenue_today
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      WHERE a.appointment_date = CURRENT_DATE
      `
    );

    const todayBlocksResult = await pool.query(
      `
      SELECT COUNT(*) AS blocks_today
      FROM blocked_slots
      WHERE block_date = CURRENT_DATE
      `
    );

    const monthAppointmentsResult = await pool.query(
      `
      SELECT
        TO_CHAR(appointment_date, 'YYYY-MM-DD') AS date,
        COUNT(*) FILTER (WHERE status = 'booked') AS booked_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count
      FROM appointments
      WHERE appointment_date >= $1
      AND appointment_date < $2
      GROUP BY appointment_date
      ORDER BY appointment_date
      `,
      [monthStart, nextMonthStart]
    );

    const monthBlocksResult = await pool.query(
      `
      SELECT
        TO_CHAR(block_date, 'YYYY-MM-DD') AS date,
        COUNT(*) AS blocks_count
      FROM blocked_slots
      WHERE block_date >= $1
      AND block_date < $2
      GROUP BY block_date
      ORDER BY block_date
      `,
      [monthStart, nextMonthStart]
    );

    res.json({
      today: {
        bookedToday: Number(todayStatsResult.rows[0].booked_today || 0),
        cancelledToday: Number(todayStatsResult.rows[0].cancelled_today || 0),
        revenueToday: Number(todayStatsResult.rows[0].revenue_today || 0),
        blocksToday: Number(todayBlocksResult.rows[0].blocks_today || 0)
      },
      monthAppointments: monthAppointmentsResult.rows,
      monthBlocks: monthBlocksResult.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri učitavanju admin statistike.'
    });
  }
};

exports.toggleServiceStatusByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const serviceResult = await pool.query(
      `
      SELECT id, is_active
      FROM services
      WHERE id = $1
      `,
      [id]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Usluga nije pronađena.'
      });
    }

    const currentStatus = serviceResult.rows[0].is_active;
    const newStatus = !currentStatus;

    const result = await pool.query(
      `
      UPDATE services
      SET is_active = $1
      WHERE id = $2
      RETURNING *
      `,
      [newStatus, id]
    );

    res.json({
      message: newStatus
        ? 'Usluga je aktivirana.'
        : 'Usluga je deaktivirana.',
      service: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri promeni statusa usluge.'
    });
  }
};

exports.getSiteSettings = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT setting_key, setting_value
      FROM site_settings
      ORDER BY setting_key
      `
    );

    const settings = {};

    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    res.json({ settings });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri učitavanju podešavanja.'
    });
  }
};

exports.updateSiteSettings = async (req, res) => {
  try {
    const settings = req.body;

    const entries = Object.entries(settings);

    for (const [key, value] of entries) {
      await pool.query(
        `
        INSERT INTO site_settings (setting_key, setting_value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_at = CURRENT_TIMESTAMP
        `,
        [key, value]
      );
    }

    res.json({
      message: 'Podešavanja su sačuvana.'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri čuvanju podešavanja.'
    });
  }
};

exports.getClosedDays = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        id,
        TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
        TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date,
        reason
      FROM closed_days
      ORDER BY start_date DESC
      `
    );

    res.json({
      closedDays: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri učitavanju neradnih dana.'
    });
  }
};

exports.createClosedDay = async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: 'Početni i krajnji datum su obavezni.'
      });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        message: 'Krajnji datum ne može biti pre početnog.'
      });
    }

    const result = await pool.query(
      `
      INSERT INTO closed_days (start_date, end_date, reason)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [startDate, endDate, reason || null]
    );

    res.status(201).json({
      message: 'Neradni dan je dodat.',
      closedDay: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri dodavanju neradnog dana.'
    });
  }
};

exports.deleteClosedDay = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM closed_days
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Neradni dan nije pronađen.'
      });
    }

    res.json({
      message: 'Neradni dan je obrisan.'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri brisanju neradnog dana.'
    });
  }
};