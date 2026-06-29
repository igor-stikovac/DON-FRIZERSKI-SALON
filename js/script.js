const API_URL = window.API_URL || 'http://localhost:5000/api';

/* =========================
   STATE
========================= */

let selectedDate    = null;
let selectedTime    = null;
let currentWeekStart = getStartOfWeek(new Date());
let appointmentToCancel = null;

// Podešavanja učitana iz API-ja (naknada za otkazivanje i sl.)
let siteSettings = {
  cancellation_fee_same_day: 100,
  cancellation_fee_one_day:  80,
};

/* =========================
   HELPERS
========================= */

function setMessage(element, text, type = 'success') {
  if (!element) return;
  element.textContent = text;
  element.className   = type === 'error' ? 'auth-message error' : 'auth-message success';
}

function showGlobalMessage(text, type = 'success') {
  let box = document.getElementById('globalMessage');

  if (!box) {
    box = document.createElement('div');
    box.id = 'globalMessage';
    document.body.prepend(box);
  }

  box.textContent = text;
  box.className   = type === 'error' ? 'global-message error' : 'global-message success';
  box.style.display = 'block';

  setTimeout(() => { box.style.display = 'none'; }, 4000);
}

function getLoggedUser() {
  try {
    const u = localStorage.getItem('don_user');
    return u ? JSON.parse(u) : null;
  } catch {
    localStorage.removeItem('don_user');
    return null;
  }
}

function saveSession(data) {
  localStorage.setItem('don_token', data.token);
  localStorage.setItem('don_user', JSON.stringify(data.user));
  renderUserStatus();
}

function clearSession() {
  localStorage.removeItem('don_token');
  localStorage.removeItem('don_user');
}

function formatDateForApi(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO datum (2025-06-15) → "15. jun 2025." */
function formatDateSr(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('sr-RS', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric',
  });
}

function getStartOfWeek(date) {
  const d   = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* =========================
   HEADER / MOBILE MENU
========================= */

function initHeader() {
  const menuBtn = document.getElementById('menuBtn');
  const navMenu = document.getElementById('navMenu');

  menuBtn?.addEventListener('click', () => navMenu?.classList.toggle('show'));

  document.querySelectorAll('#navMenu a').forEach(link => {
    link.addEventListener('click', () => navMenu?.classList.remove('show'));
  });

  document.getElementById('mobileLogoutBtn')?.addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });

  document.getElementById('logoutProfileBtn')?.addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
}

function renderUserStatus() {
  const user = getLoggedUser();

  const adminBtn        = document.getElementById('adminNavBtn');
  const mobileAdminBtn  = document.getElementById('mobileAdminNavBtn');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  const logoutBtn       = document.getElementById('logoutBtn');

  if (!user) {
    if (adminBtn)        adminBtn.style.display = 'none';
    if (mobileAdminBtn)  mobileAdminBtn.classList.remove('admin-visible');
    if (mobileLogoutBtn) mobileLogoutBtn.classList.remove('show-mobile-logout');
    if (logoutBtn)       logoutBtn.style.display = 'none';
    return;
  }

  const role = String(user.role || '').trim().toLowerCase();

  if (adminBtn)        adminBtn.style.display = role === 'admin' ? 'inline-flex' : 'none';
  if (mobileAdminBtn)  mobileAdminBtn.classList.toggle('admin-visible', role === 'admin');
  if (mobileLogoutBtn) mobileLogoutBtn.classList.add('show-mobile-logout');
  if (logoutBtn)       logoutBtn.style.display = 'inline-flex';
}

/* =========================
   PUBLIC SETTINGS
========================= */

