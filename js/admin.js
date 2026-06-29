const API_URL = window.API_URL || 'http://localhost:5000/api';

/* =========================
   STATE
========================= */

const token = localStorage.getItem('don_token');
const user = getStoredUser();

let adminCalendarStats = {};
let currentMonth = new Date();
let selectedDate = formatDateForApi(new Date());

/* =========================
   ELEMENTS
========================= */

const adminMonthGrid = document.getElementById('adminMonthGrid');
const adminMonthTitle = document.getElementById('adminMonthTitle');
const selectedDayTitle = document.getElementById('selectedDayTitle');
const adminAppointmentsList = document.getElementById('adminAppointmentsList');

const manualService = document.getElementById('manualService');
const editService = document.getElementById('editService');

const adminMessage = document.getElementById('adminMessage');
const adminServicesList = document.getElementById('adminServicesList');
const adminServiceForm = document.getElementById('adminServiceForm');

const editAppointmentForm = document.getElementById('editAppointmentForm');
const editAppointmentBox = document.getElementById('editAppointmentBox');

const statBookedToday = document.getElementById('statBookedToday');
const statCancelledToday = document.getElementById('statCancelledToday');
const statRevenueToday = document.getElementById('statRevenueToday');
const statBlocksToday = document.getElementById('statBlocksToday');

/* =========================
   HELPERS
========================= */

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('don_user') || 'null');
  } catch (error) {
    localStorage.removeItem('don_user');
    return null;
  }
}

function checkAdminAccess() {
  if (!token || !user || user.role !== 'admin') {
    alert('Nemate pristup admin panelu.');
    window.location.href = 'index.html';
    return false;
  }

  return true;
}

function logoutAdmin() {
  localStorage.removeItem('don_token');
  localStorage.removeItem('don_user');

  window.location.href = 'index.html';
}

function formatDateForApi(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString('sr-RS', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function showAdminMessage(text, type = 'success') {
  if (!adminMessage) {
    console.log(text);
    return;
  }

  adminMessage.textContent = text;
  adminMessage.className =
    type === 'error'
      ? 'auth-message error'
      : 'auth-message success';

  setTimeout(() => {
    adminMessage.textContent = '';
  }, 3500);
}

async function adminFetch(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));

  return {
    response,
    data
  };
}

/* =========================
   CALENDAR
========================= */

function renderAdminCalendar() {
  if (!adminMonthGrid || !adminMonthTitle || !selectedDayTitle) return;

  adminMonthGrid.innerHTML = '';

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthTitle = currentMonth.toLocaleDateString('sr-RS', {
    month: 'long',
    year: 'numeric'
  });

  adminMonthTitle.textContent =
    monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'admin-calendar-day empty';
    adminMonthGrid.appendChild(empty);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dateForApi = formatDateForApi(date);
    const dayOfWeek = date.getDay();

    const dayButton = document.createElement('button');
    dayButton.type = 'button';
    dayButton.className = 'admin-calendar-day';
    dayButton.dataset.date = dateForApi;

    if (dateForApi === selectedDate) {
      dayButton.classList.add('selected');
    }

    if (dateForApi === formatDateForApi(new Date())) {
      dayButton.classList.add('today');
    }

    if (dayOfWeek === 0) {
      dayButton.classList.add('closed-day');
    }

    dayButton.innerHTML = `
      <strong>${day}</strong>
      <span>${dayOfWeek === 0 ? 'Neradno' : 'Radni dan'}</span>
    `;

    dayButton.addEventListener('click', () => {
      selectedDate = dateForApi;

      renderAdminCalendar();
      loadAdminAppointments();
    });

    adminMonthGrid.appendChild(dayButton);
  }

  selectedDayTitle.textContent = formatDateForDisplay(selectedDate);

  loadAdminStats(year, month + 1);
}

function paintCalendarStats() {
  document.querySelectorAll('.admin-calendar-day[data-date]').forEach(day => {
    const date = day.dataset.date;
    const stats = adminCalendarStats[date];

    const oldBadge = day.querySelector('.calendar-day-stats');
    if (oldBadge) oldBadge.remove();

    if (!stats) return;

    const badge = document.createElement('div');
    badge.className = 'calendar-day-stats';

    badge.innerHTML = `
      ${stats.booked > 0 ? `<span>${stats.booked} termina</span>` : ''}
      ${stats.blocks > 0 ? `<span>${stats.blocks} blokada</span>` : ''}
    `;

    day.appendChild(badge);
  });
}

