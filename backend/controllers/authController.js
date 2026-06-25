const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, phone, email, password } = req.body;

    if (!firstName || !lastName || !phone || !email || !password) {
      return res.status(400).json({ message: 'Sva polja su obavezna.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Lozinka mora imati najmanje 6 karaktera.' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Korisnik sa ovim emailom već postoji.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, phone, email, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, first_name, last_name, phone, email, role, created_at`,
      [firstName, lastName, phone, email, passwordHash]
    );

    const user = result.rows[0];
    const token = createToken(user);

    res.status(201).json({
      message: 'Nalog je uspešno napravljen.',
      token,
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Greška na serveru.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email / admin korisničko ime i lozinka su obavezni.'
      });
    }

    const loginValue = email.trim();

    const result = await pool.query(
      `SELECT *
       FROM users
       WHERE email = $1 OR username = $1`,
      [loginValue]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: 'Pogrešni podaci za prijavu.'
      });
    }

    const user = result.rows[0];

    if (!loginValue.includes('@') && user.role !== 'admin') {
      return res.status(403).json({
        message: 'Samo admin može da se prijavi korisničkim imenom.'
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Pogrešni podaci za prijavu.'
      });
    }

    const token = createToken(user);

    res.json({
      message: 'Uspešno ste se prijavili.',
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška na serveru.'
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, first_name, last_name, phone, email, username, role
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Korisnik nije pronađen.'
      });
    }

    res.json({
      user: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri učitavanju korisnika.'
    });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      firstName,
      lastName,
      phone,
      email
    } = req.body;

    if (!firstName || !lastName || !phone || !email) {
      return res.status(400).json({
        message: 'Sva polja su obavezna.'
      });
    }

    const existingUser = await pool.query(
      `SELECT id FROM users
       WHERE email = $1
       AND id <> $2`,
      [email, userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: 'Ovaj email već koristi drugi korisnik.'
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           phone = $3,
           email = $4
       WHERE id = $5
       RETURNING id, first_name, last_name, phone, email, role`,
      [firstName, lastName, phone, email, userId]
    );

    res.json({
      message: 'Podaci su uspešno izmenjeni.',
      user: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Greška pri izmeni podataka.'
    });
  }
};