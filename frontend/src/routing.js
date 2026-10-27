export function dashboardForRole(user) {
  if (user?.role === 'customer') return '/customer';
  if (user?.role === 'staff') return '/staff';
  return null;
}

export function safeDestination(destination, user) {
  const home = dashboardForRole(user);
  if (destination && typeof destination === 'object') {
    destination = `${destination.pathname || ''}${destination.search || ''}${destination.hash || ''}`;
  }
  if (!home || typeof destination !== 'string' || !destination.startsWith('/') || destination.startsWith('//') || destination.includes('\\') || /[\u0000-\u001f]/.test(destination)) return home;
  const path = destination.split(/[?#]/, 1)[0];
  const permitted = path === home || /^\/repairs\/[a-f\d]{24}$/i.test(path);
  return permitted ? destination : home;
}

export function hasSafeRepairOrigin(origin, user) {
  const home = dashboardForRole(user);
  if (!home || typeof origin !== 'string') return false;
  return origin.split(/[?#]/, 1)[0] === home;
}
