-- ============================================================
--  DON Hair Studio — kompletna baza
--  Pokreni ovaj fajl jednom da kreiraš sve tabele.
-- ============================================================

CREATE DATABASE don_hair_studio;

-- Nakon kreiranja baze povezi se na don_hair_studio,
-- pa pokreni ostatak skripte.

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    first_name    VARCHAR(80)  NOT NULL,
    last_name     VARCHAR(80)  NOT NULL,
    phone         VARCHAR(30)  NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    username      VARCHAR(60)  UNIQUE,          -- samo za admin nalog
    password_hash TEXT         NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user', -- 'user' | 'admin'
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- SERVICES (usluge)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    duration_minutes INTEGER      NOT NULL DEFAULT 30,
    price            NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Inicijalni podaci — prilagodi po potrebi
INSERT INTO services (name, duration_minutes, price) VALUES
    ('Šišanje',             30, 800),
    ('Šišanje + brada',     45, 1100),
    ('Brada',               20, 500),
    ('Fade',                40, 900),
    ('Fade + brada',        55, 1200),
    ('Pranje + feniranje',  30, 600),
    ('Farbanje',            90, 2500)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- APPOINTMENTS (termini)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id                     SERIAL PRIMARY KEY,

    -- Ako je korisnik registrovan, user_id je popunjen.
    -- Ako admin ručno zakazuje, user_id je NULL.
    user_id                INTEGER REFERENCES users(id) ON DELETE SET NULL,

    service_id             INTEGER NOT NULL REFERENCES services(id),

    appointment_date       DATE    NOT NULL,
    start_time             TIME    NOT NULL,
    end_time               TIME    NOT NULL,

    status                 VARCHAR(30)   NOT NULL DEFAULT 'booked', -- 'booked' | 'cancelled'
    cancellation_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,
    cancelled_at           TIMESTAMP,

    -- Polja za ručno zakazivanje (bez naloga)
    manual_customer_name   VARCHAR(120),
    manual_customer_phone  VARCHAR(30),
    manual_customer_email  VARCHAR(150),
    note                   TEXT,

    -- Praćenje poslanih podsetsnika
    reminder_2_days_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_1_day_sent    BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_same_day_sent BOOLEAN NOT NULL DEFAULT FALSE,

    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indeksi za brže upite po datumu
CREATE INDEX IF NOT EXISTS idx_appointments_date   ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_user   ON appointments(user_id);

-- ------------------------------------------------------------
-- BLOCKED SLOTS (blokirani termini)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blocked_slots (
    id         SERIAL PRIMARY KEY,
    block_date DATE   NOT NULL,
    start_time TIME   NOT NULL,
    end_time   TIME   NOT NULL,
    reason     TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blocked_slots_date ON blocked_slots(block_date);

-- ------------------------------------------------------------
-- CLOSED DAYS (neradni dani / godišnji odmor)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS closed_days (
    id         SERIAL PRIMARY KEY,
    start_date DATE  NOT NULL,
    end_date   DATE  NOT NULL,
    reason     TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- SITE SETTINGS (podešavanja sajta koja admin menja)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_settings (
    setting_key   VARCHAR(80) PRIMARY KEY,
    setting_value TEXT        NOT NULL,
    updated_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- Inicijalna podešavanja
INSERT INTO site_settings (setting_key, setting_value) VALUES
    ('work_start',              '10:00'),
    ('work_end_weekday',        '20:00'),
    ('work_end_saturday',       '15:00'),
    ('cancellation_fee_same_day',   '100'),  -- procenat od cene usluge
    ('cancellation_fee_one_day',    '80')    -- procenat od cene usluge
ON CONFLICT (setting_key) DO NOTHING;

-- ------------------------------------------------------------
-- ADMIN NALOG (kreiraj jednom, zatim promeni lozinku)
-- Lozinka ispod je: admin123  (bcrypt hash, rounds=10)
-- VAŽNO: Promeni lozinku odmah nakon prvog logina!
-- ------------------------------------------------------------
-- INSERT INTO users (first_name, last_name, phone, email, username, password_hash, role)
-- VALUES (
--     'Admin', 'DON', '000000000',
--     'admin@donhairstudio.rs',
--     'admin',
--     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHi.',
--     'admin'
-- )
-- ON CONFLICT DO NOTHING;
