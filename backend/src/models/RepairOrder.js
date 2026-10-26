const mongoose = require('mongoose');

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
    status: { type: String, enum: ['received'], default: 'received', immutable: true }
  },
  { timestamps: true }
);

repairOrderSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('RepairOrder', repairOrderSchema);
