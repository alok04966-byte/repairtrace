const mongoose = require('mongoose');

const quoteItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true, maxlength: 300 },
  quantity: { type: Number, required: true, min: 1, max: 1000 },
  unitPricePaise: { type: Number, required: true, min: 0 },
  lineTotalPaise: { type: Number, required: true, min: 0 }
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  version: { type: Number, required: true, min: 1 },
  items: { type: [quoteItemSchema], required: true },
  totalPaise: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending', 'approved', 'declined', 'superseded'], required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, required: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date
}, { _id: false });

const historySchema = new mongoose.Schema({
  type: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quoteVersion: Number,
  reason: { type: String, trim: true, maxlength: 500 },
  customerSafe: { type: Boolean, default: true },
  createdAt: { type: Date, required: true }
}, { _id: false });

const repairOrderSchema = new mongoose.Schema(
  {
    repairNumber: { type: Number, required: true, unique: true, min: 1, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedIssue: { type: String, required: true, trim: true, minlength: 5, maxlength: 2000 },
    intakeCondition: { type: String, required: true, trim: true, minlength: 2, maxlength: 2000 },
    intakeNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    accessories: [{ type: String, trim: true, minlength: 1, maxlength: 100 }],
    diagnosis: { type: String, trim: true, maxlength: 2000, default: '' },
    diagnosisNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    quotes: { type: [quoteSchema], default: [] },
    history: { type: [historySchema], default: [] },
    partsBlocker: {
      reason: { type: String, trim: true, maxlength: 500 },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      addedAt: Date
    },
    status: { type: String, enum: ['received', 'diagnosing', 'awaiting_approval', 'awaiting_parts', 'in_progress'], default: 'received' }
  },
  { timestamps: true, optimisticConcurrency: true }
);

repairOrderSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('RepairOrder', repairOrderSchema);