async function loadPublicSettings() {
  try {
    const response = await fetch(`${API_URL}/settings`);
    const data     = await response.json();
    if (!response.ok) return;

    const s = data.settings || {};

    // Sačuvaj globalno za upotrebu u cancelAppointment
    siteSettings.cancellation_fee_same_day = Number(s.cancellation_fee_same_day ?? 100);
    siteSettings.cancellation_fee_one_day  = Number(s.cancellation_fee_one_day  ?? 80);

    // Popuni footer / data-setting elemente
    const map = {
      salon_phone:        s.salon_phone        || '',
      salon_email:        s.salon_email        || '',
      salon_address:      s.salon_address      || '',
      work_monday_friday: s.work_monday_friday || '',
      work_saturday:      s.work_saturday      || '',
      work_sunday:        s.work_sunday        || '',
    };

    Object.entries(map).forEach(([key, value]) => {
      document.querySelectorAll(`[data-setting="${key}"]`).forEach(el => {
        el.textContent = value;
      });
    });

  } catch {
    // Backend nije dostupan — ostaju default vrednosti
  }
}

/* =========================
   SERVICES
========================= */

function getServiceImage(serviceName) {
  const n = String(serviceName || '').toLowerCase();
  if (n.includes('fade'))                           return 'images/fade.jpg';
  if (n.includes('brada'))                          return 'images/brada.jpg';
  if (n.includes('pranje'))                         return 'images/pranje.jpg';
  if (n.includes('farbanje') || n.includes('bojenje')) return 'images/farbanje.jpg';
  return 'images/sisanje.jpg';
}

async function loadServices() {
  const serviceSelect = document.getElementById('service');
  if (!serviceSelect) return;

  try {
    const response = await fetch(`${API_URL}/services`);
    const data     = await response.json();

    serviceSelect.innerHTML = '<option value="">Izaberi uslugu</option>';

    (data.services || []).forEach(service => {
      const opt      = document.createElement('option');
      opt.value      = service.id;
      opt.textContent = `${service.name} — ${service.duration_minutes} min — ${service.price} RSD`;
      serviceSelect.appendChild(opt);
    });

  } catch {
    serviceSelect.innerHTML = '<option value="">Greška pri učitavanju usluga</option>';
  }
}

async function loadHomepageServicesCards() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  grid.innerHTML = '';

  try {
    const response = await fetch(`${API_URL}/services`);
    const data     = await response.json();

    if (!response.ok) {
      grid.innerHTML = '<p>Greška pri učitavanju usluga.</p>';
      return;
    }

    (data.services || []).forEach(service => {
      const card       = document.createElement('article');
      card.className   = 'service-card';
      card.innerHTML   = `
        <div class="service-image">
          <img src="${getServiceImage(service.name)}" alt="${service.name}">
        </div>
        <div class="service-content">
          <h3>${service.name}</h3>
          <p>Trajanje: ${service.duration_minutes} minuta</p>
          <span>${service.price || 0} RSD</span>
        </div>
      `;
      grid.appendChild(card);
    });

  } catch {
    grid.innerHTML = '<p>Backend nije dostupan.</p>';
  }
}

function initServicesToggle() {
  const btn  = document.getElementById('toggleServicesBtn');
  const grid = document.getElementById('servicesGrid');
  if (!btn || !grid) return;

  btn.addEventListener('click', () => {
    grid.classList.toggle('collapsed');
    btn.textContent = grid.classList.contains('collapsed')
      ? 'Prikaži sve usluge'
      : 'Prikaži manje';
  });
}

/* =========================
   BOOKING
========================= */

function showBookingStep(stepNumber) {
  document.querySelectorAll('.form-step').forEach(step => {
    step.classList.toggle('active', step.dataset.step === String(stepNumber));
  });

  document.querySelectorAll('.booking-tabs .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.step === String(stepNumber));
  });
}

