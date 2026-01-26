// Feature flags for controlling app functionality
// Set to true to enable auth/backend features, false to disable

export const FEATURE_FLAGS = {
  // When false, auth is disabled and all routes are public
  AUTH_ENABLED: true,
  // When true, all letters can be opened regardless of delivery date (for testing)
  BYPASS_DELIVERY_DATE: true,
} as const;
