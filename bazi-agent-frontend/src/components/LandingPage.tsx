export function LandingPage(props: {
  heroKicker: string;
  heroTitle: string;
  heroLinePrimary: string;
  heroLineAccent: string;
  getStarted: string;
  onStart: () => void;
}) {
  const { heroKicker, heroTitle, heroLinePrimary, heroLineAccent, getStarted, onStart } = props;
  return (
    <section className="landing">
      <div className="landing-card">
        <span className="landing-quote-mark">“</span>
        <p className="landing-kicker">{heroKicker}</p>
        <div className="landing-quote">
          <p className="landing-lang">{heroTitle}</p>
          <p className="landing-line-primary">{heroLinePrimary}</p>
          <p className="landing-line-accent">{heroLineAccent}</p>
        </div>
        <button type="button" className="landing-btn" onClick={onStart}>
          {getStarted}
        </button>
      </div>
    </section>
  );
}