function renderCalendar() {
  const calendarTitle = document.getElementById('calendarTitle');
  const weekDays      = document.getElementById('weekDays');
  if (!calendarTitle || !weekDays) return;

  calendarTitle.textContent = currentWeekStart.toLocaleDateString('sr-RS', {
    month: 'long',
    year:  'numeric',
  });

  weekDays.innerHTML = '';

  const dayNames = ['PON', 'UTO', 'SRE', 'ČET', 'PET', 'SUB', 'NED'];

  for (let i = 0; i < 7; i++) {
    const date       = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    const dateForApi = formatDateForApi(date);

    const day = document.createElement('div');
    day.className = 'day-item';
    if (selectedDate === dateForApi) day.classList.add('selected');

    day.innerHTML = `
      <div class="day-name">${dayNames[i]}</div>
      <div class="day-number">${date.getDate()}</div>
    `;

    day.addEventListener('click', () => {
      selectedDate = dateForApi;
      selectedTime = null;
      renderCalendar();
      loadAvailableSlots();
    });

    weekDays.appendChild(day);
  }
}

async function loadAvailableSlots() {
  const timeGrid      = document.getElementById('timeGrid');
  const bookingMessage = document.getElementById('bookingMessage');
  if (!selectedDate || !timeGrid) return;

  const serviceId = document.getElementById('service')?.value;
  if (!serviceId) return;

  if (bookingMessage) bookingMessage.textContent = 'Učitavanje slobodnih termina...';

  try {
    const response = await fetch(
      `${API_URL}/appointments/available?date=${selectedDate}&serviceId=${serviceId}`
    );
    const data     = await response.json();
    const slots    = data.availableSlots || [];

    timeGrid.innerHTML = '';

    if (slots.length === 0) {
      if (bookingMessage) bookingMessage.textContent = 'Nema slobodnih termina za izabrani dan.';
      return;
    }

    slots.forEach(slot => {
      const btn   = document.createElement('button');
      btn.type    = 'button';
      btn.innerHTML = `
        <strong>${slot.start} – ${slot.end}</strong>
        <small>Slobodan termin</small>
      `;
      btn.addEventListener('click', () => {
        selectedTime = slot.start;
        document.querySelectorAll('.calendar-times button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      timeGrid.appendChild(btn);
    });

    if (bookingMessage) bookingMessage.textContent = '';

  } catch {
    if (bookingMessage) bookingMessage.textContent = 'Greška pri učitavanju termina.';
  }
}

function initBooking() {
  const bookingMessage = document.getElementById('bookingMessage');

  // Klik na "Nastavi" — FIX: proveri prijavu PRE prelaska na kalendar
  document.getElementById('goToCalendar')?.addEventListener('click', () => {
    const service = document.getElementById('service')?.value;

    if (!service) {
      if (bookingMessage) bookingMessage.textContent = 'Prvo izaberi uslugu.';
      return;
    }

    // Proveri da li je korisnik prijavljen
    const token = localStorage.getItem('don_token');
    if (!token) {
      if (bookingMessage) {
        bookingMessage.innerHTML =
          'Da biste zakazali termin, potrebno je da se ' +
          '<a href="profile.html" style="color:inherit;text-decoration:underline">prijavite ili napravite nalog</a>.';
        bookingMessage.className = 'booking-message error';
      }
      return;
    }

    if (bookingMessage) { bookingMessage.textContent = ''; bookingMessage.className = 'booking-message'; }

    selectedDate = formatDateForApi(new Date());
    selectedTime = null;

    showBookingStep(2);
    renderCalendar();
    loadAvailableSlots();
  });

  document.getElementById('prevWeek')?.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    selectedDate = formatDateForApi(currentWeekStart);
    selectedTime = null;
    renderCalendar();
    loadAvailableSlots();
  });

  document.getElementById('nextWeek')?.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    selectedDate = formatDateForApi(currentWeekStart);
    selectedTime = null;
    renderCalendar();
    loadAvailableSlots();
  });

  document.getElementById('bookingForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const token = localStorage.getItem('don_token');
    if (!token) {
      if (bookingMessage) bookingMessage.textContent = 'Morate biti prijavljeni da biste zakazali termin.';
      return;
    }

    if (!selectedDate || !selectedTime) {
      if (bookingMessage) bookingMessage.textContent = 'Izaberi dan i termin.';
      return;
    }

    try {
      const response = await fetch(`${API_URL}/appointments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          serviceId: document.getElementById('service').value,
          date:      selectedDate,
          time:      selectedTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (bookingMessage) bookingMessage.textContent = data.message || 'Greška pri zakazivanju termina.';
        return;
      }

      if (bookingMessage) {
        bookingMessage.textContent = 'Uspešno ste zakazali termin!';
        bookingMessage.className   = 'booking-message success';
      }

      loadMyAppointments();

      selectedDate = null;
      selectedTime = null;
      document.getElementById('bookingForm').reset();
      const timeGrid = document.getElementById('timeGrid');
      if (timeGrid) timeGrid.innerHTML = '';
      showBookingStep(1);

      setTimeout(() => {
        if (bookingMessage) { bookingMessage.textContent = ''; bookingMessage.className = 'booking-message'; }
      }, 5000);

    } catch {
      if (bookingMessage) bookingMessage.textContent = 'Greška pri zakazivanju termina.';
    }
  });
}

/* =========================
   APPOINTMENTS (prikaz na profilu)
========================= */

async function loadMyAppointments() {
  const token = localStorage.getItem('don_token');
  const list  = document.getElementById('myAppointmentsList');
  if (!token || !list) return;

  try {
    const response = await fetch(`${API_URL}/appointments/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data         = await response.json();
    const appointments = data.appointments || [];

    if (appointments.length === 0) {
      list.innerHTML = '<p>Nemate zakazane termine.</p>';
      return;
    }

    const now       = new Date();
    const future    = [];
    const past      = [];
    const cancelled = [];

    appointments.forEach(app => {
      const dt = new Date(`${app.appointment_date.slice(0, 10)}T${app.start_time.slice(0, 5)}`);
      if (app.status === 'cancelled') cancelled.push(app);
      else if (dt >= now)             future.push(app);
      else                            past.push(app);
    });

    list.innerHTML = `
      ${renderAppointmentGroup('Budući termini',   future,    true)}
      ${renderAppointmentGroup('Prošli termini',   past,      false)}
      ${renderAppointmentGroup('Otkazani termini', cancelled, false)}
    `;

  } catch {
    if (list) list.innerHTML = '<p>Greška pri učitavanju termina.</p>';
  }
}

function renderAppointmentGroup(title, appointments, allowCancel) {
  if (!appointments || appointments.length === 0) {
    return `
      <div class="profile-appointments-group">
        <h3>${title}</h3>
        <p class="empty-appointments">Nema termina.</p>
      </div>
    `;
  }

  const cards = appointments.map(app => {
    const statusText = app.status === 'booked' ? 'Zakazan' : 'Otkazan';

    // FIX: čitljiv srpski datum
    const dateFormatted = formatDateSr(app.appointment_date.slice(0, 10));

    // FIX: data atributi umesto inline onclick
    const cancelBtn = allowCancel && app.status === 'booked'
      ? `<button
           class="btn btn-dark cancel-appointment-btn"
           data-id="${app.id}"
           data-date="${app.appointment_date.slice(0, 10)}"
           data-price="${app.price || 0}"
         >Otkaži termin</button>`
      : '';

    const feeBlock = app.status === 'cancelled' && Number(app.cancellation_fee) > 0
      ? `<div class="cancel-fee">Naknada: ${app.cancellation_fee} RSD</div>`
      : '';

    return `
      <div class="appointment-card">
        <h3>${app.service_name}</h3>
        <p>${dateFormatted} | ${app.start_time.slice(0, 5)} – ${app.end_time.slice(0, 5)}</p>
        <p class="status-${app.status}">${statusText}</p>
        ${cancelBtn}
        ${feeBlock}
      </div>
    `;
  }).join('');

  return `
    <div class="profile-appointments-group">
      <h3>${title}</h3>
      ${cards}
    </div>
  `;
}

// FIX: naknada se čita iz siteSettings (učitana iz API-ja), ne hardkodirano
function openCancelModal(id, appointmentDate, price) {
  appointmentToCancel = id;

  const modal = document.getElementById('cancelModal');
  const text  = document.getElementById('cancelModalText');

  const today    = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const todayStr    = formatDateForApi(today);
  const tomorrowStr = formatDateForApi(tomorrow);

  let percent = 0;

  if (appointmentDate === todayStr) {
    percent = siteSettings.cancellation_fee_same_day;
  } else if (appointmentDate === tomorrowStr) {
    percent = siteSettings.cancellation_fee_one_day;
  }

  const fee = Math.round((Number(price) || 0) * percent / 100);

  if (text) {
    text.textContent = percent > 0
      ? `Ako sada otkažete termin, naknada je ${percent}% cene (${fee} RSD). Da li ste sigurni?`
      : 'Otkazivanje ovog termina je bez naknade. Da li ste sigurni?';
  }

  modal?.classList.add('active');
}

/* =========================
   PROFILE
========================= */

async function getCurrentUserFromDatabase() {
  const token = localStorage.getItem('don_token');
  if (!token) return null;

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok) { clearSession(); return null; }

    localStorage.setItem('don_user', JSON.stringify(data.user));
    return data.user;

  } catch {
    return null;
  }
}

