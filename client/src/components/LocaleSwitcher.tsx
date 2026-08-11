import { useT } from "../i18n";
import { usePlayer } from "../store/player";

/** Toggle zh ↔ en; default zh. Sits in header tools next to theme switcher. */
export function LocaleSwitcher() {
  const locale = usePlayer((s) => s.locale);
  const setLocale = usePlayer((s) => s.setLocale);
  const tr = useT(locale);
  const next = locale === "zh" ? "en" : "zh";

  return (
    <button
      type="button"
      className="skin-switcher__btn locale-switch"
      title={tr("lang.switchTitle")}
      aria-label={tr("lang.switchTitle")}
      onClick={() => setLocale(next)}
    >
      <span className="skin-switcher__label">
        <span className="skin-switcher__label-full">{tr("lang.switchTo")}</span>
        <span className="skin-switcher__label-short">
          {locale === "zh" ? "EN" : "中"}
        </span>
      </span>
    </button>
  );
}
