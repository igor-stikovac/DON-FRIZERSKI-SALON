const API_URL = 'http://localhost:5000/api';

const token = localStorage.getItem('don_token');
const user = JSON.parse(localStorage.getItem('don_user') || 'null');

const adminMonthGrid = document.getElementById('adminMonthGrid');
const adminMonthTitle = document.getElementById('adminMonthTitle');
const selectedDayTitle = document.getElementById('selectedDayTitle');
const adminAppointmentsList = document.getElementById('adminAppointmentsList');
const manualService = document.getElementById('manualService');
const adminMessage = document.getElementById('adminMessage');
const adminServicesList = document.getElementById('adminServicesList');
const adminServiceForm = document.getElementById('adminServiceForm');
const editService = document.getElementById('editService');
const editAppointmentForm = document.getElementById('editAppointmentForm');
const editAppointmentBox = document.getElementById('editAppointmentBox');
const statBookedToday = document.getElementById('statBookedToday');
const statCancelledToday = document.getElementById('statCancelledToday');
const statRevenueToday = document.getElementById('statRevenueToday');
const statBlocksToday = document.getElementById('statBlocksToday');

let adminCalendarStats = {};
let currentMonth = new Date();
let selectedDate = formatDateForApi(new Date());

function checkAdminAccess() {
  if (!token || !user || user.role !== 'admin') {
    alert('Nemate pristup admin panelu.');
    window.location.href = 'index.html';
  }
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
  adminMessage.textContent = text;
  adminMessage.className =
    type === 'error'
      ? 'auth-message error'
      : 'auth-message success';

  setTimeout(() => {
    adminMessage.textContent = '';
  }, 3500);
}

function renderAdminCalendar() {
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

    const dayButton = document.createElement('button');
    dayButton.type = 'button';
    dayButton.className = 'admin-calendar-day';
    dayButton.dataset.date = dateForApi;

    if (dateForApi === selectedDate) {
      dayButton.classList.add('selected');
    }

    const today = formatDateForApi(new Date());

    if (dateForApi === today) {
      dayButton.classList.add('today');
    }

    const dayOfWeek = date.getDay();

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

    data.services.forEach(service => {
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

async function loadAdminAppointments() {
  selectedDayTitle.textContent = formatDateForDisplay(selectedDate);

  adminAppointmentsList.innerHTML =
    '<p class="admin-empty">Učitavanje termina...</p>';

  try {
    const response = await fetch(
      `${API_URL}/admin/appointments?date=${selectedDate}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

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

      adminAppointmentsList.appendChild(card);
    });

    appointments.forEach(app => {
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

      card.innerHTML = `
        <div class="admin-appointment-main">
          <div>
            <h3>${app.start_time.slice(0, 5)} - ${app.end_time.slice(0, 5)}</h3>
            <p>${app.service_name}</p>
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
          ${
            app.note
              ? `<p><strong>Napomena:</strong> ${app.note}</p>`
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

      adminAppointmentsList.appendChild(card);
    });

    document.querySelectorAll('.admin-cancel-btn').forEach(button => {
      button.addEventListener('click', async () => {
        await cancelAdminAppointment(button.dataset.id);
      });
    });

    document.querySelectorAll('.admin-edit-btn').forEach(button => {
      button.addEventListener('click', () => {
        const appointment = appointments.find(app =>
          String(app.id) === String(button.dataset.id)
        );

        if (appointment) {
          openEditAppointmentForm(appointment);
        }
      });
    });

    document.querySelectorAll('.admin-delete-block-btn').forEach(button => {
      button.addEventListener('click', async () => {
        await deleteBlockedSlot(button.dataset.id);
      });
    });

  } catch (error) {
    adminAppointmentsList.innerHTML =
      '<p class="admin-empty">Greška pri učitavanju termina.</p>';
  }
}

async function cancelAdminAppointment(id) {
  const confirmed = confirm(
    'Da li ste sigurni da želite da otkažete ovaj termin?'
  );

  if (!confirmed) return;

  const response = await fetch(
    `${API_URL}/admin/appointments/${id}/cancel`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await response.json();

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
  const confirmed = confirm(
    'Da li želite da uklonite ovu blokadu?'
  );

  if (!confirmed) return;

  const response = await fetch(
    `${API_URL}/admin/blocks/${id}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await response.json();

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

document
  .getElementById('manualAppointmentForm')
  ?.addEventListener('submit', async (event) => {
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

    const response = await fetch(
      `${API_URL}/admin/appointments/manual`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

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
  ?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      date: selectedDate,
      startTime: document.getElementById('blockStartTime').value,
      endTime: document.getElementById('blockEndTime').value,
      reason: document.getElementById('blockReason').value.trim()
    };

    const response = await fetch(
      `${API_URL}/admin/blocks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

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

document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.adminTab;

    document.querySelectorAll('.admin-tab').forEach(t => {
      t.classList.remove('active');
    });

    document.querySelectorAll('.admin-tab-content').forEach(content => {
      content.classList.remove('active');
    });

    tab.classList.add('active');

    document
      .getElementById(`${tabName}Tab`)
      .classList.add('active');
  });
});

document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderAdminCalendar();
});

document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderAdminCalendar();
});

document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('don_token');
  localStorage.removeItem('don_user');

  window.location.href = 'index.html';
});

