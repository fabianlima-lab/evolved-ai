import { redirect } from 'next/navigation';

// Agent setup is now part of the unified onboarding flow
export default function AgentsPage() {
  redirect('/onboarding');
}
