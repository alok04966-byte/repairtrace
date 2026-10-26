const mongoose = require('mongoose');

const Device = require('../models/Device');
const RepairCounter = require('../models/RepairCounter');
const RepairOrder = require('../models/RepairOrder');
const User = require('../models/User');
const { validateCreateRepair, validateDiagnosis, validateQuote, validateDecision, validateStatusChange } = require('../validators/repairValidators');

function serializeQuote(quote) {
  const result = {
    version: quote.version,
    items: quote.items.map((item) => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPricePaise / 100, lineTotal: item.lineTotalPaise / 100 })),
    total: quote.totalPaise / 100,
    status: quote.status,
    createdBy: quote.createdBy.toString(),
    createdAt: quote.createdAt,
    decidedBy: quote.decidedBy ? quote.decidedBy.toString() : undefined,
    decidedAt: quote.decidedAt
  };
  return result;
}

function serializeRepair(repair, includeStaffFields = true) {
  const device = repair.device;
  const result = {
    id: repair._id.toString(),
    repairNumber: repair.repairNumber,
    repairReference: `RT-${String(repair.repairNumber).padStart(6, '0')}`,
    customerId: repair.customer.toString(),
    device: {
      id: device._id.toString(),
      type: device.type,
      brand: device.brand,
      model: device.model,
      manufacturerSerialNumber: device.manufacturerSerialNumber || undefined
    },
    reportedIssue: repair.reportedIssue,
    intakeCondition: repair.intakeCondition,
    intakeNotes: repair.intakeNotes,
    accessories: repair.accessories,
    status: repair.status,
    quotes: repair.quotes.map(serializeQuote),
    history: repair.history.filter((event) => includeStaffFields || event.customerSafe).map((event) => ({
      type: event.type, actor: event.actor.toString(), quoteVersion: event.quoteVersion, reason: event.reason, createdAt: event.createdAt
    })),
    partsBlocker: repair.partsBlocker && repair.partsBlocker.reason ? { reason: repair.partsBlocker.reason } : undefined,
    createdAt: repair.createdAt,
    updatedAt: repair.updatedAt
  };
  if (includeStaffFields) {
    result.diagnosis = repair.diagnosis;
    result.diagnosisNotes = repair.diagnosisNotes;
  }
  return result;
}

async function nextRepairNumber() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const counter = await RepairCounter.findByIdAndUpdate(
        'repairNumber',
        { $inc: { sequence: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return counter.sequence;
    } catch (error) {
      if (!error || error.code !== 11000 || attempt === 1) throw error;
    }
  }

  throw new Error('Unable to allocate repair number.');
}

async function createRepair(req, res, next) {
  const { errors, value } = validateCreateRepair(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  let device;
  try {
    const customer = await User.findById(value.customerId);
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const repairNumber = await nextRepairNumber();
    device = await Device.create({ customer: customer._id, ...value.device });
    const repair = await RepairOrder.create({
      repairNumber,
      customer: customer._id,
      device: device._id,
      createdBy: req.user._id,
      reportedIssue: value.reportedIssue,
      intakeCondition: value.intakeCondition,
      intakeNotes: value.intakeNotes,
      accessories: value.accessories,
      status: 'received'
    });

    return res.status(201).json({ repair: serializeRepair({ ...repair.toObject(), device: device.toObject() }) });
  } catch (error) {
    if (device) await Device.findByIdAndDelete(device._id);
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'Unable to create a unique repair record. Please try again.' });
    }
    return next(error);
  }
}

async function listRepairs(req, res, next) {
  try {
    const filter = req.user.role === 'staff' ? {} : { customer: req.user._id };
    const repairs = await RepairOrder.find(filter).sort({ repairNumber: 1 }).populate('device');
    return res.status(200).json({ repairs: repairs.map((repair) => serializeRepair(repair, req.user.role === 'staff')) });
  } catch (error) {
    return next(error);
  }
}

