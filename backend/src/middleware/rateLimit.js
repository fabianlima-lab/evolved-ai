// Rate limit configs for different endpoint groups
export const publicRateLimit = {
  max: 50,
  timeWindow: '1 day',
  keyGenerator: (request) => request.ip,
};
