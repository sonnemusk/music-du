import { usePlayer } from "../store/player";

export function Toast() {
  const toast = usePlayer((s) => s.toast);
  return <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>;
}
