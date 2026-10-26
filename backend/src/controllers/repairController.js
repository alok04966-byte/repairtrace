const mongoose = require('mongoose');

const Device = require('../models/Device');
const RepairCounter = require('../models/RepairCounter');
const RepairOrder = require('../models/RepairOrder');
const User = require('../models/User');
const { validateCreateRepair } = require('../validators/repairValidators');

function serializeRepair(repair) {
  const device = repair.device;
  return {
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
    createdAt: repair.createdAt,
    updatedAt: repair.updatedAt
  };
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
    return res.status(200).json({ repairs: repairs.map(serializeRepair) });
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
    return res.status(200).json({ repair: serializeRepair(repair) });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createRepair, listRepairs, getRepair };
