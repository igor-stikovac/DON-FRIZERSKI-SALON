const API_URL = 'http://localhost:5000/api';

const menuBtn = document.getElementById('menuBtn');
const navMenu = document.getElementById('navMenu');
const authMessage = document.getElementById('authMessage');
const loginMessage = document.getElementById('loginMessage');
const userStatus = document.getElementById('userStatus');

menuBtn?.addEventListener('click', () => {
  navMenu.classList.toggle('open');
});

function setMessage(element, text, type = 'success') {
  if (!element) return;
  element.textContent = text;
  element.className = type === 'error' ? 'auth-message error' : 'auth-message success';
}

function saveSession(data) {
  localStorage.setItem('don_token', data.token);
  localStorage.setItem('don_user', JSON.stringify(data.user));
  renderUserStatus();
}

function getLoggedUser() {
  const user = localStorage.getItem('don_user');
  return user ? JSON.parse(user) : null;
}

function renderUserStatus() {
  const user = getLoggedUser();
  if (!userStatus) return;

  if (user) {
    const firstName = user.first_name || user.firstName;
    userStatus.innerHTML = `Prijavljen si kao <b>${firstName}</b> <button id="logoutBtn">Odjavi se</button>`;
    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem('don_token');
      localStorage.removeItem('don_user');
      renderUserStatus();
    });
  } else {
    userStatus.textContent = 'Niste prijavljeni.';
  }
}

const registerForm = document.getElementById('registerForm');
registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
  };

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return setMessage(authMessage, data.message || 'Registracija nije uspela.', 'error');
    }

    saveSession(data);
    registerForm.reset();
    setMessage(authMessage, data.message);
  } catch (error) {
    setMessage(authMessage, 'Backend nije pokrenut ili API nije dostupan.', 'error');
  }
});

const loginForm = document.getElementById('loginForm');
loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    email: document.getElementById('loginEmail').value.trim(),
    password: document.getElementById('loginPassword').value,
  };

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return setMessage(loginMessage, data.message || 'Prijava nije uspela.', 'error');
    }

    saveSession(data);
    loginForm.reset();
    setMessage(loginMessage, data.message);
  } catch (error) {
    setMessage(loginMessage, 'Backend nije pokrenut ili API nije dostupan.', 'error');
  }
});

const bookingForm = document.getElementById('bookingForm');
const bookingMessage = document.getElementById('bookingMessage');
const timeGrid = document.getElementById('timeGrid');
const weekDays = document.getElementById('weekDays');
const calendarTitle = document.getElementById('calendarTitle');

let selectedDate = null;
let selectedTime = null;
let currentWeekStart = getStartOfWeek(new Date());

const allTimes = [
  '10:00', '10:15', '10:30', '10:45', '11:00', '11:15',
  '11:30', '11:45', '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45', '14:00', '14:15',
  '14:30', '14:45', '15:00', '15:15', '15:30', '15:45',
  '16:00'
];

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateForApi(date) {
  return date.toISOString().split('T')[0];
}

function renderCalendar() {
  const monthName = currentWeekStart.toLocaleDateString('sr-RS', {
    month: 'long',
    year: 'numeric'
  });

  calendarTitle.innerHTML = `${monthName}. <span>(ove nedelje)</span>`;
  weekDays.innerHTML = '';

  const dayNames = ['PON', 'UTO', 'SRE', 'ČET', 'PET', 'SUB', 'NED'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);

    const day = document.createElement('div');
    day.className = 'day-item';

    if (selectedDate === formatDateForApi(date)) {
      day.classList.add('selected');
    }

    day.innerHTML = `
      <div class="day-name">${dayNames[i]}</div>
      <div class="day-number">${date.getDate()}</div>
    `;

    day.addEventListener('click', () => {
      selectedDate = formatDateForApi(date);
      selectedTime = null;
      renderCalendar();
      loadAvailableSlots();
    });

    weekDays.appendChild(day);
  }
}

async function loadAvailableSlots() {
  if (!selectedDate) return;

  try {
    const response = await fetch(`${API_URL}/appointments/available?date=${selectedDate}`);
    const data = await response.json();

    const availableSlots = data.availableSlots || [];

    timeGrid.innerHTML = '';

    allTimes.forEach(time => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = time;

      if (!availableSlots.includes(time)) {
        btn.classList.add('booked');
      }

      btn.addEventListener('click', () => {
        selectedTime = time;

        document
          .querySelectorAll('.calendar-times button')
          .forEach(button => button.classList.remove('selected'));

        btn.classList.add('selected');
      });

      timeGrid.appendChild(btn);
    });
  } catch (error) {
    bookingMessage.textContent = 'Greška pri učitavanju termina.';
  }
}

document.getElementById('goToCalendar')?.addEventListener('click', () => {
  const service = document.getElementById('service').value;

  if (!service) {
    bookingMessage.textContent = 'Prvo izaberi uslugu.';
    return;
  }

  bookingMessage.textContent = '';

  document.querySelector('[data-step="1"]').classList.remove('active');
  document.querySelector('[data-step="2"]').classList.add('active');

  selectedDate = formatDateForApi(new Date());
  renderCalendar();
  loadAvailableSlots();
});

document.getElementById('prevWeek')?.addEventListener('click', () => {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  renderCalendar();
});

document.getElementById('nextWeek')?.addEventListener('click', () => {
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  renderCalendar();
});

bookingForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = localStorage.getItem('don_token');

  if (!token) {
    bookingMessage.textContent = 'Morate biti prijavljeni da biste zakazali termin.';
    return;
  }

  if (!selectedDate || !selectedTime) {
    bookingMessage.textContent = 'Izaberi dan i termin.';
    return;
  }

  const response = await fetch(`${API_URL}/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      service: document.getElementById('service').value,
      date: selectedDate,
      time: selectedTime
    })
  });

  const data = await response.json();
  bookingMessage.textContent = data.message;

  if (response.ok) {
    selectedTime = null;
    loadAvailableSlots();
  }
});

renderCalendar();
renderUserStatus();