async function loadAdminServicesPanel() {
  if (!adminServicesList) return;

  adminServicesList.innerHTML = '<p class="admin-empty">Učitavanje usluga...</p>';

  try {
    const response = await fetch(`${API_URL}/admin/services`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      adminServicesList.innerHTML =
        `<p class="admin-empty">${data.message || 'Greška pri učitavanju usluga.'}</p>`;
      return;
    }

    adminServicesList.innerHTML = '';

    data.services.forEach(service => {
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

      adminServicesList.appendChild(card);

      card.querySelector('.edit-service-btn').addEventListener('click', () => {
        document.getElementById('adminServiceId').value = service.id;
        document.getElementById('adminServiceName').value = service.name;
        document.getElementById('adminServiceDuration').value = service.duration_minutes;
        document.getElementById('adminServicePrice').value = service.price;
      });

      card.querySelector('.toggle-service-btn').addEventListener('click', async () => {
        await toggleServiceStatus(service.id);
      });
    });

  } catch (error) {
    adminServicesList.innerHTML =
      '<p class="admin-empty">Greška pri učitavanju usluga.</p>';
  }
}

async function deactivateService(id) {
  const confirmed = confirm('Da li želiš da deaktiviraš ovu uslugu?');

  if (!confirmed) return;

  const response = await fetch(`${API_URL}/admin/services/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    return showAdminMessage(
      data.message || 'Greška pri deaktiviranju usluge.',
      'error'
    );
  }

  showAdminMessage('Usluga je deaktivirana.');

  loadAdminServicesPanel();
  loadAdminServices();
}

adminServiceForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const serviceId = document.getElementById('adminServiceId').value;

  const payload = {
    name: document.getElementById('adminServiceName').value.trim(),
    durationMinutes: Number(document.getElementById('adminServiceDuration').value),
    price: Number(document.getElementById('adminServicePrice').value),
    isActive: true
  };

  const url = serviceId
    ? `${API_URL}/admin/services/${serviceId}`
    : `${API_URL}/admin/services`;

  const method = serviceId ? 'PUT' : 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

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

editAppointmentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const appointmentId =
    document.getElementById('editAppointmentId').value;

  const payload = {
    customerName: document.getElementById('editCustomerName').value.trim(),
    customerPhone: document.getElementById('editCustomerPhone').value.trim(),
    serviceId: document.getElementById('editService').value,
    date: document.getElementById('editDate').value,
    time: document.getElementById('editTime').value,
    note: document.getElementById('editNote').value.trim()
  };

  const response = await fetch(
    `${API_URL}/admin/appointments/${appointmentId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }
  );

  const data = await response.json();

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

async function loadAdminStats(year, month) {
  try {
    const response = await fetch(
      `${API_URL}/admin/stats?year=${year}&month=${month}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return;
    }

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

    data.monthAppointments.forEach(item => {
      adminCalendarStats[item.date] = {
        booked: Number(item.booked_count || 0),
        cancelled: Number(item.cancelled_count || 0),
        blocks: 0
      };
    });

    data.monthBlocks.forEach(item => {
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

function paintCalendarStats() {
  document.querySelectorAll('.admin-calendar-day[data-date]').forEach(day => {
    const date = day.dataset.date;
    const stats = adminCalendarStats[date];

    const oldBadge = day.querySelector('.calendar-day-stats');

    if (oldBadge) {
      oldBadge.remove();
    }

    if (!stats) return;

    const badge = document.createElement('div');
    badge.className = 'calendar-day-stats';

    badge.innerHTML = `
      ${
        stats.booked > 0
          ? `<span>${stats.booked} termina</span>`
          : ''
      }

      ${
        stats.blocks > 0
          ? `<span>${stats.blocks} blokada</span>`
          : ''
      }
    `;

    day.appendChild(badge);
  });
}

async function toggleServiceStatus(id) {
  const confirmed = confirm('Da li želiš da promeniš status ove usluge?');

  if (!confirmed) return;

  const response = await fetch(`${API_URL}/admin/services/${id}/toggle`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

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

async function loadSiteSettings() {
  try {
    const response = await fetch(`${API_URL}/admin/settings`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return showAdminMessage(
        data.message || 'Greška pri učitavanju podešavanja.',
        'error'
      );
    }

    const settings = data.settings || {};

    document.getElementById('settingSalonPhone').value =
      settings.salon_phone || '';

    document.getElementById('settingSalonEmail').value =
      settings.salon_email || '';

    document.getElementById('settingSalonAddress').value =
      settings.salon_address || '';

    document.getElementById('settingSalonInstagram').value =
      settings.salon_instagram || '';

    document.getElementById('settingWorkMondayFriday').value =
      settings.work_monday_friday || '';

    document.getElementById('settingWorkSaturday').value =
      settings.work_saturday || '';

    document.getElementById('settingWorkSunday').value =
      settings.work_sunday || '';

  } catch (error) {
    showAdminMessage(
      'Backend nije dostupan za podešavanja.',
      'error'
    );
  }
}

document.getElementById('settingsForm')?.addEventListener('submit', async (event) => {
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

  const response = await fetch(`${API_URL}/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    return showAdminMessage(
      data.message || 'Greška pri čuvanju podešavanja.',
      'error'
    );
  }

  showAdminMessage('Podešavanja su sačuvana.');
});

const adminMenuBtn = document.getElementById('adminMenuBtn');
const adminNavMenu = document.getElementById('adminNavMenu');

adminMenuBtn?.addEventListener('click', () => {
  adminNavMenu?.classList.toggle('show');
});

document.getElementById('adminMobileLogoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('don_token');
  localStorage.removeItem('don_user');
  window.location.href = 'index.html';
});

checkAdminAccess();
renderAdminCalendar();
loadAdminServices();
loadAdminAppointments();
loadAdminServicesPanel();
loadSiteSettings();