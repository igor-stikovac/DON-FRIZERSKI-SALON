/**
 * Zajednički utility za rad sa vremenom.
 * Uvozi se u appointmentController i adminController
 * umesto da se duplikuje kod.
 */

/**
 * Konvertuje "HH:MM" string u broj minuta od ponoći.
 * @param {string} time  npr. "10:30"
 * @returns {number}
 */
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Konvertuje broj minuta od ponoći u "HH:MM" string.
 * @param {number} totalMinutes
 * @returns {string}
 */
function minutesToTime(totalMinutes) {
  const hours   = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Vraća true ako se intervali [startA, endA) i [startB, endB) preklapaju.
 */
function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

/**
 * Vraća kraj radnog vremena za dati datum na osnovu podešavanja.
 * @param {string} date         ISO datum, npr. "2025-06-15"
 * @param {object} settings     { work_end_weekday, work_end_saturday }
 * @returns {string|null}       "HH:MM" ili null ako salon ne radi
 */
function getWorkEndByDate(date, settings = {}) {
  const day = new Date(`${date}T00:00:00`).getDay(); // 0=nedelja, 6=subota

  if (day === 0) return null; // nedelja — ne radi

  if (day === 6) {
    return settings.work_end_saturday || '15:00';
  }

  return settings.work_end_weekday || '20:00';
}

/**
 * Vraća današnji datum kao "YYYY-MM-DD" string u lokalnom vremenu.
 */
function getTodayString() {
  const today = new Date();
  const year  = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day   = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Vraća trenutno vreme u minutima od ponoći.
 */
function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  overlaps,
  getWorkEndByDate,
  getTodayString,
  getCurrentMinutes,
};
