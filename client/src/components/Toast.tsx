import { usePlayer } from "../store/player";

export function Toast() {
  const toast = usePlayer((s) => s.toast);
  const needAccess = /Cloudflare Access|需要登录/i.test(toast || "");
  return (
    <div className={`toast ${toast ? "show" : ""}`}>
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
          重新登录
        </button>
      ) : null}
    </div>
  );
}
