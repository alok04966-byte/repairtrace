const express = require('express');

const { createRepair, listRepairs, getRepair, recordDiagnosis, createQuote, listQuotes, decideQuote, changeRepairStatus, updateQualityChecks, recordHandover } = require('../controllers/repairController');
const { requireAuth, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.post('/', authorizeRoles('staff'), createRepair);
router.get('/', listRepairs);
router.patch('/:id/diagnosis', authorizeRoles('staff'), recordDiagnosis);
router.post('/:id/quotes', authorizeRoles('staff'), createQuote);
router.get('/:id/quotes', listQuotes);
router.post('/:id/quotes/:version/decision', authorizeRoles('customer'), decideQuote);
router.patch('/:id/quality-checks', authorizeRoles('staff'), updateQualityChecks);
router.patch('/:id/status', authorizeRoles('staff'), changeRepairStatus);
router.post('/:id/handover', authorizeRoles('staff'), recordHandover);
router.get('/:id', getRepair);

module.exports = router;
