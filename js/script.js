const API_URL = 'http://localhost:5000/api';

const menuBtn = document.getElementById('menuBtn');
const navMenu = document.getElementById('navMenu');
const authMessage = document.getElementById('authMessage');
const loginMessage = document.getElementById('loginMessage');
const userStatus = document.getElementById('userStatus');
const logoutMessage =
  sessionStorage.getItem('logoutMessage');

if (logoutMessage) {

  alert(logoutMessage);

  sessionStorage.removeItem('logoutMessage');
}

menuBtn?.addEventListener('click', () => {
  navMenu?.classList.toggle('show');
});

document.querySelectorAll('#navMenu a').forEach(link => {
  link.addEventListener('click', () => {
    navMenu?.classList.remove('show');
  });
});

function setMessage(element, text, type = 'success') {
  if (!element) return;
  element.textContent = text;
  element.className = type === 'error' ? 'auth-message error' : 'auth-message success';
}

function showGlobalMessage(text, type = 'success') {
  let messageBox = document.getElementById('globalMessage');

  if (!messageBox) {
    messageBox = document.createElement('div');
    messageBox.id = 'globalMessage';
    document.body.prepend(messageBox);
  }

  messageBox.textContent = text;
  messageBox.className =
    type === 'error'
      ? 'global-message error'
      : 'global-message success';

  messageBox.style.display = 'block';

  setTimeout(() => {
    messageBox.style.display = 'none';
  }, 4000);
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

  const loginBtn = document.getElementById('loginNavBtn');
  const profileBtn = document.getElementById('profileNavBtn');
  const logoutBtn = document.getElementById('logoutProfileBtn');
  const adminBtn = document.getElementById('adminNavBtn');
  const mobileAdminBtn = document.getElementById('mobileAdminNavBtn');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';

    if (profileBtn) {
      profileBtn.style.display = 'inline-flex';

      const firstName = user.first_name || user.firstName || '';
      const lastName = user.last_name || user.lastName || '';

      profileBtn.title = `${firstName} ${lastName}`;
    }

    if (logoutBtn) {
      logoutBtn.style.display = 'inline-flex';
    }

    const role = String(user.role || '').trim().toLowerCase();

    if (adminBtn) {
      adminBtn.style.display = role === 'admin' ? 'inline-flex' : 'none';
    }

    if (mobileAdminBtn) {
      mobileAdminBtn.style.display = role === 'admin' ? 'inline-flex' : 'none';
    }

    if (mobileLogoutBtn) {
      mobileLogoutBtn.classList.add('show-mobile-logout');
    }

  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (profileBtn) profileBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
    if (mobileAdminBtn) mobileAdminBtn.style.display = 'none';
    if (mobileLogoutBtn) {
      mobileLogoutBtn.classList.remove('show-mobile-logout');
    }
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
    password: document.getElementById('loginPassword').value
  };

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showGlobalMessage(
        data.message || 'Pogrešan email ili lozinka.',
        'error'
      );

      setMessage(
        loginMessage,
        data.message || 'Pogrešan email ili lozinka.',
        'error'
      );

      return;
    }

    saveSession(data);

    loginForm.reset();

    const firstName =
      data.user.first_name || data.user.firstName || '';

    // showGlobalMessage(
    //   `Dobro došli, ${firstName}! Uspešno ste se prijavili.`
    // );

    // setMessage(
    //   loginMessage,
    //   `Dobro došli, ${firstName}! Uspešno ste se prijavili.`
    // );

    renderUserStatus();
    renderWelcomeBanner();

  } catch (error) {
    showGlobalMessage(
      'Backend nije pokrenut ili API nije dostupan.',
      'error'
    );

    setMessage(
      loginMessage,
      'Backend nije pokrenut ili API nije dostupan.',
      'error'
    );
  }
});

/* Booking calendar */

const bookingForm = document.getElementById('bookingForm');
const bookingMessage = document.getElementById('bookingMessage');
const timeGrid = document.getElementById('timeGrid');
const weekDays = document.getElementById('weekDays');
const calendarTitle = document.getElementById('calendarTitle');
const tabs = document.querySelectorAll('.booking-tabs .tab');

let selectedDate = null;
let selectedTime = null;
let currentWeekStart = getStartOfWeek(new Date());

const allTimes = [
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '16:45',
  '17:00'
];

