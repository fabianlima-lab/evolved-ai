import { redirect } from 'next/navigation';

// Deploy success is now part of the unified onboarding flow
export default function DeployPage() {
  redirect('/dashboard');
}
