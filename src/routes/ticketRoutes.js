const express = require('express');
const multer = require('multer');
const ticketController = require('../controllers/ticketController');
const { requireLogin, requireStaff, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
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

router.get('/', requireLogin, ticketController.list);
router.get('/new', requireLogin, requireRole(ROLES.CLIENT), ticketController.showCreateForm);
router.post('/', requireLogin, requireRole(ROLES.CLIENT), handleUpload, ticketController.create);
router.get('/:id', requireLogin, ticketController.detail);
router.post('/:id/reply', requireLogin, ticketController.reply);
router.post('/:id/status', requireLogin, requireStaff, ticketController.updateStatus);
router.post('/:id/priority', requireLogin, requireStaff, ticketController.updatePriority);
router.post('/:id/assign', requireLogin, requireStaff, ticketController.assign);
router.post('/:id/close', requireLogin, ticketController.close);
router.post('/:id/reopen', requireLogin, ticketController.reopen);

module.exports = router;