function showBookingStep(stepNumber) {
  document.querySelectorAll('.form-step').forEach(step => {
    step.classList.toggle('active', step.dataset.step === String(stepNumber));
  });

  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.step === String(stepNumber));
  });
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateForApi(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function renderCalendar() {
  if (!calendarTitle || !weekDays) return;

  const monthName = currentWeekStart.toLocaleDateString('sr-RS', {
    month: 'long',
    year: 'numeric'
  });

  calendarTitle.innerHTML = `${monthName}`;
  weekDays.innerHTML = '';

  const dayNames = ['PON', 'UTO', 'SRE', 'ČET', 'PET', 'SUB', 'NED'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);

    const dateForApi = formatDateForApi(date);

    const day = document.createElement('div');
    day.className = 'day-item';

    if (selectedDate === dateForApi) {
      day.classList.add('selected');
    }

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
  if (!selectedDate || !timeGrid) return;

  const serviceId = document.getElementById('service').value;
  if (!serviceId) return;

  bookingMessage.textContent = 'Učitavanje slobodnih termina...';

  try {
    const response = await fetch(
      `${API_URL}/appointments/available?date=${selectedDate}&serviceId=${serviceId}`
    );

    const data = await response.json();
    const availableSlots = data.availableSlots || [];

    timeGrid.innerHTML = '';

    if (availableSlots.length === 0) {
      bookingMessage.textContent = 'Nema slobodnih termina za izabrani dan.';
      return;
    }

    availableSlots.forEach(slot => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = `
        <strong>${slot.start} - ${slot.end}</strong>
        <small>Slobodan termin</small>
      `;

      btn.addEventListener('click', () => {
        selectedTime = slot.start;

        document
          .querySelectorAll('.calendar-times button')
          .forEach(button => button.classList.remove('selected'));

        btn.classList.add('selected');
      });

      timeGrid.appendChild(btn);
    });

    bookingMessage.textContent = '';
  } catch (error) {
    bookingMessage.textContent = 'Greška pri učitavanju termina.';
  }
}

async function loadServices() {
  const serviceSelect = document.getElementById('service');

  if (!serviceSelect) return;

  try {
    const response = await fetch(`${API_URL}/services`);
    const data = await response.json();

    serviceSelect.innerHTML = '<option value="">Izaberi uslugu</option>';

    data.services.forEach(service => {
      const option = document.createElement('option');
      option.value = service.id;
      option.textContent = `${service.name} - ${service.duration_minutes} min - ${service.price} RSD`;
      serviceSelect.appendChild(option);
    });
  } catch (error) {
    serviceSelect.innerHTML = '<option value="">Greška pri učitavanju usluga</option>';
  }
}

