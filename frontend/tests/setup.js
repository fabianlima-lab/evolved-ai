import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock next/image
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }) => {
    const React = require('react');
    return React.createElement('img', { src, alt: alt || '', ...props });
  },
}));

// Mock next/navigation (for non-locale-aware imports)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));

// Mock @/i18n/navigation (locale-aware)
vi.mock('@/i18n/navigation', () => {
  const React = require('react');
  return {
    Link: ({ children, href, ...props }) =>
      React.createElement('a', { href, ...props }, children),
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => '/',
    redirect: vi.fn(),
  };
});

// Mock @/i18n/routing
vi.mock('@/i18n/routing', () => ({
  routing: {
    locales: ['en'],
    defaultLocale: 'en',
  },
}));

// Mock @/lib/api
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  apiPatch: vi.fn(),
}));

// Mock @/lib/auth
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
  }),
  AuthProvider: ({ children }) => children,
}));

// Mock @/lib/google-auth
vi.mock('@/lib/google-auth', () => ({
  useGoogleAuth: () => ({
    handleGoogleSuccess: vi.fn(),
    isLoading: false,
  }),
}));

// Mock @react-oauth/google
vi.mock('@react-oauth/google', () => {
  const React = require('react');
  return {
    GoogleOAuthProvider: ({ children }) => children,
    GoogleLogin: () => React.createElement('div', { 'data-testid': 'google-login' }, 'Google Login'),
  };
});
