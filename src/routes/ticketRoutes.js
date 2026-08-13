const express = require('express');
const multer = require('multer');
const ticketController = require('../controllers/ticketController');
const categoryModel = require('../models/categoryModel');
const { requireLogin, requireStaff, requireRole, requirePermission } = require('../middleware/auth');
const { verifyCsrfTokenAfterUpload } = require('../middleware/csrf');
const { upload } = require('../middleware/upload');
const { asyncHandler } = require('../utils/asyncHandler');
const { setFlash } = require('../utils/flash');
const { ROLES, MAX_UPLOAD_FILES, PRIORITIES } = require('../config/constants');

const router = express.Router();

function multerErrorMessage(err) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return 'One or more files exceed the 10MB limit.';
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') return `You can attach up to ${MAX_UPLOAD_FILES} files.`;
  if (err.message === 'UNSUPPORTED_FILE_TYPE') return 'One or more files have an unsupported file type.';
  return 'File upload failed. Please try again.';
}

function handleCreateUpload(req, res, next) {
  upload.array('attachments', MAX_UPLOAD_FILES)(req, res, async (err) => {
    if (!err) return next();
    const categories = await categoryModel.listWithSubcategories();
    return res.status(400).render('tickets/create', {
      title: 'Create Ticket',
      categories,
      priorities: PRIORITIES,
      errors: { attachments: multerErrorMessage(err) },
      formData: req.body,
    });
  });
}

function handleReplyUpload(req, res, next) {
  upload.array('attachments', MAX_UPLOAD_FILES)(req, res, (err) => {
    if (!err) return next();
    setFlash(req, 'error', multerErrorMessage(err));
    return res.redirect(`/tickets/${req.params.id}`);
  });
}

router.get('/', requireLogin, asyncHandler(ticketController.list));
router.get('/new', requireLogin, requireRole(ROLES.CLIENT), asyncHandler(ticketController.showCreateForm));
router.post('/', requireLogin, requireRole(ROLES.CLIENT), handleCreateUpload, verifyCsrfTokenAfterUpload, asyncHandler(ticketController.create));
// Registered before the /:id routes below so "bulk"/"archive" are never captured as an id param.
router.post('/bulk/assign', requireLogin, requireStaff, asyncHandler(ticketController.bulkAssign));
router.post('/bulk/status', requireLogin, requireStaff, asyncHandler(ticketController.bulkStatus));
router.post('/bulk/archive', requireLogin, requireStaff, asyncHandler(ticketController.bulkArchive));
router.get('/archive', requireLogin, asyncHandler(ticketController.archiveList));

router.get('/:id', requireLogin, asyncHandler(ticketController.detail));
router.post('/:id/reply', requireLogin, handleReplyUpload, verifyCsrfTokenAfterUpload, asyncHandler(ticketController.reply));
router.post('/:id/status', requireLogin, requireStaff, asyncHandler(ticketController.updateStatus));
router.post('/:id/priority', requireLogin, requireStaff, asyncHandler(ticketController.updatePriority));
router.post('/:id/assign', requireLogin, requireStaff, asyncHandler(ticketController.assign));
router.post('/:id/escalate', requireLogin, requireStaff, requirePermission('escalate_tickets'), asyncHandler(ticketController.escalate));
router.post('/:id/link', requireLogin, requireStaff, requirePermission('merge_tickets'), asyncHandler(ticketController.link));
router.post('/:id/rating', requireLogin, requireRole(ROLES.CLIENT), asyncHandler(ticketController.rate));
router.post('/:id/close', requireLogin, asyncHandler(ticketController.close));
router.post('/:id/reopen', requireLogin, asyncHandler(ticketController.reopen));
router.post('/:id/archive', requireLogin, asyncHandler(ticketController.archive));
router.post('/:id/restore', requireLogin, requireStaff, asyncHandler(ticketController.restore));

module.exports = router;