async function loadAdminStats(year, month) {
  try {
    const { response, data } = await adminFetch(
      `/admin/stats?year=${year}&month=${month}`
    );

    if (!response.ok) return;

    if (statBookedToday) {
      statBookedToday.textContent = data.today.bookedToday;
    }

    if (statCancelledToday) {
      statCancelledToday.textContent = data.today.cancelledToday;
    }

    if (statRevenueToday) {
      statRevenueToday.textContent = `${data.today.revenueToday} RSD`;
    }

    if (statBlocksToday) {
      statBlocksToday.textContent = data.today.blocksToday;
    }

    adminCalendarStats = {};

    (data.monthAppointments || []).forEach(item => {
      adminCalendarStats[item.date] = {
        booked: Number(item.booked_count || 0),
        cancelled: Number(item.cancelled_count || 0),
        blocks: 0
      };
    });

    (data.monthBlocks || []).forEach(item => {
      if (!adminCalendarStats[item.date]) {
        adminCalendarStats[item.date] = {
          booked: 0,
          cancelled: 0,
          blocks: 0
        };
      }

      adminCalendarStats[item.date].blocks =
        Number(item.blocks_count || 0);
    });

    paintCalendarStats();

  } catch (error) {
    console.error(error);
  }
}

/* =========================
   APPOINTMENTS AND BLOCKS
========================= */

async function loadAdminAppointments() {
  if (!adminAppointmentsList || !selectedDayTitle) return;

  selectedDayTitle.textContent = formatDateForDisplay(selectedDate);

  adminAppointmentsList.innerHTML =
    '<p class="admin-empty">Učitavanje termina...</p>';

  try {
    const { response, data } = await adminFetch(
      `/admin/appointments?date=${selectedDate}`
    );

    if (!response.ok) {
      adminAppointmentsList.innerHTML =
        `<p class="admin-empty">${data.message || 'Greška pri učitavanju termina.'}</p>`;
      return;
    }

    const appointments = data.appointments || [];
    const blocks = data.blocks || [];

    adminAppointmentsList.innerHTML = '';

    if (appointments.length === 0 && blocks.length === 0) {
      adminAppointmentsList.innerHTML =
        '<p class="admin-empty">Za ovaj dan nema termina ni blokada.</p>';
      return;
    }

    blocks.forEach(block => {
      adminAppointmentsList.appendChild(createBlockCard(block));
    });

    appointments.forEach(appointment => {
      adminAppointmentsList.appendChild(createAppointmentCard(appointment, appointments));
    });

  } catch (error) {
    adminAppointmentsList.innerHTML =
      '<p class="admin-empty">Greška pri učitavanju termina.</p>';
  }
}

function createBlockCard(block) {
  const card = document.createElement('div');
  card.className = 'admin-appointment-card blocked';

  card.innerHTML = `
    <div class="admin-appointment-main">
      <div>
        <h3>${block.start_time.slice(0, 5)} - ${block.end_time.slice(0, 5)}</h3>
        <p>Blokirano vreme</p>
      </div>

      <span class="admin-status blocked">
        Blokirano
      </span>
    </div>

    <div class="admin-appointment-info">
      <p><strong>Razlog:</strong> ${block.reason || '-'}</p>
    </div>

    <button class="btn btn-dark admin-delete-block-btn" data-id="${block.id}">
      Ukloni blokadu
    </button>
  `;

  card.querySelector('.admin-delete-block-btn')?.addEventListener('click', async () => {
    await deleteBlockedSlot(block.id);
  });

  return card;
}

