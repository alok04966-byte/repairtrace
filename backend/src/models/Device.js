const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['laptop', 'phone'], required: true },
    brand: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    model: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    manufacturerSerialNumber: { type: String, trim: true, maxlength: 100 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);
