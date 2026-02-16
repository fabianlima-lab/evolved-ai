'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { apiFetch, apiPost } from '@/lib/api';

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const [email, setEmail] = useState('');
  const [authProvider, setAuthProvider] = useState('email');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch('/dashboard/stats')
      .then((data) => {
        setEmail(data.email || '');
        setAuthProvider(data.auth_provider || 'email');
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

  const handleManageSubscription = () => {
    window.open('https://evolved.ai/account', '_blank');
  };

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

      {/* Subscription */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-txt uppercase tracking-wider mb-4">{t('subscription')}</h3>
        <p className="text-sm text-txt-muted mb-4">
          {t('subscriptionDesc')}
        </p>
        <Button variant="ghost" onClick={handleManageSubscription}>
          {t('manageSubscription')}
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
