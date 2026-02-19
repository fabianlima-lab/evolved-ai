'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SectionLabel from '@/components/ui/SectionLabel';
import { apiPost, apiFetch, apiPatch } from '@/lib/api';

const TOTAL_STEPS = 4;

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i <= current
              ? 'bg-accent w-8'
              : 'bg-border w-4'
          }`}
        />
      ))}
    </div>
  );
}

// ── Step 1: Welcome + Name ──
function StepWelcome({ assistantName, setAssistantName, onNext, t }) {
  return (
    <div className="space-y-8" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">
          {t('welcomeTitle')}
        </h1>
        <p className="text-txt-muted mt-3 max-w-md mx-auto">
          {t('welcomeSubtitle')}
        </p>
      </div>

      <Card className="p-8 max-w-md mx-auto">
        <Input
          label={t('assistantNameLabel')}
          id="assistant-name"
          type="text"
          value={assistantName}
          onChange={(e) => setAssistantName(e.target.value)}
          placeholder={t('assistantNamePlaceholder')}
          maxLength={50}
        />
        <p className="text-xs text-txt-dim mt-2">{t('assistantNameHint')}</p>
      </Card>

      <div className="text-center">
        <Button
          onClick={onNext}
          disabled={!assistantName.trim()}
          className="px-10"
        >
          {t('continue')}
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: About You ──
function StepAboutYou({ profileName, setProfileName, role, setRole, priorities, setPriorities, desiredFeeling, setDesiredFeeling, onNext, loading, t }) {
  return (
    <div className="space-y-8" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">
          {t('aboutTitle')}
        </h1>
        <p className="text-txt-muted mt-3 max-w-md mx-auto">
          {t('aboutSubtitle')}
        </p>
      </div>

      <Card className="p-8 max-w-md mx-auto space-y-5">
        <Input
          label={t('yourName')}
          id="profile-name"
          type="text"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          placeholder={t('yourNamePlaceholder')}
          maxLength={100}
        />
        <Input
          label={t('yourRole')}
          id="profile-role"
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder={t('yourRolePlaceholder')}
          maxLength={200}
        />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="priorities"
            className="text-xs uppercase tracking-wider text-txt-muted font-medium"
          >
            {t('topPriorities')}
          </label>
          <textarea
            id="priorities"
            value={priorities}
            onChange={(e) => setPriorities(e.target.value)}
            placeholder={t('topPrioritiesPlaceholder')}
            rows={3}
            maxLength={500}
            className="bg-elevated border border-border rounded-[var(--radius-btn)] px-4 py-3 text-txt text-sm placeholder:text-txt-dim focus:outline-none focus:border-accent transition-colors resize-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="desired-feeling"
            className="text-xs uppercase tracking-wider text-txt-muted font-medium"
          >
            {t('desiredFeeling')}
          </label>
          <textarea
            id="desired-feeling"
            value={desiredFeeling}
            onChange={(e) => setDesiredFeeling(e.target.value)}
            placeholder={t('desiredFeelingPlaceholder')}
            rows={2}
            maxLength={300}
            className="bg-elevated border border-border rounded-[var(--radius-btn)] px-4 py-3 text-txt text-sm placeholder:text-txt-dim focus:outline-none focus:border-accent transition-colors resize-none"
          />
          <p className="text-xs text-txt-dim">{t('desiredFeelingHint')}</p>
        </div>
      </Card>

      <div className="text-center flex items-center justify-center gap-3">
        <Button
          onClick={onNext}
          loading={loading}
          disabled={!profileName.trim()}
          className="px-10"
        >
          {t('continue')}
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Connect WhatsApp ──
function StepWhatsApp({ connectionCode, connected, whatsappNumber, onNext, t }) {
  // Build wa.me link with pre-filled code message
  const waLink = whatsappNumber && connectionCode
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(connectionCode)}`
    : null;

  // Format the number for display (e.g. +1 234 567 890)
  const displayNumber = whatsappNumber || '';

  return (
    <div className="space-y-8" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">
          {t('whatsappTitle')}
        </h1>
        <p className="text-txt-muted mt-3 max-w-md mx-auto">
          {t('whatsappSubtitle')}
        </p>
      </div>

      <Card className="p-8 max-w-md mx-auto">
        {connected ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
              <span className="text-success text-3xl">&#10003;</span>
            </div>
            <h3 className="text-xl text-txt font-medium">{t('whatsappConnected')}</h3>
            <p className="text-txt-muted text-sm">{t('whatsappConnectedDesc')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            {connectionCode ? (
              <div className="w-full space-y-6">
                {/* Step 1: Your code */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-txt text-sm font-medium mb-2">
                      {t('whatsappStepCode')}
                    </p>
                    <div className="bg-elevated border-2 border-accent/30 rounded-[var(--radius-card)] px-6 py-3 font-mono text-3xl text-txt tracking-[0.3em] font-bold text-center">
                      {connectionCode}
                    </div>
                  </div>
                </div>

                {/* Step 2: Send to this number */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-txt text-sm font-medium mb-2">
                      {t('whatsappStepSend')}
                    </p>
                    {displayNumber && (
                      <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-[var(--radius-card)] px-6 py-3 text-center">
                        <p className="text-[#25D366] text-2xl font-bold tracking-wide">
                          {displayNumber}
                        </p>
                        <p className="text-txt-dim text-xs mt-1">{t('whatsappNumberLabel')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick action: Open WhatsApp button */}
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full bg-[#25D366] hover:bg-[#20BD5A] text-brand-cream font-semibold uppercase tracking-[0.2em] py-3.5 px-6 rounded-[var(--radius-btn)] transition-colors text-sm"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    {t('whatsappOpenApp')}
                  </a>
                )}

                <p className="text-txt-dim text-xs text-center mt-2">
                  {t('whatsappOrManual')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                  <span className="text-4xl">💬</span>
                </div>
                <p className="text-txt-muted text-sm text-center max-w-sm">
                  {t('whatsappGenerating')}
                </p>
              </div>
            )}

            {!connected && connectionCode && (
              <p className="text-txt-dim text-xs text-center">
                {t('whatsappWaiting')}
                <span className="inline-block w-2 h-2 bg-accent rounded-full ml-2 animate-pulse" />
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="text-center flex items-center justify-center gap-3">
        <Button
          onClick={onNext}
          disabled={!connected}
          className="px-10"
        >
          {t('continue')}
        </Button>
      </div>
    </div>
  );
}

// ── Step 4: Deploy + Success ──
function StepSuccess({ assistantName, deploying, onFinish, t }) {
  return (
    <div className="space-y-8 text-center" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
      <div className="relative w-36 h-36 mx-auto">
        <div className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse bg-accent" />
        <div className="relative w-full h-full rounded-full bg-accent/20 flex items-center justify-center text-accent text-5xl font-bold border-2 border-border">
          {assistantName.charAt(0).toUpperCase()}
        </div>
      </div>

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-txt">
          {t('successTitle')}
        </h1>
        <p className="font-[family-name:var(--font-display)] text-2xl text-accent mt-2">
          {assistantName}
        </p>
      </div>

      <p className="text-txt-muted max-w-md mx-auto">
        {t('successDescription')}
      </p>

      <Button
        onClick={onFinish}
        loading={deploying}
        className="px-10"
      >
        {t('goToDashboard')}
      </Button>
    </div>
  );
}

// ── Main Onboarding Page ──
export default function OnboardingPage() {
  const t = useTranslations('Onboarding');
  const router = useRouter();

  // Step state
  const [step, setStep] = useState(0);

  // Step 1: Assistant name
  const [assistantName, setAssistantName] = useState('');

  // Step 2: About you
  const [profileName, setProfileName] = useState('');
  const [role, setRole] = useState('');
  const [priorities, setPriorities] = useState('');
  const [desiredFeeling, setDesiredFeeling] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Step 3: WhatsApp
  const [connectionCode, setConnectionCode] = useState(null);
  const [whatsappNumber, setWhatsappNumber] = useState(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '');
  const [connected, setConnected] = useState(false);
  const pollRef = useRef(null);

  // Step 4: Deploy
  const [deploying, setDeploying] = useState(false);

  // Track onboarding step on backend
  const updateStep = useCallback(async (stepName) => {
    try {
      await apiPatch('/subscribers/onboarding-step', { step: stepName });
    } catch {
      // Non-blocking
    }
  }, []);

  // Step 1 → Step 2
  const handleStep1Next = () => {
    setStep(1);
    updateStep('conversational');
  };

  // Step 2 → Step 3: save profile, request WhatsApp code
  const handleStep2Next = async () => {
    setSavingProfile(true);
    try {
      const profileData = { name: profileName.trim() };
      if (role.trim()) profileData.role = role.trim();
      if (priorities.trim()) {
        profileData.priorities = priorities
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean);
      }
      if (desiredFeeling.trim()) profileData.desiredFeeling = desiredFeeling.trim();
      // Auto-detect timezone from browser
      profileData.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
      await apiPost('/subscribers/profile', profileData);
    } catch {
      // Non-blocking
    }
    setSavingProfile(false);

    setStep(2);
    updateStep('whatsapp_connect');

    // Request WhatsApp connection code
    try {
      const data = await apiPost('/channels/connect/request', { channel: 'whatsapp' });
      setConnectionCode(data.code || data.connection_code);
      if (data.whatsapp_number) {
        setWhatsappNumber(data.whatsapp_number);
      }
    } catch {
      setConnectionCode(null);
    }
  };

  // Poll for WhatsApp connection when on step 3
  useEffect(() => {
    if (step !== 2 || connected) return;

    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch('/channels/status');
        if (data.whatsapp_connected) {
          setConnected(true);
          clearInterval(pollRef.current);
        }
      } catch {
        // Silently retry
      }
    }, 3000);

    return () => clearInterval(pollRef.current);
  }, [step, connected]);

  // Step 3 → Step 4: Deploy agent
  const handleStep3Next = async () => {
    setStep(3);
    setDeploying(true);

    try {
      await apiPost('/agents/deploy', {
        name: assistantName.trim(),
      });
    } catch {
      // Non-blocking — agent may already exist
    }

    setDeploying(false);
  };

  // Step 4: Finish → dashboard
  const handleFinish = async () => {
    setDeploying(true);
    await updateStep('complete');
    router.push('/dashboard');
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-2">
        <SectionLabel>
          {t('stepLabel', { current: step + 1, total: TOTAL_STEPS })}
        </SectionLabel>
      </div>

      <StepIndicator current={step} total={TOTAL_STEPS} />

      {step === 0 && (
        <StepWelcome
          assistantName={assistantName}
          setAssistantName={setAssistantName}
          onNext={handleStep1Next}
          t={t}
        />
      )}

      {step === 1 && (
        <StepAboutYou
          profileName={profileName}
          setProfileName={setProfileName}
          role={role}
          setRole={setRole}
          priorities={priorities}
          setPriorities={setPriorities}
          desiredFeeling={desiredFeeling}
          setDesiredFeeling={setDesiredFeeling}
          onNext={handleStep2Next}
          loading={savingProfile}
          t={t}
        />
      )}

      {step === 2 && (
        <StepWhatsApp
          connectionCode={connectionCode}
          connected={connected}
          whatsappNumber={whatsappNumber}
          onNext={handleStep3Next}
          t={t}
        />
      )}

      {step === 3 && (
        <StepSuccess
          assistantName={assistantName}
          deploying={deploying}
          onFinish={handleFinish}
          t={t}
        />
      )}
    </div>
  );
}
