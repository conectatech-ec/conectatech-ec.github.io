// Preparation only. The existing Worker's deployer must carry this file unchanged
// until coverage, price, delivery estimate and publication are actually approved.
export const CHECKOUT_CONFIG = Object.freeze({
  enabled: false,
  storefrontOrigin: 'https://conectatech-ec.github.io',
  objectName: 'messenger-development',
  deliveries: [],
  payment: 'cod',
  nationalShippingEnabled: false,
  maxRequestsPerDay: 1000,
  maxRequestsPerClientHour: 30,
  maxOrdersPerDay: 30,
  maxOpenOrders: 300,
  quoteTtlMs: 900000,
  customerRetentionDays: 30
});
