const express     = require('express');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');
require('dotenv').config();

const authRoutes        = require('./routes/authRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const serviceRoutes     = require('./routes/serviceRoutes');
const adminRoutes       = require('./routes/adminRoutes');
const settingRoutes     = require('./routes/settingRoutes');

// Cron job za podsetnik emailove — pokreće se automatski pri startovanju
require('./jobs/reminderJob');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ────────────────────────────────────────────────────
// Dozvoli samo frontend domen iz .env (FRONTEND_URL=https://tvojsajt.com)
// Ako FRONTEND_URL nije postavljen, logruj upozorenje.
const allowedOrigin = process.env.FRONTEND_URL;

if (!allowedOrigin) {
  console.warn(
    '⚠️  FRONTEND_URL nije postavljen u .env fajlu. ' +
    'CORS je otvoren za sve domene — to je OK za development, ali NE za produkciju.'
  );
}

app.use(cors({
  origin: allowedOrigin || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── RATE LIMITING ───────────────────────────────────────────
// Globalni limit: 100 zahteva po IP u 15 minuta
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: 'Previše zahteva. Pokušajte ponovo za nekoliko minuta.' },
});

// Auth limit: strožiji — 10 pokušaja logina/registracije po IP u 15 minuta
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: 'Previše neuspelih pokušaja. Pokušajte ponovo za 15 minuta.' },
});

app.use(globalLimiter);
app.use(express.json());

// ─── RUTE ────────────────────────────────────────────────────
app.use('/api/auth',         authLimiter, authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/services',     serviceRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/settings',     settingRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'DON Hair Studio API radi.' });
});

app.listen(PORT, () => {
  console.log(`✅ Server radi na portu ${PORT}`);
});
