export const TIER_FEATURES = {
  trial: {
    label: 'Free Trial',
    maxAgents: 1,
    channels: 1,
  },
  active: {
    label: 'Active',
    price: '$49/mo',
    maxAgents: 3,
    channels: 2,
  },
};

export const GOAL_OPTIONS = [
  { id: 'productivity', labelKey: 'productivity', icon: '📋' },
  { id: 'learning', labelKey: 'learning', icon: '📚' },
  { id: 'content', labelKey: 'content', icon: '✍️' },
  { id: 'wellness', labelKey: 'wellness', icon: '🧘' },
  { id: 'business', labelKey: 'business', icon: '💼' },
  { id: 'general', labelKey: 'general', icon: '✨' },
];
