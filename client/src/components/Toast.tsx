import { useT } from "../i18n";
import { usePlayer } from "../store/player";

export function Toast() {
  const toast = usePlayer((s) => s.toast);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const needAccess = /Cloudflare Access|需要登录|Sign in|login/i.test(toast || "");
  return (
    <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
      <span className="toast__text">{toast}</span>
      {needAccess ? (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            // Full navigation re-triggers Access login challenge
            window.location.assign(window.location.pathname || "/");
          }}
        >
          {tr("access.reLogin")}
        </button>
      ) : null}
    </div>
  );
}
