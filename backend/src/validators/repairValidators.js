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

function validateDiagnosis(body) {
  const source = isPlainObject(body) ? body : {};
  const errors = {};
  Object.keys(source).forEach((field) => {
    if (!['diagnosis', 'diagnosisNotes'].includes(field)) errors[field] = 'This field is not allowed.';
  });
  const diagnosis = typeof source.diagnosis === 'string' ? source.diagnosis.trim() : '';
  const diagnosisNotes = typeof source.diagnosisNotes === 'string' ? source.diagnosisNotes.trim() : '';
  if (!diagnosis || diagnosis.length > 2000) errors.diagnosis = 'Diagnosis is required and must be at most 2000 characters.';
  if (source.diagnosisNotes !== undefined && (typeof source.diagnosisNotes !== 'string' || diagnosisNotes.length > 2000)) {
    errors.diagnosisNotes = 'Diagnosis notes must be text of at most 2000 characters.';
  }
  return { errors, value: { diagnosis, diagnosisNotes } };
}

function validateQuote(body) {
  const source = isPlainObject(body) ? body : {};
  const errors = {};
  Object.keys(source).forEach((field) => { if (field !== 'items') errors[field] = 'This field is not allowed.'; });
  const items = source.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    errors.items = 'Items must contain between 1 and 50 entries.';
    return { errors, value: { items: [] } };
  }
  const value = items.map((item, index) => {
    if (!isPlainObject(item) || Object.keys(item).some((field) => !['description', 'quantity', 'unitPrice'].includes(field))) {
      errors[`items.${index}`] = 'Each item must contain only description, quantity, and unitPrice.';
      return null;
    }
    const description = typeof item.description === 'string' ? item.description.trim() : '';
    const quantity = item.quantity;
    const price = item.unitPrice;
    if (!description || description.length > 300) errors[`items.${index}.description`] = 'Description is required and must be at most 300 characters.';
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) errors[`items.${index}.quantity`] = 'Quantity must be a whole number between 1 and 1000.';
    // A string form prevents floating-point rounding. Numeric input is accepted only when it has at most two decimals.
    const priceText = typeof price === 'string' ? price.trim() : (typeof price === 'number' && Number.isFinite(price) ? String(price) : '');
    if (!/^\d+(?:\.\d{1,2})?$/.test(priceText)) errors[`items.${index}.unitPrice`] = 'Unit price must be a nonnegative INR amount with at most two decimals.';
    const [whole, fraction = ''] = priceText.split('.');
    const unitPricePaise = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
    if (!Number.isSafeInteger(unitPricePaise) || unitPricePaise > 100000000) errors[`items.${index}.unitPrice`] = 'Unit price is too large.';
    return { description, quantity, unitPricePaise, lineTotalPaise: quantity * unitPricePaise };
  });
  return { errors, value: { items: value.filter(Boolean) } };
}

function validateDecision(body) {
  const source = isPlainObject(body) ? body : {};
  const errors = {};
  Object.keys(source).forEach((field) => { if (field !== 'decision') errors[field] = 'This field is not allowed.'; });
  const decision = typeof source.decision === 'string' ? source.decision.trim().toLowerCase() : '';
  if (!['approved', 'declined'].includes(decision)) errors.decision = 'Decision must be approved or declined.';
  return { errors, value: { decision } };
}

function validateStatusChange(body) {
  const source = isPlainObject(body) ? body : {};
  const errors = {};
  Object.keys(source).forEach((field) => { if (!['status', 'reason', 'resolutionNote'].includes(field)) errors[field] = 'This field is not allowed.'; });
  const status = typeof source.status === 'string' ? source.status.trim() : '';
  const reason = typeof source.reason === 'string' ? source.reason.trim() : '';
  const resolutionNote = typeof source.resolutionNote === 'string' ? source.resolutionNote.trim() : '';
  if (!['awaiting_parts', 'in_progress'].includes(status)) errors.status = 'Status must be awaiting_parts or in_progress.';
  if (status === 'awaiting_parts' && (!reason || reason.length > 500)) errors.reason = 'A non-empty blocker reason of at most 500 characters is required.';
  if (status === 'in_progress' && (!resolutionNote || resolutionNote.length > 500)) errors.resolutionNote = 'A non-empty resolution note of at most 500 characters is required.';
  return { errors, value: { status, reason, resolutionNote } };
}

module.exports = { validateCreateRepair, validateDiagnosis, validateQuote, validateDecision, validateStatusChange };
