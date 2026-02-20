'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { apiFetch, apiPost } from '@/lib/api';
import { KAJABI_CHECKOUT_URL, KAJABI_ACCOUNT_URL } from '@/lib/constants';

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const { logout } = useAuth();
  const [email, setEmail] = useState('');
  const [authProvider, setAuthProvider] = useState('email');
  const [tier, setTier] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Billing state
  const [subscriptionStartedAt, setSubscriptionStartedAt] = useState(null);
  const [subscriptionCancelledAt, setSubscriptionCancelledAt] = useState(null);
  const [nextBillingDate, setNextBillingDate] = useState(null);
  const [memberSince, setMemberSince] = useState(null);

  // Google integration state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleScopes, setGoogleScopes] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  useEffect(() => {
    apiFetch('/dashboard/stats')
      .then((data) => {
        setEmail(data.email || '');
        setAuthProvider(data.auth_provider || 'email');
        setGoogleConnected(data.google_connected || false);
        setGoogleScopes(data.google_scopes || '');
        setTier(data.tier || '');
        setTrialEndsAt(data.trial_ends_at || null);
        setTrialDaysRemaining(data.trial_days_remaining ?? null);
        setSubscriptionStartedAt(data.subscription_started_at || null);
        setSubscriptionCancelledAt(data.subscription_cancelled_at || null);
        setNextBillingDate(data.next_billing_date || null);
        setMemberSince(data.member_since || data.created_at || null);
      })
      .catch(() => {});
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');

    if (newPassword !== confirmPassword) {
      setPasswordErr(t('passwordsNoMatch'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordErr(t('passwordMinLength'));
      return;
    }

    setLoading(true);
    try {
      await apiPost('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordMsg(t('passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordErr(err.message || t('passwordFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const data = await apiFetch('/auth/google/url');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setGoogleError(err.message || t('googleError'));
      setGoogleLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm(t('disconnectConfirm'))) return;

    setGoogleLoading(true);
    setGoogleError('');
    try {
      await apiPost('/auth/google/disconnect', {});
      setGoogleConnected(false);
      setGoogleScopes('');
    } catch (err) {
      setGoogleError(err.message || 'Failed to disconnect');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleManageSubscription = () => {
    window.open(KAJABI_ACCOUNT_URL, '_blank');
  };

  const hasCalendar = googleScopes?.includes('calendar');
  const hasEmail = googleScopes?.includes('gmail');

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-txt">{t('title')}</h1>

      {/* Account Info */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('account')}</h3>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-txt-muted uppercase tracking-wider">{t('emailLabel')}</span>
            <p className="text-txt">{email}</p>
          </div>
          {(authProvider === 'google' || authProvider === 'both') && (
            <div className="flex items-center gap-2 text-sm text-txt-muted">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{t('signedInGoogle')}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Google Integrations */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('googleIntegrations')}</h3>
        <p className="text-sm text-txt-muted mb-4">
          {t('googleDesc')}
        </p>

        {googleConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-success">
              <span>✅</span>
              <span className="font-medium">{t('googleConnected')}</span>
            </div>
            <div className="space-y-1 text-sm text-txt-muted pl-6">
              <div className="flex items-center gap-2">
                <span>{hasCalendar ? '✅' : '❌'}</span>
                <span>{t('calendarAccess')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{hasEmail ? '✅' : '❌'}</span>
                <span>{t('emailAccess')}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={handleDisconnectGoogle}
              loading={googleLoading}
              className="mt-2"
            >
              {t('disconnectGoogle')}
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnectGoogle} loading={googleLoading}>
            <svg className="w-4 h-4 mr-2 inline" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('connectGoogle')}
          </Button>
        )}

        {googleError && <p className="text-danger text-sm mt-2">{googleError}</p>}
      </Card>

      {/* Change Password — hidden for Google-only users */}
      {authProvider !== 'google' && (
      <Card className="p-6">
        <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('changePassword')}</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input
            label={t('currentPassword')}
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            label={t('newPassword')}
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('newPasswordPlaceholder')}
            minLength={8}
            required
          />
          <Input
            label={t('confirmNewPassword')}
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {passwordErr && <p className="text-danger text-sm">{passwordErr}</p>}
          {passwordMsg && <p className="text-success text-sm">{passwordMsg}</p>}
          <Button type="submit" loading={loading}>
            {t('updatePassword')}
          </Button>
        </form>
      </Card>
      )}

      {/* Subscription & Billing */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('billing')}</h3>
        <div className="space-y-3 mb-5">
          {/* Status */}
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs text-txt-muted uppercase tracking-wider">{t('status')}</span>
            <span className="text-sm font-medium flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${
                tier === 'active' ? 'bg-success' :
                tier === 'trial' ? 'bg-brand-teal' :
                tier === 'past_due' ? 'bg-danger' :
                'bg-txt-dim'
              }`} />
              <span className={
                tier === 'active' ? 'text-success' :
                tier === 'trial' ? 'text-brand-teal' :
                tier === 'past_due' ? 'text-danger' :
                'text-txt-dim'
              }>
                {tier === 'active' ? t('statusActive') :
                 tier === 'trial' ? t('statusTrial') :
                 tier === 'past_due' ? t('statusPastDue') :
                 tier === 'cancelled' ? t('statusCancelled') : '--'}
              </span>
            </span>
          </div>

          {/* Plan */}
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-xs text-txt-muted uppercase tracking-wider">{t('plan')}</span>
            <span className="text-sm text-txt font-medium">
              {tier === 'trial' ? `${t('planName')} — ${t('statusTrial')}` :
               tier === 'cancelled' ? t('planName') :
               `${t('planName')} — $49/mo`}
            </span>
          </div>

          {/* Trial ends (trial only) */}
          {tier === 'trial' && trialEndsAt && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-txt-muted uppercase tracking-wider">{t('trialEnds')}</span>
              <span className="text-sm text-danger font-medium">
                {formatDate(trialEndsAt)}
                {trialDaysRemaining != null && ` (${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left)`}
              </span>
            </div>
          )}

          {/* Past due warning */}
          {tier === 'past_due' && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-txt-muted uppercase tracking-wider">Issue</span>
              <span className="text-sm text-danger font-medium">{t('pastDueWarning')}</span>
            </div>
          )}

          {/* Member since (active, past_due, cancelled) */}
          {tier !== 'trial' && memberSince && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-txt-muted uppercase tracking-wider">{t('memberSince')}</span>
              <span className="text-sm text-txt">{formatDate(memberSince)}</span>
            </div>
          )}

          {/* Subscribed on (active, past_due) */}
          {(tier === 'active' || tier === 'past_due') && subscriptionStartedAt && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-txt-muted uppercase tracking-wider">{t('subscribedOn')}</span>
              <span className="text-sm text-txt">{formatDate(subscriptionStartedAt)}</span>
            </div>
          )}

          {/* Next billing (active only) */}
          {tier === 'active' && nextBillingDate && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-txt-muted uppercase tracking-wider">{t('nextBilling')}</span>
              <span className="text-sm text-txt font-medium">{formatDate(nextBillingDate)}</span>
            </div>
          )}

          {/* Cancelled on (cancelled only) */}
          {tier === 'cancelled' && subscriptionCancelledAt && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-txt-muted uppercase tracking-wider">{t('cancelledOn')}</span>
              <span className="text-sm text-txt-dim">{formatDate(subscriptionCancelledAt)}</span>
            </div>
          )}

          {/* Payment method (active, past_due) */}
          {(tier === 'active' || tier === 'past_due') && (
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-txt-muted uppercase tracking-wider">{t('paymentMethod')}</span>
              <span className="text-sm text-txt-muted">{t('managedByKajabi')}</span>
            </div>
          )}
        </div>

        {/* CTAs per tier */}
        <div className="flex flex-wrap gap-3">
          {tier === 'trial' && (
            <Button onClick={() => window.open(KAJABI_CHECKOUT_URL, '_blank')}>
              {t('upgradePlan')}
            </Button>
          )}
          {tier === 'active' && (
            <>
              <Button variant="ghost" onClick={handleManageSubscription}>
                {t('manageOnKajabi')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm(t('cancelConfirm'))) {
                    handleManageSubscription();
                  }
                }}
                className="text-danger"
              >
                {t('cancelSubscription')}
              </Button>
            </>
          )}
          {tier === 'past_due' && (
            <Button onClick={handleManageSubscription}>
              {t('updatePayment')}
            </Button>
          )}
          {tier === 'cancelled' && (
            <Button onClick={() => window.open(KAJABI_CHECKOUT_URL, '_blank')}>
              {t('resubscribe')}
            </Button>
          )}
        </div>

        <p className="text-xs text-txt-dim mt-4">
          {tier === 'active' ? t('billingNoteActive') :
           tier === 'trial' ? t('billingNoteTrial') :
           tier === 'past_due' ? t('billingNotePastDue') :
           tier === 'cancelled' ? t('billingNoteCancelled') : ''}
        </p>
      </Card>

      {/* Log Out */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('logOut')}</h3>
        <p className="text-sm text-txt-muted mb-4">
          {t('logOutDesc')}
        </p>
        <Button variant="ghost" onClick={logout}>
          {t('logOut')}
        </Button>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-danger/30">
        <h3 className="text-sm font-medium text-danger uppercase tracking-wider mb-4">{t('dangerZone')}</h3>
        <p className="text-sm text-txt-muted mb-4">
          {t('dangerDesc')}
        </p>
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm(t('deleteConfirm'))) {
              // TODO: Implement account deletion endpoint
              console.log('Account deletion requested');
            }
          }}
        >
          {t('deleteAccount')}
        </Button>
      </Card>
    </div>
  );
}