function createAppointmentCard(app) {
  const customerName =
    app.manual_customer_name ||
    `${app.first_name || ''} ${app.last_name || ''}`.trim() ||
    'Nepoznata mušterija';

  const customerPhone =
    app.manual_customer_phone ||
    app.phone ||
    '-';

  const statusText =
    app.status === 'booked'
      ? 'Zakazan'
      : 'Otkazan';

  const card = document.createElement('div');
  card.className = 'admin-appointment-card';

  if (app.status === 'cancelled') {
    card.classList.add('cancelled');
  }

  card.innerHTML = `
    <div class="admin-appointment-main">
      <div>
        <h3>${app.start_time.slice(0, 5)} - ${app.end_time.slice(0, 5)}</h3>
        <p>${app.service_name || '-'}</p>
      </div>

      <span class="admin-status ${app.status}">
        ${statusText}
      </span>
    </div>

    <div class="admin-appointment-info">
      <p><strong>Mušterija:</strong> ${customerName}</p>
      <p><strong>Telefon:</strong> ${customerPhone}</p>
      <p><strong>Email:</strong> ${app.manual_customer_email || app.email || '-'}</p>
      <p><strong>Cena:</strong> ${app.price || 0} RSD</p>
      ${app.note ? `<p><strong>Napomena:</strong> ${app.note}</p>` : ''}
      ${
        app.cancellation_fee && Number(app.cancellation_fee) > 0
          ? `<p><strong>Naknada:</strong> ${app.cancellation_fee} RSD</p>`
          : ''
      }
    </div>

    ${
      app.status === 'booked'
        ? `
          <div class="admin-card-actions">
            <button class="btn btn-gold admin-edit-btn" data-id="${app.id}">
              Izmeni
            </button>

            <button class="btn btn-dark admin-cancel-btn" data-id="${app.id}">
              Otkaži termin
            </button>
          </div>
        `
        : ''
    }
  `;

  card.querySelector('.admin-cancel-btn')?.addEventListener('click', async () => {
    await cancelAdminAppointment(app.id);
  });

  card.querySelector('.admin-edit-btn')?.addEventListener('click', () => {
    openEditAppointmentForm(app);
  });

  return card;
}

async function cancelAdminAppointment(id) {
  const confirmed = confirm(
    'Da li ste sigurni da želite da otkažete ovaj termin?'
  );

  if (!confirmed) return;

  const { response, data } = await adminFetch(
    `/admin/appointments/${id}/cancel`,
    {
      method: 'PATCH'
    }
  );

  if (!response.ok) {
    return showAdminMessage(
      data.message || 'Greška pri otkazivanju termina.',
      'error'
    );
  }

  showAdminMessage(data.message || 'Termin je otkazan.');

  renderAdminCalendar();
  loadAdminAppointments();
}

async function deleteBlockedSlot(id) {
  const confirmed = confirm('Da li želite da uklonite ovu blokadu?');

  if (!confirmed) return;

  const { response, data } = await adminFetch(
    `/admin/blocks/${id}`,
    {
      method: 'DELETE'
    }
  );

  if (!response.ok) {
    return showAdminMessage(
      data.message || 'Greška pri uklanjanju blokade.',
      'error'
    );
  }

  showAdminMessage(data.message || 'Blokada je uklonjena.');

  renderAdminCalendar();
  loadAdminAppointments();
}

function initAppointmentForms() {
  document
    .getElementById('manualAppointmentForm')
    ?.addEventListener('submit', async event => {
      event.preventDefault();

      const payload = {
        customerName: document.getElementById('manualCustomerName').value.trim(),
        customerPhone: document.getElementById('manualCustomerPhone').value.trim(),
        customerEmail: document.getElementById('manualCustomerEmail').value.trim(),
        serviceId: manualService.value,
        date: selectedDate,
        time: document.getElementById('manualTime').value,
        note: document.getElementById('manualNote').value.trim()
      };

      const { response, data } = await adminFetch(
        '/admin/appointments/manual',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        return showAdminMessage(
          data.message || 'Greška pri dodavanju termina.',
          'error'
        );
      }

      showAdminMessage('Termin je uspešno dodat.');

      document.getElementById('manualAppointmentForm').reset();

      renderAdminCalendar();
      loadAdminAppointments();
    });

  document
    .getElementById('blockTimeForm')
    ?.addEventListener('submit', async event => {
      event.preventDefault();

      const payload = {
        date: selectedDate,
        startTime: document.getElementById('blockStartTime').value,
        endTime: document.getElementById('blockEndTime').value,
        reason: document.getElementById('blockReason').value.trim()
      };

      const { response, data } = await adminFetch(
        '/admin/blocks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        return showAdminMessage(
          data.message || 'Greška pri blokiranju vremena.',
          'error'
        );
      }

      showAdminMessage('Vreme je uspešno blokirano.');

      document.getElementById('blockTimeForm').reset();

      renderAdminCalendar();
      loadAdminAppointments();
    });
}

