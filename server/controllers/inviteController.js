const StudySpace = require('../models/StudySpace');
const Membership = require('../models/Membership');
const User = require('../models/User');
const { sendMail, isConfigured } = require('../config/mailer');
const { inviteEmail } = require('../utils/emailTemplates');
const { generateJoinCode } = require('../utils/joinCode');
const logActivity = require('../utils/logActivity');
const notify = require('../utils/notify');

// The public origin the invite link should point at. CLIENT_URL may hold a
// comma-separated list for CORS, so take the first entry.
const clientOrigin = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');

const inviteUrlFor = (joinCode) => `${clientOrigin()}/join/${joinCode.replace('-', '')}`;

// Shape the invite payload the client renders (link, code, constraints)
const invitePayload = (space) => ({
  joinCode: space.joinCode,
  inviteUrl: inviteUrlFor(space.joinCode),
  inviteEnabled: space.inviteEnabled,
  expiresAt: space.joinCodeExpiresAt,
  maxUses: space.joinCodeMaxUses,
  uses: space.joinCodeUses,
  expired: Boolean(space.joinCodeExpiresAt && space.joinCodeExpiresAt < new Date()),
  exhausted: space.joinCodeMaxUses !== null && space.joinCodeUses >= space.joinCodeMaxUses,
  emailEnabled: isConfigured(),
});

// @desc    Get the current invite link/code for a space
// @route   GET /api/spaces/:spaceId/invites
// @access  Private (Member only)
const getInvite = async (req, res, next) => {
  try {
    const space = await StudySpace.findById(req.spaceId).select(
      'joinCode inviteEnabled joinCodeExpiresAt joinCodeMaxUses joinCodeUses'
    );
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    res.status(200).json({ success: true, invite: invitePayload(space) });
  } catch (error) {
    next(error);
  }
};

// @desc    Update invite settings (enabled, expiry, max uses)
// @route   POST /api/spaces/:spaceId/invites
// @access  Private (Owner only)
const updateInvite = async (req, res, next) => {
  try {
    const { inviteEnabled, expiresInDays, maxUses } = req.body;
    const updates = {};

    if (inviteEnabled !== undefined) {
      updates.inviteEnabled = Boolean(inviteEnabled);
    }

    // `null` clears the constraint; a number sets it
    if (expiresInDays !== undefined) {
      if (expiresInDays === null || expiresInDays === '') {
        updates.joinCodeExpiresAt = null;
      } else {
        const days = Number(expiresInDays);
        if (!Number.isFinite(days) || days <= 0 || days > 365) {
          return res.status(400).json({ success: false, message: 'Expiry must be between 1 and 365 days' });
        }
        updates.joinCodeExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
    }

    if (maxUses !== undefined) {
      if (maxUses === null || maxUses === '') {
        updates.joinCodeMaxUses = null;
      } else {
        const limit = Number(maxUses);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
          return res.status(400).json({ success: false, message: 'Maximum uses must be between 1 and 1000' });
        }
        updates.joinCodeMaxUses = limit;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No invite settings to update' });
    }

    const space = await StudySpace.findByIdAndUpdate(req.spaceId, updates, {
      new: true,
      runValidators: true,
    }).select('joinCode inviteEnabled joinCodeExpiresAt joinCodeMaxUses joinCodeUses');

    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    res.status(200).json({ success: true, invite: invitePayload(space) });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate the join code (invalidates the old link)
// @route   POST /api/spaces/:spaceId/invites/regenerate
// @access  Private (Owner only)
const regenerateInvite = async (req, res, next) => {
  try {
    const space = await StudySpace.findById(req.spaceId);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    space.joinCode = await generateJoinCode();
    // A new code starts its own use budget; the old link stops working entirely.
    space.joinCodeUses = 0;
    await space.save();

    await logActivity({
      spaceId: space._id,
      user: req.user,
      type: 'invite_regenerated',
      summary: 'regenerated the invite code',
      targetType: 'space',
      targetId: space._id,
    });

    res.status(200).json({
      success: true,
      message: 'New invite code generated. The previous link no longer works.',
      invite: invitePayload(space),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Email an invite to one or more addresses
// @route   POST /api/spaces/:spaceId/invites/email
// @access  Private (Member only)
const sendEmailInvite = async (req, res, next) => {
  try {
    const { emails, message } = req.body;

    const list = (Array.isArray(emails) ? emails : String(emails || '').split(','))
      .map((e) => String(e).trim().toLowerCase())
      .filter(Boolean);

    if (list.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one email address' });
    }

    if (list.length > 20) {
      return res.status(400).json({ success: false, message: 'You can invite at most 20 people at a time' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const invalid = list.filter((e) => !emailPattern.test(e));
    if (invalid.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid email address: ${invalid.join(', ')}`,
      });
    }

    const space = await StudySpace.findById(req.spaceId).select(
      'name joinCode inviteEnabled joinCodeExpiresAt joinCodeMaxUses joinCodeUses'
    );
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    if (!space.inviteEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Invites are disabled for this space. Enable them before sending invitations.',
      });
    }

    const trimmedMessage = String(message || '').trim().slice(0, 500);
    const joinUrl = inviteUrlFor(space.joinCode);
    const { subject, html, text } = inviteEmail({
      spaceName: space.name,
      inviterName: req.user.name,
      joinCode: space.joinCode,
      joinUrl,
      message: trimmedMessage,
    });

    // Registered recipients also get an in-app notification, which works even
    // when SMTP is not configured (PRD §24).
    const recipients = await User.find({ email: { $in: list } }).select('_id email');
    const existingMembers = new Set(
      (await Membership.find({ spaceId: space._id, userId: { $in: recipients.map((u) => u._id) } })
        .select('userId')
        .lean()
      ).map((m) => String(m.userId))
    );

    await Promise.all(
      recipients
        .filter((u) => !existingMembers.has(String(u._id)))
        .map((u) =>
          notify({
            userId: u._id,
            spaceId: space._id,
            type: 'invite_received',
            title: `${req.user.name} invited you to ${space.name}`,
            body: trimmedMessage || 'Open the invite to join this study space.',
            link: `/join/${space.joinCode.replace('-', '')}`,
          })
        )
    );

    const results = await Promise.all(
      list.map(async (to) => {
        const result = await sendMail({ to, subject, html, text });
        return { email: to, ...result };
      })
    );

    const sent = results.filter((r) => r.sent).map((r) => r.email);
    const failed = results.filter((r) => !r.sent);

    if (sent.length > 0) {
      await logActivity({
        spaceId: space._id,
        user: req.user,
        type: 'invite_sent',
        summary: `invited ${sent.length} ${sent.length === 1 ? 'person' : 'people'} by email`,
        targetType: 'space',
        targetId: space._id,
      });
    }

    // Emails going nowhere is a real failure the owner needs to see, but the
    // in-app invites above already landed, so say both.
    if (sent.length === 0) {
      return res.status(502).json({
        success: false,
        message: isConfigured()
          ? `Could not send the invite email: ${failed[0]?.reason || 'unknown error'}`
          : 'Email is not configured on this server. Share the invite link or code instead.',
        sent,
        failed,
        inviteUrl: joinUrl,
        joinCode: space.joinCode,
      });
    }

    res.status(200).json({
      success: true,
      message:
        failed.length === 0
          ? `Invitation sent to ${sent.length} ${sent.length === 1 ? 'address' : 'addresses'}`
          : `Sent to ${sent.length}, failed for ${failed.length}`,
      sent,
      failed,
      inviteUrl: joinUrl,
      joinCode: space.joinCode,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getInvite, updateInvite, regenerateInvite, sendEmailInvite };