document.getElementById('goToCalendar')?.addEventListener('click', () => {
  const service = document.getElementById('service').value;

  if (!service) {
    bookingMessage.textContent = 'Prvo izaberi uslugu.';
    return;
  }

  bookingMessage.textContent = '';

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

  try {
    const response = await fetch(`${API_URL}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        serviceId: document.getElementById('service').value,
        date: selectedDate,
        time: selectedTime
      })
    });

    const data = await response.json();
    bookingMessage.textContent = response.ok
      ? 'Uspešno ste zakazali termin.'
      : data.message;

    if (response.ok) {
      bookingMessage.textContent = 'Uspešno ste zakazali termin.';

      loadMyAppointments();

      selectedDate = null;
      selectedTime = null;

      bookingForm.reset();
      timeGrid.innerHTML = '';

      showBookingStep(1);

      setTimeout(() => {
        bookingMessage.textContent = '';
      }, 5000);
    }
  } catch (error) {
    bookingMessage.textContent = 'Greška pri zakazivanju termina.';
  }
});

async function loadMyAppointments() {
  const token = localStorage.getItem('don_token');
  const list = document.getElementById('myAppointmentsList');

  if (!token || !list) return;

  try {
    const response = await fetch(`${API_URL}/appointments/my`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    const appointments = data.appointments || [];

    if (appointments.length === 0) {
      list.innerHTML = '<p>Nemate zakazane termine.</p>';
      return;
    }

    const now = new Date();

    const future = [];
    const past = [];
    const cancelled = [];

    appointments.forEach(app => {
      const datePart = app.appointment_date.slice(0, 10);
      const timePart = app.start_time.slice(0, 5);

      const appointmentDateTime =
        new Date(`${datePart}T${timePart}`);

      if (app.status === 'cancelled') {
        cancelled.push(app);
      } else if (appointmentDateTime >= now) {
        future.push(app);
      } else {
        past.push(app);
      }
    });

    list.innerHTML = `
      ${renderAppointmentGroup('Budući termini', future, true)}
      ${renderAppointmentGroup('Prošli termini', past, false)}
      ${renderAppointmentGroup('Otkazani termini', cancelled, false)}
    `;

  } catch (error) {
    list.innerHTML = '<p>Greška pri učitavanju termina.</p>';
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
    const statusText =
      app.status === 'booked'
        ? 'Zakazan'
        : 'Otkazan';

    const cancelButton =
      allowCancel && app.status === 'booked'
        ? `<button 
            class="btn btn-dark" 
            onclick="cancelAppointment(${app.id}, '${app.appointment_date.slice(0, 10)}', ${app.price || 0})"
          >
            Otkaži termin
          </button>`
        : '';

    const cancellationFee =
      app.status === 'cancelled'
        ? `<div class="cancel-fee">
             Naknada: ${app.cancellation_fee || 0} RSD
           </div>`
        : '';

    return `
      <div class="appointment-card">
        <h3>${app.service_name}</h3>

        <p>
          ${app.appointment_date.slice(0, 10)}
          |
          ${app.start_time.slice(0, 5)} - ${app.end_time.slice(0, 5)}
        </p>

        <p class="status-${app.status}">
          ${statusText}
        </p>

        ${cancelButton}
        ${cancellationFee}
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

// async function cancelAppointment(id) {
//   const token = localStorage.getItem('don_token');

//   const confirmed = confirm(
//     'Da li ste sigurni da želite da otkažete termin? Ako otkazujete na dan termina naplaćuje se 100%, a dan pre 80% cene.'
//   );

//   if (!confirmed) return;

//   const response = await fetch(`${API_URL}/appointments/${id}/cancel`, {
//     method: 'PATCH',
//     headers: {
//       Authorization: `Bearer ${token}`
//     }
//   });

//   const data = await response.json();

//   alert(data.message);

//   loadMyAppointments();
//   loadAvailableSlots();
// }

let appointmentToCancel = null;

function cancelAppointment(id, appointmentDate, price) {
  appointmentToCancel = id;

  const modal = document.getElementById('cancelModal');
  const text = document.getElementById('cancelModalText');

  const today = new Date();
  const tomorrow = new Date();

  tomorrow.setDate(today.getDate() + 1);

  const todayString = formatDateLocal(today);
  const tomorrowString = formatDateLocal(tomorrow);

  let percent = 0;

  if (appointmentDate === todayString) {
    percent = 100;
  } else if (appointmentDate === tomorrowString) {
    percent = 80;
  }

  const fee = Math.round((Number(price) || 0) * percent / 100);

  if (text) {
    if (percent > 0) {
      text.textContent =
        `Ako sada otkažete termin, naknada je ${percent}% cene, odnosno ${fee} RSD. Da li ste sigurni?`;
    } else {
      text.textContent =
        'Otkazivanje ovog termina je bez naknade. Da li ste sigurni?';
    }
  }

  if (modal) {
    modal.classList.add('active');
  }
}

function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

async function getCurrentUserFromDatabase() {
  const token = localStorage.getItem('don_token');

  if (!token) return null;

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      localStorage.removeItem('don_token');
      localStorage.removeItem('don_user');
      return null;
    }

    localStorage.setItem('don_user', JSON.stringify(data.user));

    return data.user;
  } catch (error) {
    return null;
  }
}

async function renderProfilePage() {
  const profileInfo = document.getElementById('profileInfo');

  if (!profileInfo) return;

  const loginBlock = document.getElementById('profileAuthBlock');
  const contentBlock = document.getElementById('profileContentBlock');

  const user = await getCurrentUserFromDatabase();

  if (!user) {
    if (loginBlock) loginBlock.style.display = 'block';
    if (contentBlock) contentBlock.style.display = 'none';
    return;
  }

  if (loginBlock) loginBlock.style.display = 'none';
  if (contentBlock) contentBlock.style.display = 'block';

  const firstName = user.first_name || user.firstName || '';

  document.getElementById('profileWelcomeTitle').textContent =
    `Dobro došli, ${firstName}`;

  document.getElementById('profileWelcomeText').textContent =
    'Ovde možete videti svoje podatke i zakazane termine.';

  profileInfo.innerHTML = `
    <div class="profile-info-row">
      <strong>Ime</strong>
      <span>${user.first_name || user.firstName}</span>
    </div>

    <div class="profile-info-row">
      <strong>Prezime</strong>
      <span>${user.last_name || user.lastName}</span>
    </div>

    <div class="profile-info-row">
      <strong>Email</strong>
      <span>${user.email}</span>
    </div>

    <div class="profile-info-row">
      <strong>Telefon</strong>
      <span>${user.phone || '-'}</span>
    </div>
  `;

  const firstNameInput = document.getElementById('editFirstName');

  if (firstNameInput) {
    document.getElementById('editFirstName').value =
      user.first_name || user.firstName || '';

    document.getElementById('editLastName').value =
      user.last_name || user.lastName || '';

    document.getElementById('editEmail').value =
      user.email || '';

    document.getElementById('editPhone').value =
      user.phone || '';
  }

  loadMyAppointments();
}

function renderWelcomeBanner() {
  const user = getLoggedUser();
  const banner = document.getElementById('welcomeBanner');

  if (!banner || !user) return;

  banner.innerHTML = `
    Dobro došli, <strong>${user.first_name || user.firstName}</strong>
  `;
}

renderWelcomeBanner();
renderProfilePage();

document.getElementById('editProfileBtn')
  ?.addEventListener('click', () => {

    const section =
      document.getElementById('editProfileSection');

    section.style.display =
      section.style.display === 'none'
        ? 'block'
        : 'none';
});

document.getElementById('logoutProfileBtn')?.addEventListener('click', () => {
  localStorage.removeItem('don_token');
  localStorage.removeItem('don_user');

  // sessionStorage.setItem(
  //   'logoutMessage',
  //   'Uspešno ste se odjavili.'
  // );

  window.location.href = 'index.html';
});
document
  .getElementById('profileLoginForm')
  ?.addEventListener('submit', async (event) => {

    event.preventDefault();

    const response = await fetch(
      `${API_URL}/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type':'application/json'
        },
        body: JSON.stringify({
          email: document.getElementById('profileLoginEmail').value,
          password: document.getElementById('profileLoginPassword').value
        })
      }
    );

    const data = await response.json();

    if(response.ok){

      saveSession(data);

      location.reload();

    } else {

      document.getElementById('profileLoginMessage').textContent =
        data.message || 'Pogrešan email ili lozinka.';
    }
});

renderUserStatus();
loadServices();
loadMyAppointments();

document
  .getElementById('profileRegisterForm')
  ?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: document.getElementById('profileFirstName').value.trim(),
        lastName: document.getElementById('profileLastName').value.trim(),
        phone: document.getElementById('profilePhone').value.trim(),
        email: document.getElementById('profileEmail').value.trim(),
        password: document.getElementById('profilePassword').value
      })
    });

    const data = await response.json();
    const msg = document.getElementById('profileRegisterMessage');

    if (!response.ok) {
      return setMessage(msg, data.message || 'Registracija nije uspela.', 'error');
    }

    saveSession(data);
    setMessage(msg, 'Nalog je uspešno napravljen.');
    
    setTimeout(() => {
      location.reload();
    }, 1000);
  });

  document
  .getElementById('profileLoginForm')
  ?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const msg = document.getElementById('profileLoginMessage');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: document.getElementById('profileLoginEmail').value.trim(),
          password: document.getElementById('profileLoginPassword').value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return setMessage(
          msg,
          data.message || 'Pogrešan email ili lozinka.',
          'error'
        );
      }

      saveSession(data);

      setMessage(
        msg,
        `Dobro došli, ${data.user.first_name || data.user.firstName}! Uspešno ste se prijavili.`
      );

      setTimeout(() => {
        renderProfilePage();
        renderUserStatus();
      }, 700);

    } catch (error) {
      setMessage(msg, 'Backend nije pokrenut ili API nije dostupan.', 'error');
    }
  });

  document
  .getElementById('profileRegisterForm')
  ?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const msg = document.getElementById('profileRegisterMessage');

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: document.getElementById('profileFirstName').value.trim(),
          lastName: document.getElementById('profileLastName').value.trim(),
          phone: document.getElementById('profilePhone').value.trim(),
          email: document.getElementById('profileEmail').value.trim(),
          password: document.getElementById('profilePassword').value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return setMessage(
          msg,
          data.message || 'Registracija nije uspela.',
          'error'
        );
      }

      saveSession(data);

      setMessage(
        msg,
        `Dobro došli, ${data.user.first_name || data.user.firstName}! Nalog je uspešno napravljen.`
      );

      setTimeout(() => {
        renderProfilePage();
        renderUserStatus();
      }, 700);

    } catch (error) {
      setMessage(msg, 'Backend nije pokrenut ili API nije dostupan.', 'error');
    }
  });

const toggleServicesBtn =
document.getElementById('toggleServicesBtn');

const servicesGrid =
  document.getElementById('servicesGrid');

toggleServicesBtn?.addEventListener('click', () => {
  servicesGrid.classList.toggle('collapsed');

  const isCollapsed =
    servicesGrid.classList.contains('collapsed');

  toggleServicesBtn.textContent =
    isCollapsed
      ? 'Prikaži sve usluge'
      : 'Prikaži manje';
});

document.getElementById('saveProfileBtn')?.addEventListener('click', async (event) => {
  event.preventDefault();

  const token = localStorage.getItem('don_token');

  if (!token) {
    showGlobalMessage('Morate biti prijavljeni.', 'error');
    return;
  }

  const payload = {
    firstName: document.getElementById('editFirstName').value.trim(),
    lastName: document.getElementById('editLastName').value.trim(),
    email: document.getElementById('editEmail').value.trim(),
    phone: document.getElementById('editPhone').value.trim()
  };

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showGlobalMessage(
        data.message || 'Greška pri izmeni podataka.',
        'error'
      );
      return;
    }

    localStorage.setItem('don_user', JSON.stringify(data.user));

    showGlobalMessage('Podaci su uspešno izmenjeni.');

    const editSection = document.getElementById('editProfileSection');

    if (editSection) {
      editSection.style.display = 'none';
    }

    renderUserStatus();
    renderProfilePage();

  } catch (error) {
    showGlobalMessage(
      'Backend nije pokrenut ili API nije dostupan.',
      'error'
    );
  }
});

document.getElementById('cancelModalNo')?.addEventListener('click', () => {
  appointmentToCancel = null;

  document.getElementById('cancelModal')?.classList.remove('active');
});

document.getElementById('cancelModalYes')?.addEventListener('click', async () => {
  if (!appointmentToCancel) return;

  const token = localStorage.getItem('don_token');

  try {
    const response = await fetch(`${API_URL}/appointments/${appointmentToCancel}/cancel`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      showGlobalMessage(
        data.message || 'Greška pri otkazivanju termina.',
        'error'
      );
      return;
    }

    showGlobalMessage(data.message || 'Termin je otkazan.');

    appointmentToCancel = null;

    document.getElementById('cancelModal')?.classList.remove('active');

    loadMyAppointments();

  } catch (error) {
    showGlobalMessage(
      'Backend nije pokrenut ili API nije dostupan.',
      'error'
    );
  }
});

function getServiceImage(serviceName) {
  const name = serviceName.toLowerCase();

  if (name.includes('fade')) {
    return 'images/fade.jpg';
  }

  if (name.includes('brada')) {
    return 'images/brada.jpg';
  }

  if (name.includes('pranje')) {
    return 'images/pranje.jpg';
  }

  if (name.includes('farbanje') || name.includes('bojenje')) {
    return 'images/farbanje.jpg';
  }

  return 'images/sisanje.jpg';
}

async function loadHomepageServicesCards() {
  const servicesGrid = document.getElementById('servicesGrid');

  if (!servicesGrid) return;

  servicesGrid.innerHTML = '';

  try {
    const response = await fetch(`${API_URL}/services`);
    const data = await response.json();

    if (!response.ok) {
      servicesGrid.innerHTML = '<p>Greška pri učitavanju usluga.</p>';
      return;
    }

    data.services.forEach(service => {
      const card = document.createElement('article');
      card.className = 'service-card';

      card.innerHTML = `
        <div class="service-image">
          <img src="${getServiceImage(service.name)}" alt="${service.name}">
        </div>

        <div class="service-content">
          <h3>${service.name}</h3>
          <p>Trajanje: ${service.duration_minutes} minuta</p>
          <span>${service.price || 0} RSD</span>
        </div>
      `;

      servicesGrid.appendChild(card);
    });

  } catch (error) {
    servicesGrid.innerHTML = '<p>Backend nije dostupan.</p>';
  }
}

document.getElementById('mobileLogoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('don_token');
  localStorage.removeItem('don_user');

  window.location.href = 'index.html';
});

renderUserStatus();
loadHomepageServicesCards();