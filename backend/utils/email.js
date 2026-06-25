const nodemailer = require('nodemailer');

function createTransporter() {
  if (
    !process.env.EMAIL_HOST ||
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    requireTLS: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
 });
}

function formatDateForEmail(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString('sr-RS', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

async function sendAppointmentConfirmation({
  to,
  firstName,
  serviceName,
  date,
  startTime,
  endTime,
  price
}) {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('Email podešavanja nisu uneta. Preskačem slanje emaila.');
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: 'Potvrda zakazivanja - DON Hair Studio',
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2>DON Hair Studio</h2>

        <p>Zdravo ${firstName || ''},</p>

        <p>Uspešno ste zakazali termin.</p>

        <div style="padding: 16px; background: #f8fafc; border-radius: 12px; margin: 20px 0;">
          <p><strong>Usluga:</strong> ${serviceName}</p>
          <p><strong>Datum:</strong> ${formatDateForEmail(date)}</p>
          <p><strong>Vreme:</strong> ${startTime} - ${endTime}</p>
          <p><strong>Cena:</strong> ${price || 0} RSD</p>
        </div>

        <p>Vidimo se u zakazanom terminu.</p>

        <p>
          Srdačno,<br>
          <strong>DON Hair Studio</strong>
        </p>
      </div>
    `
  });
}

module.exports = {
  sendAppointmentConfirmation
};