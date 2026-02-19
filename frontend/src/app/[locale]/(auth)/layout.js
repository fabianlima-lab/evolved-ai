'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import PageShell from '@/components/ui/PageShell';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function AuthLayout({ children }) {
  return (
    <PageShell>
      {GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          {children}
        </GoogleOAuthProvider>
      ) : (
        children
      )}
    </PageShell>
  );
}
