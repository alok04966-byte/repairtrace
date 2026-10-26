const mongoose = require('mongoose');

const DEVICE_TYPES = ['laptop', 'phone'];
const ALLOWED_FIELDS = ['customerId', 'device', 'reportedIssue', 'intakeCondition', 'intakeNotes', 'accessories'];
const ALLOWED_DEVICE_FIELDS = ['type', 'brand', 'model', 'manufacturerSerialNumber'];

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validateCreateRepair(body) {
  const errors = {};
  const source = isPlainObject(body) ? body : {};

  Object.keys(source).forEach((field) => {
    if (!ALLOWED_FIELDS.includes(field)) errors[field] = 'This field is not allowed.';
  });

  const customerId = typeof source.customerId === 'string' ? source.customerId.trim() : '';
  if (!mongoose.isObjectIdOrHexString(customerId)) errors.customerId = 'Customer ID must be valid.';

  const deviceSource = isPlainObject(source.device) ? source.device : null;
  if (!deviceSource) {
    errors.device = 'Device details are required.';
  } else {
    Object.keys(deviceSource).forEach((field) => {
      if (!ALLOWED_DEVICE_FIELDS.includes(field)) errors[`device.${field}`] = 'This field is not allowed.';
    });
  }

  const type = deviceSource && typeof deviceSource.type === 'string' ? deviceSource.type.trim().toLowerCase() : '';
  if (!DEVICE_TYPES.includes(type)) errors['device.type'] = 'Device type must be laptop or phone.';

  const brand = deviceSource && typeof deviceSource.brand === 'string' ? deviceSource.brand.trim() : '';
  if (!brand || brand.length > 100) errors['device.brand'] = 'Device brand is required and must be at most 100 characters.';

  const model = deviceSource && typeof deviceSource.model === 'string' ? deviceSource.model.trim() : '';
  if (!model || model.length > 100) errors['device.model'] = 'Device model is required and must be at most 100 characters.';

  const manufacturerSerialNumber = deviceSource && typeof deviceSource.manufacturerSerialNumber === 'string'
    ? deviceSource.manufacturerSerialNumber.trim() : '';
  if (deviceSource && deviceSource.manufacturerSerialNumber !== undefined && typeof deviceSource.manufacturerSerialNumber !== 'string') {
    errors['device.manufacturerSerialNumber'] = 'Manufacturer serial number must be text.';
  } else if (manufacturerSerialNumber.length > 100) {
    errors['device.manufacturerSerialNumber'] = 'Manufacturer serial number must be at most 100 characters.';
  }

  const reportedIssue = typeof source.reportedIssue === 'string' ? source.reportedIssue.trim() : '';
  if (reportedIssue.length < 5 || reportedIssue.length > 2000) errors.reportedIssue = 'Reported issue must be between 5 and 2000 characters.';

  const intakeCondition = typeof source.intakeCondition === 'string' ? source.intakeCondition.trim() : '';
  if (intakeCondition.length < 2 || intakeCondition.length > 2000) errors.intakeCondition = 'Intake condition must be between 2 and 2000 characters.';

  const intakeNotes = typeof source.intakeNotes === 'string' ? source.intakeNotes.trim() : '';
  if (source.intakeNotes !== undefined && typeof source.intakeNotes !== 'string') errors.intakeNotes = 'Intake notes must be text.';
  else if (intakeNotes.length > 2000) errors.intakeNotes = 'Intake notes must be at most 2000 characters.';

  const accessories = source.accessories === undefined ? [] : source.accessories;
  if (!Array.isArray(accessories)) {
    errors.accessories = 'Accessories must be an array of text values.';
  } else if (accessories.length > 20 || accessories.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > 100)) {
    errors.accessories = 'Accessories must contain up to 20 non-empty text values of at most 100 characters.';
  }

  return {
    errors,
    value: {
      customerId,
      device: { type, brand, model, manufacturerSerialNumber: manufacturerSerialNumber || undefined },
      reportedIssue,
      intakeCondition,
      intakeNotes,
      accessories: Array.isArray(accessories) ? accessories.map((item) => item.trim()) : []
    }
  };
}

module.exports = { validateCreateRepair };
