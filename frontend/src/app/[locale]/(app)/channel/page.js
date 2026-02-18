import { redirect } from 'next/navigation';

// Channel connection is now part of the unified onboarding flow
export default function ChannelPage() {
  redirect('/onboarding');
}
