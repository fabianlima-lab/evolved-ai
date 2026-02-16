const VALID_TIERS = ['trial', 'active'];

const TIER_FEATURES = {
  trial: {
    max_active_agents: 1,
    max_channels: 1,
    custom_name: false,
    custom_tone: false,
    web_search: true,
  },
  active: {
    max_active_agents: 3,
    max_channels: 2,
    custom_name: true,
    custom_tone: true,
    web_search: true,
  },
};

export function getFeaturesByTier(tier) {
  return TIER_FEATURES[tier] || TIER_FEATURES.trial;
}

export function isValidTier(tier) {
  return VALID_TIERS.includes(tier);
}

export function isTrialExpired(subscriber) {
  return subscriber.tier === 'trial' && subscriber.trialEndsAt && new Date() > new Date(subscriber.trialEndsAt);
}

export function stripHtml(str) {
  return String(str).replace(/<[^>]*>/g, '').trim();
}

export { VALID_TIERS, TIER_FEATURES };