function openEditAppointmentForm(app) {
  if (!editAppointmentBox) return;

  const customerName =
    app.manual_customer_name ||
    `${app.first_name || ''} ${app.last_name || ''}`.trim();

  const customerPhone =
    app.manual_customer_phone ||
    app.phone ||
    '';

  document.getElementById('editAppointmentId').value = app.id;
  document.getElementById('editCustomerName').value = customerName;
  document.getElementById('editCustomerPhone').value = customerPhone;
  document.getElementById('editService').value = app.service_id;
  document.getElementById('editDate').value = app.appointment_date.slice(0, 10);
  document.getElementById('editTime').value = app.start_time.slice(0, 5);
  document.getElementById('editNote').value = app.note || '';

  editAppointmentBox.style.display = 'block';

  editAppointmentBox.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

function initEditAppointmentForm() {
  editAppointmentForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const appointmentId = document.getElementById('editAppointmentId').value;

    const payload = {
      customerName: document.getElementById('editCustomerName').value.trim(),
      customerPhone: document.getElementById('editCustomerPhone').value.trim(),
      serviceId: document.getElementById('editService').value,
      date: document.getElementById('editDate').value,
      time: document.getElementById('editTime').value,
      note: document.getElementById('editNote').value.trim()
    };

    const { response, data } = await adminFetch(
      `/admin/appointments/${appointmentId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      return showAdminMessage(
        data.message || 'Greška pri izmeni termina.',
        'error'
      );
    }

    showAdminMessage('Termin je uspešno izmenjen.');

    editAppointmentForm.reset();
    editAppointmentBox.style.display = 'none';

    selectedDate = payload.date;

    renderAdminCalendar();
    loadAdminAppointments();
  });

  document.getElementById('cancelEditAppointmentBtn')?.addEventListener('click', () => {
    editAppointmentForm.reset();
    editAppointmentBox.style.display = 'none';
  });
}

/* =========================
   SERVICES
========================= */

async function loadAdminServices() {
  try {
    const response = await fetch(`${API_URL}/services`);
    const data = await response.json();

    const serviceSelects = [
      manualService,
      editService
    ].filter(Boolean);

    serviceSelects.forEach(select => {
      select.innerHTML = '<option value="">Izaberi uslugu</option>';
    });

    (data.services || []).forEach(service => {
      serviceSelects.forEach(select => {
        const option = document.createElement('option');

        option.value = service.id;
        option.textContent =
          `${service.name} - ${service.duration_minutes} min - ${service.price} RSD`;

        select.appendChild(option);
      });
    });

  } catch (error) {
    if (manualService) {
      manualService.innerHTML =
        '<option value="">Greška pri učitavanju usluga</option>';
    }

    if (editService) {
      editService.innerHTML =
        '<option value="">Greška pri učitavanju usluga</option>';
    }
  }
}

async function loadAdminServicesPanel() {
  if (!adminServicesList) return;

  adminServicesList.innerHTML =
    '<p class="admin-empty">Učitavanje usluga...</p>';

  try {
    const { response, data } = await adminFetch('/admin/services');

    if (!response.ok) {
      adminServicesList.innerHTML =
        `<p class="admin-empty">${data.message || 'Greška pri učitavanju usluga.'}</p>`;
      return;
    }

    const services = data.services || [];

    if (services.length === 0) {
      adminServicesList.innerHTML =
        '<div class="admin-empty-state">Još nema dodatih usluga.</div>';
      return;
    }

    adminServicesList.innerHTML = '';

    services.forEach(service => {
      adminServicesList.appendChild(createServiceCard(service));
    });

  } catch (error) {
    adminServicesList.innerHTML =
      '<p class="admin-empty">Greška pri učitavanju usluga.</p>';
  }
}

function createServiceCard(service) {
  const card = document.createElement('div');
  card.className = 'admin-service-card';

  card.classList.toggle('inactive', !service.is_active);
  card.dataset.active = service.is_active ? 'true' : 'false';

  card.innerHTML = `
    <div>
      <span class="admin-service-status ${service.is_active ? 'active' : 'inactive'}">
        ${service.is_active ? 'Aktivna' : 'Neaktivna'}
      </span>

      <h3>${service.name}</h3>

      <p>
        <strong>Trajanje:</strong> ${service.duration_minutes} min
      </p>

      <p>
        <strong>Cena:</strong> ${service.price} RSD
      </p>
    </div>

    <div class="admin-service-actions">
      <button class="btn btn-gold edit-service-btn" data-id="${service.id}">
        Izmeni
      </button>

      <button class="btn btn-dark toggle-service-btn" data-id="${service.id}">
        ${service.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
      </button>
    </div>
  `;

  card.querySelector('.edit-service-btn')?.addEventListener('click', () => {
    document.getElementById('adminServiceId').value = service.id;
    document.getElementById('adminServiceName').value = service.name;
    document.getElementById('adminServiceDuration').value = service.duration_minutes;
    document.getElementById('adminServicePrice').value = service.price;
  });

  card.querySelector('.toggle-service-btn')?.addEventListener('click', async () => {
    await toggleServiceStatus(service.id);
  });

  return card;
}

async function toggleServiceStatus(id) {
  const confirmed = confirm('Da li želiš da promeniš status ove usluge?');

  if (!confirmed) return;

  const { response, data } = await adminFetch(
    `/admin/services/${id}/toggle`,
    {
      method: 'PATCH'
    }
  );

  if (!response.ok) {
    return showAdminMessage(
      data.message || 'Greška pri promeni statusa usluge.',
      'error'
    );
  }

  showAdminMessage(data.message || 'Status usluge je promenjen.');

  loadAdminServicesPanel();
  loadAdminServices();
}

function initServiceForm() {
  adminServiceForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const serviceId = document.getElementById('adminServiceId').value;

    const payload = {
      name: document.getElementById('adminServiceName').value.trim(),
      durationMinutes: Number(document.getElementById('adminServiceDuration').value),
      price: Number(document.getElementById('adminServicePrice').value),
      isActive: true
    };

    const url = serviceId
      ? `/admin/services/${serviceId}`
      : '/admin/services';

    const method = serviceId ? 'PUT' : 'POST';

    const { response, data } = await adminFetch(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      return showAdminMessage(
        data.message || 'Greška pri čuvanju usluge.',
        'error'
      );
    }

    showAdminMessage(
      serviceId
        ? 'Usluga je izmenjena.'
        : 'Usluga je dodata.'
    );

    adminServiceForm.reset();
    document.getElementById('adminServiceId').value = '';

    loadAdminServicesPanel();
    loadAdminServices();
  });

  document.getElementById('clearServiceFormBtn')?.addEventListener('click', () => {
    adminServiceForm.reset();
    document.getElementById('adminServiceId').value = '';
  });
}

/* =========================
   SITE SETTINGS
========================= */

async function loadSiteSettings() {
  const form = document.getElementById('settingsForm');
  if (!form) return;

  try {
    const { response, data } = await adminFetch('/admin/settings');

    if (!response.ok) {
      return showAdminMessage(
        data.message || 'Greška pri učitavanju podešavanja.',
        'error'
      );
    }

    const settings = data.settings || {};

    const fields = {
      settingSalonPhone: settings.salon_phone || '',
      settingSalonEmail: settings.salon_email || '',
      settingSalonAddress: settings.salon_address || '',
      settingSalonInstagram: settings.salon_instagram || '',
      settingWorkMondayFriday: settings.work_monday_friday || '',
      settingWorkSaturday: settings.work_saturday || '',
      settingWorkSunday: settings.work_sunday || ''
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.value = value;
    });

  } catch (error) {
    showAdminMessage('Backend nije dostupan za podešavanja.', 'error');
  }
}

function initSettingsForm() {
  document.getElementById('settingsForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const payload = {
      salon_phone: document.getElementById('settingSalonPhone').value.trim(),
      salon_email: document.getElementById('settingSalonEmail').value.trim(),
      salon_address: document.getElementById('settingSalonAddress').value.trim(),
      salon_instagram: document.getElementById('settingSalonInstagram').value.trim(),
      work_monday_friday: document.getElementById('settingWorkMondayFriday').value.trim(),
      work_saturday: document.getElementById('settingWorkSaturday').value.trim(),
      work_sunday: document.getElementById('settingWorkSunday').value.trim()
    };

    const { response, data } = await adminFetch(
      '/admin/settings',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      return showAdminMessage(
        data.message || 'Greška pri čuvanju podešavanja.',
        'error'
      );
    }

    showAdminMessage('Podešavanja su sačuvana.');
  });
}

/* =========================
   CLOSED DAYS
========================= */

async function loadClosedDays() {
  const list = document.getElementById('closedDaysList');

  if (!list) return;

  try {
    const { response, data } = await adminFetch('/admin/closed-days');

    if (!response.ok) {
      return showAdminMessage(
        data.message || 'Greška pri učitavanju neradnih dana.',
        'error'
      );
    }

    const closedDays = data.closedDays || [];

    if (closedDays.length === 0) {
      list.innerHTML = `
        <div class="admin-empty-state">
          Nema dodatih neradnih dana.
        </div>
      `;
      return;
    }

    list.innerHTML = '';

    closedDays.forEach(item => {
      const card = document.createElement('div');
      card.className = 'admin-service-card';

      const title =
        item.start_date === item.end_date
          ? item.start_date
          : `${item.start_date} - ${item.end_date}`;

      card.innerHTML = `
        <div>
          <h3>${title}</h3>
          <p><strong>Razlog:</strong> ${item.reason || '-'}</p>
        </div>

        <div class="admin-service-actions">
          <button class="btn btn-dark delete-closed-day-btn" data-id="${item.id}">
            Obriši
          </button>
        </div>
      `;

      card.querySelector('.delete-closed-day-btn')?.addEventListener('click', async () => {
        await deleteClosedDay(item.id);
      });

      list.appendChild(card);
    });

  } catch (error) {
    showAdminMessage('Backend nije dostupan za neradne dane.', 'error');
  }
}

function initClosedDaysForm() {
  document.getElementById('closedDayForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const payload = {
      startDate: document.getElementById('closedStartDate').value,
      endDate: document.getElementById('closedEndDate').value,
      reason: document.getElementById('closedReason').value.trim()
    };

    const { response, data } = await adminFetch(
      '/admin/closed-days',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      return showAdminMessage(
        data.message || 'Greška pri dodavanju neradnog dana.',
        'error'
      );
    }

    showAdminMessage('Neradni period je dodat.');

    document.getElementById('closedDayForm').reset();

    loadClosedDays();
    renderAdminCalendar();
    loadAdminAppointments();
  });
}

async function deleteClosedDay(id) {
  const confirmed = confirm('Da li želiš da obrišeš ovaj neradni period?');

  if (!confirmed) return;

  const { response, data } = await adminFetch(
    `/admin/closed-days/${id}`,
    {
      method: 'DELETE'
    }
  );

  if (!response.ok) {
    return showAdminMessage(
      data.message || 'Greška pri brisanju neradnog dana.',
      'error'
    );
  }

  showAdminMessage('Neradni period je obrisan.');

  loadClosedDays();
  renderAdminCalendar();
  loadAdminAppointments();
}

/* =========================
   TABS / HEADER
========================= */

function initTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.adminTab;

      document.querySelectorAll('.admin-tab').forEach(item => {
        item.classList.remove('active');
      });

      document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
      });

      tab.classList.add('active');

      document.getElementById(`${tabName}Tab`)?.classList.add('active');
    });
  });
}

function initAdminHeader() {
  const adminMenuBtn = document.getElementById('adminMenuBtn');
  const adminNavMenu = document.getElementById('adminNavMenu');

  adminMenuBtn?.addEventListener('click', () => {
    adminNavMenu?.classList.toggle('show');
  });

  document.getElementById('adminLogoutBtn')?.addEventListener('click', logoutAdmin);
  document.getElementById('adminMobileLogoutBtn')?.addEventListener('click', logoutAdmin);
}

function initCalendarControls() {
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderAdminCalendar();
  });

  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderAdminCalendar();
  });
}

/* =========================
   INIT
========================= */

function initAdminPage() {
  if (!checkAdminAccess()) return;

  initAdminHeader();
  initTabs();
  initCalendarControls();
  initAppointmentForms();
  initEditAppointmentForm();
  initServiceForm();
  initSettingsForm();
  initClosedDaysForm();

  renderAdminCalendar();
  loadAdminServices();
  loadAdminAppointments();
  loadAdminServicesPanel();
  loadSiteSettings();
  loadClosedDays();
}

initAdminPage();
