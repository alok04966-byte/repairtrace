const { validateRegistration } = require('./authValidators');

function validateStaffProvisioningConfig(environment) {
  const errors = {};
  const mongodbUri = typeof environment.MONGODB_URI === 'string' ? environment.MONGODB_URI.trim() : '';
  if (!/^mongodb(\+srv)?:\/\//.test(mongodbUri)) errors.MONGODB_URI = 'must be a MongoDB connection string.';

  const mode = typeof environment.STAFF_PROVISION_MODE === 'string' && environment.STAFF_PROVISION_MODE.trim()
    ? environment.STAFF_PROVISION_MODE.trim().toLowerCase() : 'create';
  if (!['create', 'promote'].includes(mode)) errors.STAFF_PROVISION_MODE = 'must be create or promote.';

  const email = typeof environment.STAFF_EMAIL === 'string' ? environment.STAFF_EMAIL.trim().toLowerCase() : '';
  if (mode === 'promote') {
    const { errors: registrationErrors } = validateRegistration({
      name: 'Provisioning', email, phone: '+919876543210', password: 'Strong-password-123'
    });
    if (registrationErrors.email) errors.STAFF_EMAIL = registrationErrors.email;
    return { errors, value: { mode, mongodbUri, email } };
  }

  const { errors: registrationErrors, value } = validateRegistration({
    name: environment.STAFF_NAME,
    email: environment.STAFF_EMAIL,
    phone: environment.STAFF_PHONE,
    password: environment.STAFF_PASSWORD
  });

  if (registrationErrors.name) errors.STAFF_NAME = registrationErrors.name;
  if (registrationErrors.email) errors.STAFF_EMAIL = registrationErrors.email;
  if (registrationErrors.phone) errors.STAFF_PHONE = registrationErrors.phone;
  if (registrationErrors.password) errors.STAFF_PASSWORD = registrationErrors.password;

  return { errors, value: { mode, mongodbUri, ...value } };
}

module.exports = { validateStaffProvisioningConfig };
