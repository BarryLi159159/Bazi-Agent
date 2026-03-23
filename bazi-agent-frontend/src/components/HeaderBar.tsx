import type { Language } from '../locales';

export function HeaderBar(props: {
  title: string;
  subtitle: string;
  language: Language;
  userEmail?: string | null;
  settingsLabel: string;
  signOutLabel: string;
  onOpenSettings?: () => void;
  onSignOut?: () => void;
  onToggleLanguage: () => void;
}) {
  const { title, subtitle, language, userEmail, settingsLabel, signOutLabel, onOpenSettings, onSignOut, onToggleLanguage } = props;
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="brand">
          <div className="brand-dot">✦</div>
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="header-actions">
          {userEmail ? <span className="header-user-pill">{userEmail}</span> : null}
          <button type="button" className="header-btn" onClick={onToggleLanguage}>
            {language === 'zh' ? 'EN' : '中'}
          </button>
          {userEmail && onOpenSettings ? (
            <button type="button" className="header-btn" onClick={onOpenSettings}>
              {settingsLabel}
            </button>
          ) : null}
          {userEmail && onSignOut ? (
            <button type="button" className="header-btn" onClick={onSignOut}>
              {signOutLabel}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
