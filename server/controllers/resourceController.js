const fs = require('fs/promises');
const path = require('path');
const Resource = require('../models/Resource');
const Pin = require('../models/Pin');
const Highlight = require('../models/Highlight');
const logActivity = require('../utils/logActivity');
const { getIo } = require('../config/socket');
const { UPLOAD_DIR, ALLOWED_MIME } = require('../middleware/upload');

// Only http(s) — a stored `javascript:` or `data:` URL would run in another
// member's browser the moment they clicked the resource.
const isSafeUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// Remove an upload from disk. Best-effort: a missing file must not block the
// DB row from being deleted.
const removeFile = (storedName) =>
  storedName ? fs.unlink(path.join(UPLOAD_DIR, storedName)).catch(() => {}) : Promise.resolve();

// @desc    List resources in a space
// @route   GET /api/spaces/:spaceId/resources
// @access  Private (Member only)
const getResources = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const query = { spaceId: req.spaceId };

    if (req.query.type) {
      query.type = req.query.type;
    }
    if (req.query.before) {
      query.createdAt = { $lt: new Date(req.query.before) };
    }

    const resources = await Resource.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = resources.length > limit;
    if (hasMore) resources.pop();

    res.status(200).json({
      success: true,
      count: resources.length,
      hasMore,
      resources,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a resource — an uploaded file, a link, or a code snippet
// @route   POST /api/spaces/:spaceId/resources
// @access  Private (Member only)
const createResource = async (req, res, next) => {
  try {
    const { title, description, url, type, code, language } = req.body;

    if (!title || !String(title).trim()) {
      // The file is already on disk by the time multer hands off, so a rejected
      // request has to clean up after itself.
      if (req.file) await removeFile(req.file.filename);
      return res.status(400).json({ success: false, message: 'Please provide a title' });
    }

    const doc = {
      spaceId: req.spaceId,
      uploadedBy: req.user.id,
      uploadedByName: req.user.name,
      title: String(title).trim(),
      description: String(description || '').trim(),
      metadata: {},
    };

    if (req.file) {
      const { type: fileType } = ALLOWED_MIME[req.file.mimetype] || { type: 'file' };
      doc.type = fileType;
      doc.url = `/uploads/${req.file.filename}`;
      doc.metadata = {
        fileName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        storedName: req.file.filename,
      };
    } else if (type === 'code') {
      if (!code || !String(code).trim()) {
        return res.status(400).json({ success: false, message: 'Please provide the code snippet' });
      }
      if (String(code).length > 20000) {
        return res.status(400).json({ success: false, message: 'Code snippet cannot exceed 20,000 characters' });
      }
      doc.type = 'code';
      // Snippets have no external target; the body lives in metadata
      doc.url = '';
      doc.metadata = { code: String(code), language: String(language || 'plaintext').slice(0, 30) };
    } else {
      if (!url || !String(url).trim()) {
        return res.status(400).json({ success: false, message: 'Please provide a URL or upload a file' });
      }
      if (!isSafeUrl(String(url).trim())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid http:// or https:// URL',
        });
      }
      doc.type = 'link';
      doc.url = String(url).trim();
    }

    // `url` is required on the model, so a code snippet needs the check relaxed
    // for its one legitimately empty case.
    const resource = doc.type === 'code'
      ? await new Resource({ ...doc, url: 'about:blank' }).save()
      : await Resource.create(doc);

    await logActivity({
      spaceId: req.spaceId,
      user: req.user,
      type: 'resource_added',
      summary: `added ${doc.type === 'link' ? 'a link' : doc.type === 'code' ? 'a code snippet' : `"${resource.title}"`}`,
      targetType: 'resource',
      targetId: resource._id,
    });

    getIo().to(`space:${req.spaceId}`).emit('resource_added', resource.toObject());

    res.status(201).json({ success: true, resource });
  } catch (error) {
    if (req.file) await removeFile(req.file.filename);
    next(error);
  }
};

// @desc    Delete a resource
// @route   DELETE /api/spaces/:spaceId/resources/:resourceId
// @access  Private (Uploader or space owner)
const deleteResource = async (req, res, next) => {
  try {
    const resource = await Resource.findOne({
      _id: req.params.resourceId,
      spaceId: req.spaceId,
    });

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }

    // Members clean up after themselves; the owner can remove anything (PRD §22)
    const isUploader = String(resource.uploadedBy) === String(req.user.id);
    if (!isUploader && req.membership.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only the person who added this resource, or the space owner, can delete it',
      });
    }

    await removeFile(resource.metadata?.storedName);

    // Pins and highlights pointing at it would otherwise dangle
    await Promise.all([
      Resource.deleteOne({ _id: resource._id }),
      Pin.deleteMany({ spaceId: req.spaceId, sourceType: 'resource', sourceId: resource._id }),
      Highlight.deleteMany({ spaceId: req.spaceId, sourceType: 'resource', sourceId: resource._id }),
    ]);

    await logActivity({
      spaceId: req.spaceId,
      user: req.user,
      type: 'resource_deleted',
      summary: `removed "${resource.title}"`,
      targetType: 'resource',
      targetId: resource._id,
    });

    getIo().to(`space:${req.spaceId}`).emit('resource_deleted', {
      spaceId: req.spaceId,
      resourceId: resource._id,
    });

    res.status(200).json({ success: true, message: 'Resource deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getResources, createResource, deleteResource };
