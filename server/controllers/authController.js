const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate default avatar
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random`;

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      avatarUrl: defaultAvatar,
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password field (excluded by default)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Created through Google sign-in: there is no password to check
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'This account uses Google sign-in. Please continue with Google.',
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user (client-side token removal; server-side placeholder)
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  // In a stateless JWT setup, logout is primarily client-side (delete token).
  // This endpoint exists for API completeness and future token blacklisting.
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

// @desc    Update user profile
// @route   PATCH /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;

    const updates = {};
    if (name && name.trim()) {
      updates.name = name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PATCH /api/auth/password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password and new password',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account signs in with Google, so it has no password to change',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Issue new token after password change
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      token,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload avatar
// @route   POST /api/auth/avatar
// @access  Private
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file',
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatarUrl: fileUrl },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

let googleClient = null;

// @desc    Sign in (or sign up) with Google
// @route   POST /api/auth/google
// @body    { credential } — the ID token from Google Identity Services on the client
// @access  Public
//
// The client never sends identity details of its own: everything comes from
// the ID token, which is checked against Google's keys and this app's client
// id. The response is the same `{ token, user }` as password login.
const googleLogin = async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({
        success: false,
        message: 'Google sign-in is not configured on this server',
      });
    }

    const { credential } = req.body;
    if (typeof credential !== 'string' || !credential) {
      return res.status(400).json({ success: false, message: 'Missing Google credential' });
    }

    if (!googleClient) {
      const { OAuth2Client } = require('google-auth-library');
      googleClient = new OAuth2Client(clientId);
    }

    let payload;
    try {
      // Checks the signature, expiry, issuer, and that it was issued for this app
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch (err) {
      console.warn('Google sign-in: token rejected:', err.message);
      return res.status(401).json({ success: false, message: 'Google sign-in failed. Please try again.' });
    }

    const { sub: googleId, email, email_verified: emailVerified, name, picture } = payload;

    // Linking on email is only safe when Google vouches for the address
    if (!email || !emailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Your Google account email is not verified',
      });
    }

    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Existing password account with the same verified email: link it, so
        // the member keeps their spaces instead of getting a second account
        user.googleId = googleId;
        if (!user.avatarUrl && picture) user.avatarUrl = picture;
        await user.save();
      } else {
        user = await User.create({
          name: (name || email.split('@')[0]).trim().slice(0, 50),
          email: email.toLowerCase(),
          googleId,
          avatarUrl:
            picture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email)}&background=random`,
        });
      }
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, logout, updateProfile, changePassword, uploadAvatar, googleLogin };
