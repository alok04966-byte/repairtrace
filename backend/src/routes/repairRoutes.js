const express = require('express');

const { createRepair, listRepairs, getRepair } = require('../controllers/repairController');
const { requireAuth, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.post('/', authorizeRoles('staff'), createRepair);
router.get('/', listRepairs);
router.get('/:id', getRepair);

module.exports = router;
