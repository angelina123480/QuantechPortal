const express = require('express');
const multer = require('multer');
const ticketController = require('../controllers/ticketController');
const { requireLogin, requireStaff, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { asyncHandler } = require('../utils/asyncHandler');
const { ROLES, MAX_UPLOAD_FILES, CATEGORIES, PRIORITIES } = require('../config/constants');

const router = express.Router();

function handleUpload(req, res, next) {
  upload.array('attachments', MAX_UPLOAD_FILES)(req, res, (err) => {
    if (!err) return next();

    let message = 'File upload failed. Please try again.';
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      message = 'One or more files exceed the 10MB limit.';
    } else if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') {
      message = `You can attach up to ${MAX_UPLOAD_FILES} files.`;
    } else if (err.message === 'UNSUPPORTED_FILE_TYPE') {
      message = 'One or more files have an unsupported file type.';
    }

    return res.status(400).render('tickets/create', {
      title: 'Create Ticket',
      categories: CATEGORIES,
      priorities: PRIORITIES,
      errors: { attachments: message },
      formData: req.body,
    });
  });
}

router.get('/', requireLogin, asyncHandler(ticketController.list));
router.get('/new', requireLogin, requireRole(ROLES.CLIENT), ticketController.showCreateForm);
router.post('/', requireLogin, requireRole(ROLES.CLIENT), handleUpload, asyncHandler(ticketController.create));
// Registered before the /:id routes below so "bulk" is never captured as an id param.
router.post('/bulk/assign', requireLogin, requireStaff, asyncHandler(ticketController.bulkAssign));
router.post('/bulk/status', requireLogin, requireStaff, asyncHandler(ticketController.bulkStatus));

router.get('/:id', requireLogin, asyncHandler(ticketController.detail));
router.post('/:id/reply', requireLogin, asyncHandler(ticketController.reply));
router.post('/:id/status', requireLogin, requireStaff, asyncHandler(ticketController.updateStatus));
router.post('/:id/priority', requireLogin, requireStaff, asyncHandler(ticketController.updatePriority));
router.post('/:id/assign', requireLogin, requireStaff, asyncHandler(ticketController.assign));
router.post('/:id/close', requireLogin, asyncHandler(ticketController.close));
router.post('/:id/reopen', requireLogin, asyncHandler(ticketController.reopen));

module.exports = router;
