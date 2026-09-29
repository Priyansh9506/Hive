const { nanoid } = require('nanoid');

// Ambiguous glyphs are left out: a code gets read aloud and typed by hand, and
// O/0 and I/1/L are where that goes wrong.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const randomCode = () => {
  let raw = '';
  for (let i = 0; i < 6; i++) {
    raw += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}`;
};

/**
 * Produce a join code that is not already taken (e.g. `7KQ-9PM`).
 * `joinCode` is uniquely indexed, so a collision would otherwise surface as a
 * duplicate-key error on create.
 */
const generateJoinCode = async () => {
  // Required lazily so this util stays usable from scripts that have not yet
  // registered the model.
  const StudySpace = require('../models/StudySpace');

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    if (!(await StudySpace.exists({ joinCode: code }))) return code;
  }

  // 31^6 keeps collisions vanishingly unlikely; if we somehow get here, fall
  // back to a longer nanoid rather than failing the request.
  return nanoid(10).toUpperCase();
};

// Accepts a code however the user typed it (`7kq9pm`, `7KQ 9PM`, `7KQ-9PM`)
// and returns it in canonical `XXX-XXX` form.
const normalizeJoinCode = (code) => {
  const raw = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}`;
};

module.exports = { generateJoinCode, randomCode, normalizeJoinCode };
