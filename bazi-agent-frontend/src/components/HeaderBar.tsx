import type { Language } from '../locales';

export function HeaderBar(props: {
  title: string;
  subtitle: string;
  language: Language;
  onToggleLanguage: () => void;
}) {
  const { title, subtitle, language, onToggleLanguage } = props;
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
          <button type="button" className="header-btn" onClick={onToggleLanguage}>
            {language === 'zh' ? 'EN' : '中'}
          </button>
        </div>
      </div>
    </header>
  );
}
