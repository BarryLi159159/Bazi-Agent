import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserApiKeyStatus } from '../types';

export function SettingsModal(props: {
  t: Record<string, string>;
  session: Session;
  value: string;
  status: UserApiKeyStatus | null;
  saving: boolean;
  deleting: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const { t, session, value, status, saving, deleting, onChange, onSave, onDelete, onSignOut, onClose } = props;
  const [copied, setCopied] = useState(false);

  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(session.user.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="settings-modal-mask" role="presentation" onClick={onClose}>
      <section className="settings-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-head">
          <div>
            <h3>{t.settingsTitle}</h3>
            <p>{t.settingsSubtitle}</p>
          </div>
          <button type="button" className="header-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>

        <div className="settings-section">
          <h4 className="settings-section-title">{t.settingsAccountSection}</h4>
          <p className="settings-section-hint">{t.settingsAccountHint}</p>
          <label className="settings-form-field settings-readonly-field">
            <span>{t.settingsAccountEmailLabel}</span>
            <input type="text" readOnly value={session.user.email ?? ''} />
          </label>
          <div className="settings-user-id-row">
            <label className="settings-form-field settings-readonly-field settings-user-id-field">
              <span>{t.settingsUserIdLabel}</span>
              <input type="text" readOnly value={session.user.id} />
            </label>
            <button type="button" className="ghost-btn settings-copy-btn" onClick={() => void copyUserId()}>
              {copied ? t.settingsCopied : t.settingsCopyUserId}
            </button>
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-section">
          <h4 className="settings-section-title">{t.settingsApiSection}</h4>
          <div className="settings-status-card">
            <small>{t.apiKeyStatus}</small>
            <strong>{status?.hasKey ? `${t.apiKeySaved} • •••• ${status.last4 ?? ''}` : t.apiKeyMissing}</strong>
          </div>

          <label className="settings-form-field">
            <span>{t.apiKeyLabel}</span>
            <input
              type="password"
              value={value}
              placeholder={t.apiKeyPlaceholder}
              onChange={(e) => onChange(e.target.value)}
              autoComplete="off"
            />
          </label>

          <p className="settings-helper">{t.apiKeyHelper}</p>

          <div className="settings-actions-row">
            <button type="button" className="primary-btn settings-save-btn" onClick={onSave} disabled={saving}>
              {saving ? t.saving : t.save}
            </button>
            <button type="button" className="ghost-btn" onClick={onDelete} disabled={deleting || !status?.hasKey}>
              {deleting ? t.deleting : t.deleteApiKey}
            </button>
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-section settings-signout-section">
          <p className="settings-helper">{t.settingsSignOutHint}</p>
          <button
            type="button"
            className="settings-signout-btn"
            onClick={() => {
              onSignOut();
              onClose();
            }}
          >
            {t.settingsSignOutAction}
          </button>
        </div>
      </section>
    </div>
  );
}
