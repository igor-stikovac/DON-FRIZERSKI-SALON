const API_URL = 'http://localhost:5000/api';

const token = localStorage.getItem('don_token');
const user = JSON.parse(localStorage.getItem('don_user') || 'null');

const adminDate = document.getElementById('adminDate');
const manualDate = document.getElementById('manualDate');
const manualService = document.getElementById('manualService');
const adminAppointmentsList = document.getElementById('adminAppointmentsList');
const adminMessage = document.getElementById('adminMessage');

function todayForInput() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function showAdminMessage(text, type = 'success') {
  adminMessage.textContent = text;
  adminMessage.className =
    type === 'error'
      ? 'auth-message error'
      : 'auth-message success';
}

function checkAdminAccess() {
  if (!token || !user || user.role !== 'admin') {
    alert('Nemate pristup admin panelu.');
    window.location.href = 'index.html';
  }
}

async function loadAdminServices() {
  try {
    const response = await fetch(`${API_URL}/services`);
    const data = await response.json();

    manualService.innerHTML = '<option value="">Izaberi uslugu</option>';

    data.services.forEach(service => {
      const option = document.createElement('option');

      option.value = service.id;
      option.textContent =
        `${service.name} - ${service.duration_minutes} min - ${service.price} RSD`;

      manualService.appendChild(option);
    });

  } catch (error) {
    manualService.innerHTML =
      '<option value="">Greška pri učitavanju usluga</option>';
  }
}

async function loadAdminAppointments() {
  const date = adminDate.value;

  if (!date) return;

  adminAppointmentsList.innerHTML =
    '<p>Učitavanje termina...</p>';

  try {
    const response = await fetch(
      `${API_URL}/admin/appointments?date=${date}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      adminAppointmentsList.innerHTML =
        `<p>${data.message || 'Greška pri učitavanju termina.'}</p>`;
      return;
    }

    const appointments = data.appointments || [];

    if (appointments.length === 0) {
      adminAppointmentsList.innerHTML =
        '<p>Za izabrani dan nema zakazanih termina.</p>';
      return;
    }

    adminAppointmentsList.innerHTML = '';

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
          <p><strong>Email:</strong> ${app.email || '-'}</p>
          <p><strong>Cena:</strong> ${app.price || 0} RSD</p>
          ${
            app.note
              ? `<p><strong>Napomena:</strong> ${app.note}</p>`
              : ''
          }
        </div>

        ${
          app.status === 'booked'
            ? `<button class="btn btn-dark admin-cancel-btn" data-id="${app.id}">
                Otkaži termin
              </button>`
            : ''
        }
      `;

      adminAppointmentsList.appendChild(card);
    });

    document.querySelectorAll('.admin-cancel-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const appointmentId = button.dataset.id;
        await cancelAdminAppointment(appointmentId);
      });
    });

  } catch (error) {
    adminAppointmentsList.innerHTML =
      '<p>Greška pri učitavanju termina.</p>';
  }
}

async function cancelAdminAppointment(id) {
  const confirmed = confirm(
    'Da li ste sigurni da želite da otkažete ovaj termin?'
  );

  if (!confirmed) return;

  try {
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
      alert(data.message || 'Greška pri otkazivanju termina.');
      return;
    }

    alert(data.message || 'Termin je otkazan.');
    loadAdminAppointments();

  } catch (error) {
    alert('Greška pri otkazivanju termina.');
  }
}

document
  .getElementById('manualAppointmentForm')
  ?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      customerName: document.getElementById('manualCustomerName').value.trim(),
      customerPhone: document.getElementById('manualCustomerPhone').value.trim(),
      serviceId: manualService.value,
      date: manualDate.value,
      time: document.getElementById('manualTime').value,
      note: document.getElementById('manualNote').value.trim()
    };

    try {
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

      manualDate.value = adminDate.value;

      loadAdminAppointments();

    } catch (error) {
      showAdminMessage(
        'Backend nije pokrenut ili API nije dostupan.',
        'error'
      );
    }
  });

adminDate?.addEventListener('change', () => {
  manualDate.value = adminDate.value;
  loadAdminAppointments();
});

document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('don_token');
  localStorage.removeItem('don_user');

  window.location.href = 'index.html';
});

checkAdminAccess();

adminDate.value = todayForInput();
manualDate.value = todayForInput();

loadAdminServices();
loadAdminAppointments();