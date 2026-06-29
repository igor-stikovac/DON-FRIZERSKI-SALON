const nodemailer = require('nodemailer');

function createTransporter() {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host:       process.env.EMAIL_HOST,
    port:       Number(process.env.EMAIL_PORT || 587),
    secure:     process.env.EMAIL_SECURE === 'true',
    requireTLS: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function formatDateForEmail(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('sr-RS', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric',
  });
}

// ─────────────────────────────────────────────────────────────
// Potvrda zakazivanja — šalje se mušteriji
// ─────────────────────────────────────────────────────────────
async function sendAppointmentConfirmation({ to, firstName, serviceName, date, startTime, endTime, price }) {
  const transporter = createTransporter();
  if (!transporter) { console.log('[email] Podešavanja nisu uneta — preskačem potvrdu.'); return; }

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: 'Potvrda zakazivanja — DON Hair Studio',
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
        <h2>DON Hair Studio</h2>
        <p>Zdravo ${firstName || ''},</p>
        <p>Uspešno ste zakazali termin.</p>
        <div style="padding:16px;background:#f8fafc;border-radius:12px;margin:20px 0">
          <p><strong>Usluga:</strong> ${serviceName}</p>
          <p><strong>Datum:</strong> ${formatDateForEmail(date)}</p>
          <p><strong>Vreme:</strong> ${startTime} – ${endTime}</p>
          <p><strong>Cena:</strong> ${price || 0} RSD</p>
        </div>
        <p>Vidimo se u zakazanom terminu.</p>
        <p>Srdačno,<br><strong>DON Hair Studio</strong></p>
      </div>`,
  });
}

// ─────────────────────────────────────────────────────────────
// Obaveštenje adminu o novom terminu
// ─────────────────────────────────────────────────────────────
async function sendAdminAppointmentNotification({ customerName, customerEmail, customerPhone, serviceName, date, startTime, endTime, price }) {
  const transporter = createTransporter();
  if (!transporter) { console.log('[email] Podešavanja nisu uneta — preskačem admin notif.'); return; }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) { console.log('[email] ADMIN_EMAIL nije postavljen.'); return; }

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to:      adminEmail,
    subject: 'Novi zakazan termin — DON Hair Studio',
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
        <h2>Novi zakazan termin</h2>
        <div style="padding:16px;background:#f8fafc;border-radius:12px;margin:20px 0">
          <p><strong>Mušterija:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
          <p><strong>Telefon:</strong> ${customerPhone || '-'}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
          <p><strong>Usluga:</strong> ${serviceName}</p>
          <p><strong>Datum:</strong> ${formatDateForEmail(date)}</p>
          <p><strong>Vreme:</strong> ${startTime} – ${endTime}</p>
          <p><strong>Cena:</strong> ${price || 0} RSD</p>
        </div>
        <p>Termin je dodat u sistem.</p>
      </div>`,
  });
}

// ─────────────────────────────────────────────────────────────
// Obaveštenje adminu o otkazivanju od strane mušterije
// ─────────────────────────────────────────────────────────────
async function sendAdminCancellationNotification({ customerName, customerEmail, customerPhone, serviceName, date, startTime, endTime, cancellationFee }) {
  const transporter = createTransporter();
  if (!transporter) { console.log('[email] Podešavanja nisu uneta — preskačem admin cancel notif.'); return; }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) { console.log('[email] ADMIN_EMAIL nije postavljen.'); return; }

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to:      adminEmail,
    subject: 'Termin je otkazan — DON Hair Studio',
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
        <h2>Termin je otkazan</h2>
        <div style="padding:16px;background:#f8fafc;border-radius:12px;margin:20px 0">
          <p><strong>Mušterija:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail || '-'}</p>
          <p><strong>Telefon:</strong> ${customerPhone || '-'}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
          <p><strong>Usluga:</strong> ${serviceName}</p>
          <p><strong>Datum:</strong> ${formatDateForEmail(date)}</p>
          <p><strong>Vreme:</strong> ${startTime} – ${endTime}</p>
          <p><strong>Naknada:</strong> ${cancellationFee || 0} RSD</p>
        </div>
        <p>Termin je otkazala mušterija.</p>
      </div>`,
  });
}

// ─────────────────────────────────────────────────────────────
// Obaveštenje mušteriji o otkazivanju (od strane mušterije ili admina)
// ─────────────────────────────────────────────────────────────
async function sendCustomerCancellationNotification({ to, firstName, serviceName, date, startTime, endTime, cancellationFee }) {
  const transporter = createTransporter();
  if (!transporter) { console.log('[email] Podešavanja nisu uneta — preskačem cancel email mušteriji.'); return; }
  if (!to) return;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: 'Vaš termin je otkazan — DON Hair Studio',
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
        <h2>DON Hair Studio</h2>
        <p>Zdravo ${firstName || ''},</p>
        <p>Vaš termin je otkazan.</p>
        <div style="padding:16px;background:#f8fafc;border-radius:12px;margin:20px 0">
          <p><strong>Usluga:</strong> ${serviceName}</p>
          <p><strong>Datum:</strong> ${formatDateForEmail(date)}</p>
          <p><strong>Vreme:</strong> ${startTime} – ${endTime}</p>
          ${cancellationFee > 0 ? `<p><strong>Naknada za otkazivanje:</strong> ${cancellationFee} RSD</p>` : ''}
        </div>
        <p>Ako imate pitanje, možete kontaktirati salon.</p>
        <p>Srdačno,<br><strong>DON Hair Studio</strong></p>
      </div>`,
  });
}

// ─────────────────────────────────────────────────────────────
// Podsetnik pred termin — koristi reminderJob
// ─────────────────────────────────────────────────────────────
async function sendAppointmentReminder({ to, firstName, serviceName, date, startTime, endTime, daysLeft }) {
  const transporter = createTransporter();
  if (!transporter) { console.log('[email] Podešavanja nisu uneta — preskačem podsetnik.'); return; }
  if (!to) return;

  let subject;
  let whenText;

  if (daysLeft === 0) {
    subject  = 'Podsetnik: Vaš termin je danas — DON Hair Studio';
    whenText = '<strong>DANAS</strong>';
  } else if (daysLeft === 1) {
    subject  = 'Podsetnik: Vaš termin je sutra — DON Hair Studio';
    whenText = '<strong>sutra</strong>';
  } else {
    subject  = `Podsetnik: Vaš termin je za ${daysLeft} dana — DON Hair Studio`;
    whenText = `za <strong>${daysLeft} dana</strong>`;
  }

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
        <h2>DON Hair Studio</h2>
        <p>Zdravo ${firstName || ''},</p>
        <p>Podsetnik: imate zakazan termin ${whenText}.</p>
        <div style="padding:16px;background:#f8fafc;border-radius:12px;margin:20px 0">
          <p><strong>Usluga:</strong> ${serviceName}</p>
          <p><strong>Datum:</strong> ${formatDateForEmail(date)}</p>
          <p><strong>Vreme:</strong> ${startTime} – ${endTime}</p>
        </div>
        <p>Vidimo se!</p>
        <p>Srdačno,<br><strong>DON Hair Studio</strong></p>
      </div>`,
  });
}

module.exports = {
  sendAppointmentConfirmation,
  sendAdminAppointmentNotification,
  sendAdminCancellationNotification,
  sendCustomerCancellationNotification,
  sendAppointmentReminder,
};
