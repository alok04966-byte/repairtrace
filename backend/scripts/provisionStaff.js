const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const connectDatabase = require('../src/config/db');
const { provisionStaff } = require('../src/services/staffProvisioning');
const { validateStaffProvisioningConfig } = require('../src/validators/staffProvisioningValidators');

function reportOutcome(outcome) {
  const messages = {
    created: 'Staff account created.',
    promoted: 'Existing customer account promoted to staff.',
    'already-staff': 'Account is already staff; no changes were made.',
    'account-exists': 'An account with this email already exists; use STAFF_PROVISION_MODE=promote to promote a customer.',
    'not-found': 'No account exists for STAFF_EMAIL; no changes were made.',
    'not-promoted': 'Account was not promoted because it changed during provisioning.'
  };

  const isSuccess = outcome === 'created' || outcome === 'promoted' || outcome === 'already-staff';
  const log = isSuccess ? console.log : console.error;
  log(messages[outcome]);
  if (!isSuccess) process.exitCode = 1;
}

async function runProvisioning() {
  const { errors, value } = validateStaffProvisioningConfig(process.env);

  if (Object.keys(errors).length > 0) {
    console.error(`Staff provisioning configuration is invalid: ${Object.keys(errors).join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  try {
    await connectDatabase(process.env.MONGODB_URI);

    const { outcome } = await provisionStaff(value);
    reportOutcome(outcome);
  } catch (error) {
    if (error && error.code === 11000) {
      console.error('An account with this email already exists; no changes were made.');
    } else {
      console.error('Unable to provision staff account.');
    }
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runProvisioning();
