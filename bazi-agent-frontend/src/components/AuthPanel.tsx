export function AuthPanel(props: {
  t: Record<string, string>;
  email: string;
  loading: boolean;
  message: string | null;
  configured: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t, email, loading, message, configured, onEmailChange, onSubmit } = props;

  return (
    <section className="auth-panel">
      <div className="auth-copy">
        <span className="auth-kicker">{t.signIn}</span>
        <h3>{t.authTitle}</h3>
        <p>{configured ? t.authSubtitle : t.authMissingConfig}</p>
      </div>
      <div className="auth-form">
        <input
          type="email"
          value={email}
          placeholder={t.authEmailPlaceholder}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={!configured || loading}
        />
        <button type="button" className="primary-btn auth-submit" onClick={onSubmit} disabled={!configured || loading}>
          {loading ? t.authSending : t.authSendLink}
        </button>
      </div>
      {message ? <p className="auth-message">{message}</p> : null}
    </section>
  );
}
