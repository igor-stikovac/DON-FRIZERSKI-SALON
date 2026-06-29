const email = require('./email');
const { sendSms } = require('./sms');

function formatDate(dateString) {
  if (!dateString) return '';

  const date = new Date(String(dateString) + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function shortTime(time) {
  return String(time || '').slice(0, 5);
}

async function runChannel(label, action) {
  try {
    await action();
  } catch (error) {
    console.error('[notifications] ' + label + ':', error.message);
  }
}

function appointmentText({ serviceName, date, startTime, price }) {
  const priceText = price ? ' Cena: ' + price + ' RSD.' : '';
  return 'DON Hair Studio: Zakazali ste termin za ' + serviceName + ', ' + formatDate(date) + ' u ' + shortTime(startTime) + '.' + priceText + ' Vidimo se!';
}

function reminderText({ serviceName, date, startTime, daysLeft }) {
  const when = daysLeft === 0 ? 'danas' : daysLeft === 1 ? 'sutra' : 'za ' + daysLeft + ' dana';
  return 'DON Hair Studio: Podsetnik, termin za ' + serviceName + ' je ' + when + ', ' + formatDate(date) + ' u ' + shortTime(startTime) + '.';
}

function cancellationText({ serviceName, date, startTime, cancellationFee }) {
  const feeText = cancellationFee > 0 ? ' Naknada za otkazivanje: ' + cancellationFee + ' RSD.' : '';
  return 'DON Hair Studio: Vas termin za ' + serviceName + ', ' + formatDate(date) + ' u ' + shortTime(startTime) + ', je otkazan.' + feeText;
}

function adminAppointmentText({ customerName, customerPhone, serviceName, date, startTime }) {
  return 'DON Hair Studio: Novi termin - ' + (customerName || 'Musterija') + ', ' + serviceName + ', ' + formatDate(date) + ' u ' + shortTime(startTime) + '. Tel: ' + (customerPhone || '-');
}

function adminCancellationText({ customerName, customerPhone, serviceName, date, startTime }) {
  return 'DON Hair Studio: Otkazan termin - ' + (customerName || 'Musterija') + ', ' + serviceName + ', ' + formatDate(date) + ' u ' + shortTime(startTime) + '. Tel: ' + (customerPhone || '-');
}

async function sendAppointmentConfirmation(details) {
  const tasks = [];

  if (details.to) {
    tasks.push(runChannel('email potvrda termina', () => email.sendAppointmentConfirmation(details)));
  }

  if (details.phone) {
    tasks.push(runChannel('SMS potvrda termina', () => sendSms({
      to: details.phone,
      message: appointmentText(details),
    })));
  }

  await Promise.all(tasks);
}

async function sendAdminAppointmentNotification(details) {
  const tasks = [
    runChannel('email admin obavestenje', () => email.sendAdminAppointmentNotification(details)),
  ];

  if (process.env.ADMIN_PHONE) {
    tasks.push(runChannel('SMS admin obavestenje', () => sendSms({
      to: process.env.ADMIN_PHONE,
      message: adminAppointmentText(details),
    })));
  }

  await Promise.all(tasks);
}

async function sendAdminCancellationNotification(details) {
  const tasks = [
    runChannel('email admin otkazivanje', () => email.sendAdminCancellationNotification(details)),
  ];

  if (process.env.ADMIN_PHONE) {
    tasks.push(runChannel('SMS admin otkazivanje', () => sendSms({
      to: process.env.ADMIN_PHONE,
      message: adminCancellationText(details),
    })));
  }

  await Promise.all(tasks);
}

async function sendCustomerCancellationNotification(details) {
  const tasks = [];

  if (details.to) {
    tasks.push(runChannel('email otkazivanje musteriji', () => email.sendCustomerCancellationNotification(details)));
  }

  if (details.phone) {
    tasks.push(runChannel('SMS otkazivanje musteriji', () => sendSms({
      to: details.phone,
      message: cancellationText(details),
    })));
  }

  await Promise.all(tasks);
}

async function sendAppointmentReminder(details) {
  const tasks = [];

  if (details.to) {
    tasks.push(runChannel('email podsetnik', () => email.sendAppointmentReminder(details)));
  }

  if (details.phone) {
    tasks.push(runChannel('SMS podsetnik', () => sendSms({
      to: details.phone,
      message: reminderText(details),
    })));
  }

  await Promise.all(tasks);
}

module.exports = {
  sendAppointmentConfirmation,
  sendAdminAppointmentNotification,
  sendAdminCancellationNotification,
  sendCustomerCancellationNotification,
  sendAppointmentReminder,
};
