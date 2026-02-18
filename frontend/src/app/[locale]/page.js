'use client';

import LandingNav from '@/components/landing/LandingNav';
import HeroSection from '@/components/landing/HeroSection';
import ChatPreview from '@/components/landing/ChatPreview';
import TrustBar from '@/components/landing/TrustBar';
import ProblemSection from '@/components/landing/ProblemSection';
import FeaturesGrid from '@/components/landing/FeaturesGrid';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import ComparisonTable from '@/components/landing/ComparisonTable';
import PricingSection from '@/components/landing/PricingSection';
import EcosystemSection from '@/components/landing/EcosystemSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import FAQSection from '@/components/landing/FAQSection';
import FinalCTA from '@/components/landing/FinalCTA';
import Footer from '@/components/landing/Footer';

/**
 * Public Landing Page — evolved.ai
 *
 * Marketing page for unauthenticated visitors. All CTAs link to
 * the external Kajabi checkout (KAJABI_CHECKOUT_URL). Matches the
 * reference design from evolved-vets-ai-landing-page-2.html.
 *
 * Hash anchor smooth-scrolling is handled by an inline <script>
 * in layout.js that runs before React hydration, preventing
 * Next.js App Router from intercepting hash link clicks.
 */
export default function LandingPage() {
  return (
    <div className="font-[family-name:var(--font-body)]" style={{ background: 'var(--color-brand-cream)', color: 'var(--color-brand-charcoal)', overflowX: 'clip' }}>
      <LandingNav />
      <HeroSection />
      <ChatPreview />
      <TrustBar />
      <ProblemSection />
      <FeaturesGrid />
      <HowItWorksSection />
      <ComparisonTable />
      <PricingSection />
      <EcosystemSection />
      <TestimonialsSection />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
