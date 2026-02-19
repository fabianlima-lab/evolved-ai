const VALID_TIERS = ['trial', 'active', 'past_due', 'cancelled'];

// Single plan: $49/month, all features. Trial gets FULL access per instructions.
const TIER_FEATURES = {
  trial: {
    max_active_agents: 1,
    max_channels: 1,
    custom_name: true,
    custom_tone: true,
    web_search: true,
  },
  active: {
    max_active_agents: 1,
    max_channels: 1,
    custom_name: true,
    custom_tone: true,
    web_search: true,
  },
  past_due: {
    max_active_agents: 1,
    max_channels: 1,
    custom_name: true,
    custom_tone: true,
    web_search: true,
  },
  cancelled: {
    max_active_agents: 0,
    max_channels: 0,
    custom_name: false,
    custom_tone: false,
    web_search: false,
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
