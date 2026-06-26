const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingRoutes = require('./routes/settingRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api/services', serviceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'DON Hair Studio API radi.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);

app.listen(PORT, () => {
  console.log(`Server radi na portu ${PORT}`);
});