async function renderProfilePage() {
  const profileInfo = document.getElementById('profileInfo');
  if (!profileInfo) return;

  const loginBlock   = document.getElementById('profileAuthBlock');
  const contentBlock = document.getElementById('profileContentBlock');
  const user         = await getCurrentUserFromDatabase();

  if (!user) {
    if (loginBlock)   loginBlock.style.display   = 'block';
    if (contentBlock) contentBlock.style.display = 'none';
    return;
  }

  if (loginBlock)   loginBlock.style.display   = 'none';
  if (contentBlock) contentBlock.style.display = 'block';

  const firstName = user.first_name || '';

  const welcomeTitle = document.getElementById('profileWelcomeTitle');
  const welcomeText  = document.getElementById('profileWelcomeText');
  if (welcomeTitle) welcomeTitle.textContent = `Dobro došli, ${firstName}`;
  if (welcomeText)  welcomeText.textContent  = 'Ovde možete videti svoje podatke i zakazane termine.';

  profileInfo.innerHTML = `
    <div class="profile-info-row"><strong>Ime</strong><span>${user.first_name || ''}</span></div>
    <div class="profile-info-row"><strong>Prezime</strong><span>${user.last_name || ''}</span></div>
    <div class="profile-info-row"><strong>Email</strong><span>${user.email || '-'}</span></div>
    <div class="profile-info-row"><strong>Telefon</strong><span>${user.phone || '-'}</span></div>
  `;

  const editFirstName = document.getElementById('editFirstName');
  if (editFirstName) {
    editFirstName.value = user.first_name || '';
    document.getElementById('editLastName').value = user.last_name || '';
    document.getElementById('editEmail').value    = user.email     || '';
    document.getElementById('editPhone').value    = user.phone     || '';
  }

  loadMyAppointments();
}

