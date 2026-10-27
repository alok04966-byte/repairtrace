export function apiPath(path) {
  if (typeof path !== 'string' || /^https?:\/\//i.test(path)) {
    throw new TypeError('API requests must use a relative path.');
  }

  const segments = path.split('/').filter(Boolean);
  if (segments[0] === 'api') segments.shift();
  return segments.length ? `/api/${segments.join('/')}` : '/api';
}
