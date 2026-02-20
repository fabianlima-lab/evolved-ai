export const TIER_FEATURES = {
  trial: {
    label: 'Free Trial',
    maxAgents: 1,
    channels: 1,
  },
  active: {
    label: 'Active',
    price: '$49/mo',
    maxAgents: 1,
    channels: 1,
  },
};

// Kajabi checkout URL — subscribers are redirected here to upgrade
export const KAJABI_CHECKOUT_URL = process.env.NEXT_PUBLIC_KAJABI_CHECKOUT_URL || 'https://app-evolved-vets.mykajabi.com/offers/XwnkKFyM';

// Kajabi customer account portal — manage subscription, update payment, cancel
export const KAJABI_ACCOUNT_URL = process.env.NEXT_PUBLIC_KAJABI_ACCOUNT_URL || 'https://app-evolved-vets.mykajabi.com/account';