function initProfile() {

  // Edit profila
  document.getElementById('editProfileBtn')?.addEventListener('click', () => {
    const section = document.getElementById('editProfileSection');
    if (!section) return;
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
    const token = localStorage.getItem('don_token');
    if (!token) { showGlobalMessage('Morate biti prijavljeni.', 'error'); return; }

    const payload = {
      firstName: document.getElementById('editFirstName').value.trim(),
      lastName:  document.getElementById('editLastName').value.trim(),
      email:     document.getElementById('editEmail').value.trim(),
      phone:     document.getElementById('editPhone').value.trim(),
    };

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        showGlobalMessage(data.message || 'Greška pri izmeni podataka.', 'error');
        return;
      }

      localStorage.setItem('don_user', JSON.stringify(data.user));
      showGlobalMessage('Podaci su uspešno izmenjeni.');

      const editSection = document.getElementById('editProfileSection');
      if (editSection) editSection.style.display = 'none';

      renderUserStatus();
      renderProfilePage();

    } catch {
      showGlobalMessage('Backend nije pokrenut ili API nije dostupan.', 'error');
    }
  });

  // FIX: Event delegation za cancel dugme — umesto inline onclick / window.cancelAppointment
  document.getElementById('myAppointmentsList')?.addEventListener('click', e => {
    const btn = e.target.closest('.cancel-appointment-btn');
    if (btn) {
      openCancelModal(
        Number(btn.dataset.id),
        btn.dataset.date,
        Number(btn.dataset.price)
      );
    }
  });

  // Cancel modal — odustani
  document.getElementById('cancelModalNo')?.addEventListener('click', () => {
    appointmentToCancel = null;
    document.getElementById('cancelModal')?.classList.remove('active');
  });

  // Cancel modal — potvrdi
  document.getElementById('cancelModalYes')?.addEventListener('click', async () => {
    if (!appointmentToCancel) return;

    const token  = localStorage.getItem('don_token');
    const modal  = document.getElementById('cancelModal');
    const yesBtn = document.getElementById('cancelModalYes');

    try {
      if (yesBtn) { yesBtn.disabled = true; yesBtn.textContent = 'Otkazivanje...'; }

      const response = await fetch(`${API_URL}/appointments/${appointmentToCancel}/cancel`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        showGlobalMessage(data.message || 'Greška pri otkazivanju termina.', 'error');
        return;
      }

      showGlobalMessage(data.message || 'Termin je otkazan.');
      appointmentToCancel = null;
      modal?.classList.remove('active');

      loadMyAppointments();
      loadAvailableSlots();

    } catch {
      showGlobalMessage('Backend nije pokrenut ili API nije dostupan.', 'error');
    } finally {
      if (yesBtn) { yesBtn.disabled = false; yesBtn.textContent = 'Da, otkaži termin'; }
    }
  });
}

