/**
 * @typedef {'READY' | 'WORKING' | 'RATE_LIMITED' | 'QUARANTINED'} AccountStatus
 * @typedef {'round-robin' | 'least-used' | 'random'} RoutingStrategy
 * 
 * @typedef {Object} Account
 * @property {string} id
 * @property {string} email
 * @property {string} maskedEmail
 * @property {string} channel - e.g. 'WEB' | 'API'
 * @property {AccountStatus} status
 * @property {string} sessionCookie
 * @property {string} [bearerToken]
 * @property {string} [apiKey]
 * @property {string} [proxy]
 * @property {number} activeRequests
 * @property {number} totalServed
 * @property {number} totalFailed
 * @property {number} [rateLimitedUntil]
 * @property {string} [quarantineReason]
 * @property {number} lastLatencyMs
 * @property {number} lastUsed
 * @property {number} createdAt
 * @property {boolean} enabled
 */

module.exports = {};

