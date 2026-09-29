const { body, validationResult } = require('express-validator');

// Collect validation errors and return 400 if any
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array().map((e) => e.msg).join(', '),
      errors: errors.array(),
    });
  }
  next();
};

// --- Auth validation rules ---

const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
];

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

// --- Study space rules ---

const spaceRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Space name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Space name must be 2–100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6})$/).withMessage('Color must be a 6-digit hex value'),
];

// --- Resource rules ---

const resourceRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 150 }).withMessage('Title cannot exceed 150 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),

  // The URL is only required when nothing was uploaded and this is not a code
  // snippet; the controller settles which branch applies.
  body('url')
    .optional({ values: 'falsy' })
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Please provide a valid http:// or https:// URL'),
];

// --- Pin rules ---

const pinRules = [
  body('sourceType')
    .isIn(['message', 'resource', 'note', 'announcement'])
    .withMessage('sourceType must be message, resource, note, or announcement'),

  body('label')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Pin label cannot exceed 500 characters'),
];

// --- Highlight rules ---

const highlightRules = [
  body('sourceType')
    .isIn(['message', 'resource', 'notes'])
    .withMessage('sourceType must be message, resource, or notes'),

  body('type')
    .isIn(['important', 'exam-important', 'doubt', 'solution', 'reference', 'todo'])
    .withMessage('type must be important, exam-important, doubt, solution, reference, or todo'),

  body('label')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Highlight cannot exceed 2000 characters'),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  spaceRules,
  resourceRules,
  pinRules,
  highlightRules,
};