/* =========================
   AUTH — PROFILE PAGE
========================= */

function initProfileAuthForms() {

  document.getElementById('profileLoginForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const msg = document.getElementById('profileLoginMessage');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:    document.getElementById('profileLoginEmail').value.trim(),
          password: document.getElementById('profileLoginPassword').value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return setMessage(msg, data.message || 'Pogrešan email ili lozinka.', 'error');
      }

      saveSession(data);
      setMessage(msg, `Dobro došli, ${data.user.first_name}! Uspešno ste se prijavili.`);

      setTimeout(() => { renderProfilePage(); renderUserStatus(); }, 700);

    } catch {
      setMessage(msg, 'Backend nije pokrenut ili API nije dostupan.', 'error');
    }
  });

  document.getElementById('profileRegisterForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const msg = document.getElementById('profileRegisterMessage');

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          firstName: document.getElementById('profileFirstName').value.trim(),
          lastName:  document.getElementById('profileLastName').value.trim(),
          phone:     document.getElementById('profilePhone').value.trim(),
          email:     document.getElementById('profileEmail').value.trim(),
          password:  document.getElementById('profilePassword').value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return setMessage(msg, data.message || 'Registracija nije uspela.', 'error');
      }

      saveSession(data);
      setMessage(msg, `Dobro došli, ${data.user.first_name}! Nalog je uspešno napravljen.`);

      setTimeout(() => { renderProfilePage(); renderUserStatus(); }, 700);

    } catch {
      setMessage(msg, 'Backend nije pokrenut ili API nije dostupan.', 'error');
    }
  });
}

/* =========================
   INIT
========================= */

function initApp() {
  initHeader();
  initProfileAuthForms();
  initServicesToggle();
  initBooking();
  initProfile();

  renderUserStatus();
  renderProfilePage();

  loadPublicSettings();    // učitava naknadu iz API-ja
  loadServices();
  loadHomepageServicesCards();
  loadMyAppointments();
}

initApp();
