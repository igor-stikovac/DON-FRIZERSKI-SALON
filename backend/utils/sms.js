const http = require('http');
const https = require('https');
const { URL } = require('url');

function isSmsEnabled() {
  return process.env.SMS_ENABLED === 'true';
}

function normalizePhone(phone) {
  if (!phone) return null;

  let value = String(phone).trim();
  if (!value) return null;

  value = value.replace(/[^\d+]/g, '');

  if (value.startsWith('00')) {
    value = '+' + value.slice(2);
  }

  if (!value.startsWith('+') && value.startsWith('0') && process.env.SMS_DEFAULT_COUNTRY_CODE) {
    value = process.env.SMS_DEFAULT_COUNTRY_CODE + value.slice(1);
  }

  return value || null;
}

function request({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const payload = body || '';
    const transport = parsedUrl.protocol === 'http:' ? http : https;

    const req = transport.request(
      {
        method,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'http:' ? 80 : 443),
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body: data });
          } else {
            reject(new Error('SMS provider returned ' + res.statusCode + ': ' + data));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendViaTwilio({ to, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!accountSid || !authToken || !from) {
    console.log('[sms] Twilio podesavanja nisu uneta - preskacem SMS.');
    return;
  }

  const body = new URLSearchParams({ From: from, To: to, Body: message }).toString();
  const auth = Buffer.from(accountSid + ':' + authToken).toString('base64');

  await request({
    method: 'POST',
    url: 'https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages.json',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
}

async function sendViaHttpProvider({ to, message }) {
  const url = process.env.SMS_API_URL;
  const token = process.env.SMS_API_TOKEN;
  const from = process.env.SMS_FROM;

  if (!url || !token) {
    console.log('[sms] SMS_API_URL ili SMS_API_TOKEN nisu uneti - preskacem SMS.');
    return;
  }

  await request({
    method: 'POST',
    url,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, message }),
  });
}

async function sendSms({ to, message }) {
  if (!isSmsEnabled()) return;

  const normalizedTo = normalizePhone(to);
  if (!normalizedTo || !message) return;

  const provider = (process.env.SMS_PROVIDER || 'log').toLowerCase();

  if (provider === 'log') {
    console.log('[sms] ' + normalizedTo + ': ' + message);
    return;
  }

  if (provider === 'twilio') {
    await sendViaTwilio({ to: normalizedTo, message });
    return;
  }

  if (provider === 'http') {
    await sendViaHttpProvider({ to: normalizedTo, message });
    return;
  }

  console.log('[sms] Nepoznat SMS_PROVIDER "' + provider + '" - preskacem SMS.');
}

module.exports = {
  sendSms,
  normalizePhone,
};