async function getRepair(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ error: 'Repair ID must be valid.' });
  }

  try {
    const filter = { _id: req.params.id };
    if (req.user.role !== 'staff') filter.customer = req.user._id;

    const repair = await RepairOrder.findOne(filter).populate('device');
    if (!repair) return res.status(404).json({ error: 'Repair order not found.' });
    return res.status(200).json({ repair: serializeRepair(repair, req.user.role === 'staff') });
  } catch (error) {
    return next(error);
  }
}

function validRepairId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function addHistory(repair, type, actor, options = {}) {
  repair.history.push({ type, actor: actor._id, quoteVersion: options.quoteVersion, reason: options.reason, customerSafe: options.customerSafe !== false, createdAt: new Date() });
}

async function loadRepairForStaff(id) {
  return RepairOrder.findById(id).populate('device');
}

async function saveWithRetry(id, operation) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const repair = await loadRepairForStaff(id);
    if (!repair) return { missing: true };
    const outcome = operation(repair);
    if (outcome && outcome.error) return outcome;
    try {
      await repair.save();
      return { repair };
    } catch (error) {
      if (error.name !== 'VersionError' || attempt === 3) throw error;
    }
  }
  return { error: 'Concurrent update conflict. Please try again.', status: 409 };
}

async function recordDiagnosis(req, res, next) {
  if (!validRepairId(req.params.id)) return res.status(400).json({ error: 'Repair ID must be valid.' });
  const { errors, value } = validateDiagnosis(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed.', details: errors });
  try {
    const result = await saveWithRetry(req.params.id, (repair) => {
      if (['awaiting_parts', 'in_progress'].includes(repair.status)) return { error: 'Diagnosis cannot be changed while repair work is active or blocked for parts.', status: 409 };
      const changing = repair.diagnosis && repair.diagnosis !== value.diagnosis;
      if (changing && repair.quotes.some((quote) => quote.status !== 'superseded')) {
        repair.quotes.forEach((quote) => { if (quote.status !== 'superseded') { quote.status = 'superseded'; addHistory(repair, 'quotation_superseded', req.user, { quoteVersion: quote.version }); } });
      }
      repair.diagnosis = value.diagnosis;
      repair.diagnosisNotes = value.diagnosisNotes;
      const previousStatus = repair.status;
      repair.status = 'diagnosing';
      addHistory(repair, changing ? 'diagnosis_updated' : 'diagnosis_created', req.user, { customerSafe: true });
      if (previousStatus !== repair.status) addHistory(repair, 'status_changed', req.user, { reason: repair.status });
    });
    if (result.missing) return res.status(404).json({ error: 'Repair order not found.' });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    return res.status(200).json({ repair: serializeRepair(result.repair) });
  } catch (error) { return next(error); }
}

async function createQuote(req, res, next) {
  if (!validRepairId(req.params.id)) return res.status(400).json({ error: 'Repair ID must be valid.' });
  const { errors, value } = validateQuote(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed.', details: errors });
  try {
    const result = await saveWithRetry(req.params.id, (repair) => {
      if (!repair.diagnosis) return { error: 'A diagnosis is required before creating a quotation.', status: 409 };
      if (repair.status === 'awaiting_parts') return { error: 'Resolve the parts blocker before revising the quotation.', status: 409 };
      repair.quotes.forEach((quote) => { if (quote.status !== 'superseded') { quote.status = 'superseded'; addHistory(repair, 'quotation_superseded', req.user, { quoteVersion: quote.version }); } });
      const version = repair.quotes.reduce((highest, quote) => Math.max(highest, quote.version), 0) + 1;
      const totalPaise = value.items.reduce((total, item) => total + item.lineTotalPaise, 0);
      if (!Number.isSafeInteger(totalPaise) || totalPaise > 1000000000) return { error: 'Quotation total is too large.', status: 400 };
      repair.quotes.push({ version, items: value.items, totalPaise, status: 'pending', createdBy: req.user._id, createdAt: new Date() });
      repair.status = 'awaiting_approval';
      addHistory(repair, 'quotation_created', req.user, { quoteVersion: version });
      addHistory(repair, 'status_changed', req.user, { reason: 'awaiting_approval' });
    });
    if (result.missing) return res.status(404).json({ error: 'Repair order not found.' });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    return res.status(201).json({ quote: serializeQuote(result.repair.quotes[result.repair.quotes.length - 1]), repair: serializeRepair(result.repair) });
  } catch (error) { return next(error); }
}

async function listQuotes(req, res, next) {
  if (!validRepairId(req.params.id)) return res.status(400).json({ error: 'Repair ID must be valid.' });
  try {
    const filter = { _id: req.params.id };
    if (req.user.role !== 'staff') filter.customer = req.user._id;
    const repair = await RepairOrder.findOne(filter);
    if (!repair) return res.status(404).json({ error: 'Repair order not found.' });
    return res.status(200).json({ quotes: repair.quotes.map(serializeQuote) });
  } catch (error) { return next(error); }
}

async function decideQuote(req, res, next) {
  if (!validRepairId(req.params.id) || !/^\d+$/.test(req.params.version)) return res.status(400).json({ error: 'Repair ID and quotation version must be valid.' });
  const { errors, value } = validateDecision(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed.', details: errors });
  try {
    const result = await saveWithRetry(req.params.id, (repair) => {
      if (repair.customer.toString() !== req.user._id.toString()) return { error: 'Repair order not found.', status: 404 };
      const version = Number(req.params.version);
      const quote = repair.quotes.find((entry) => entry.version === version);
      const latest = repair.quotes.reduce((highest, entry) => Math.max(highest, entry.version), 0);
      if (!quote || version !== latest || quote.status !== 'pending' || repair.status !== 'awaiting_approval') return { error: 'Only the latest pending quotation can be decided.', status: 409 };
      quote.status = value.decision;
      quote.decidedBy = req.user._id;
      quote.decidedAt = new Date();
      repair.status = value.decision === 'approved' ? (repair.partsBlocker && repair.partsBlocker.reason ? 'awaiting_parts' : 'in_progress') : 'diagnosing';
      addHistory(repair, `quotation_${value.decision}`, req.user, { quoteVersion: version });
      addHistory(repair, 'status_changed', req.user, { reason: repair.status });
    });
    if (result.missing || (result.error && result.status === 404)) return res.status(404).json({ error: 'Repair order not found.' });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    return res.status(200).json({ quote: serializeQuote(result.repair.quotes.find((quote) => quote.version === Number(req.params.version))), repair: serializeRepair(result.repair, false) });
  } catch (error) { return next(error); }
}

async function changeRepairStatus(req, res, next) {
  if (!validRepairId(req.params.id)) return res.status(400).json({ error: 'Repair ID must be valid.' });
  const { errors, value } = validateStatusChange(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed.', details: errors });
  try {
    const result = await saveWithRetry(req.params.id, (repair) => {
      const approved = repair.quotes.some((quote) => quote.status === 'approved' && quote.version === Math.max(...repair.quotes.map((entry) => entry.version)));
      if (value.status === 'awaiting_parts') {
        if (repair.status !== 'in_progress' || !approved) return { error: 'Only an approved repair in progress can be blocked for parts.', status: 409 };
        repair.partsBlocker = { reason: value.reason, addedBy: req.user._id, addedAt: new Date() };
        repair.status = 'awaiting_parts'; addHistory(repair, 'parts_blocker_added', req.user, { reason: value.reason });
      } else {
        if (repair.status !== 'awaiting_parts' || !approved) return { error: 'Only an approved repair awaiting parts can return to work.', status: 409 };
        repair.partsBlocker = undefined; repair.status = 'in_progress'; addHistory(repair, 'parts_blocker_cleared', req.user, { reason: value.resolutionNote });
      }
      addHistory(repair, 'status_changed', req.user, { reason: repair.status });
    });
    if (result.missing) return res.status(404).json({ error: 'Repair order not found.' });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    return res.status(200).json({ repair: serializeRepair(result.repair) });
  } catch (error) { return next(error); }
}

module.exports = { createRepair, listRepairs, getRepair, recordDiagnosis, createQuote, listQuotes, decideQuote, changeRepairStatus };
