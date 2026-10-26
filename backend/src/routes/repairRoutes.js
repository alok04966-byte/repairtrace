const express = require('express');

const { createRepair, listRepairs, getRepair, recordDiagnosis, createQuote, listQuotes, decideQuote, changeRepairStatus } = require('../controllers/repairController');
const { requireAuth, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.post('/', authorizeRoles('staff'), createRepair);
router.get('/', listRepairs);
router.patch('/:id/diagnosis', authorizeRoles('staff'), recordDiagnosis);
router.post('/:id/quotes', authorizeRoles('staff'), createQuote);
router.get('/:id/quotes', listQuotes);
router.post('/:id/quotes/:version/decision', authorizeRoles('customer'), decideQuote);
router.patch('/:id/status', authorizeRoles('staff'), changeRepairStatus);
router.get('/:id', getRepair);

module.exports = router;
