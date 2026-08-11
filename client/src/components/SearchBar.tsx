import { useEffect, useState } from "react";
import { usePlayer } from "../store/player";

export function SearchBar({ className, placeholder }: { className?: string; placeholder?: string }) {
  const search = usePlayer((s) => s.search);
  const searching = usePlayer((s) => s.searching);
  const searchQuery = usePlayer((s) => s.searchQuery);
  const tab = usePlayer((s) => s.tab);
  const [q, setQ] = useState(searchQuery);

  // Store is source of truth after submit / tab leave (setTab clears searchQuery).
  useEffect(() => {
    if (tab !== "search") {
      setQ("");
      return;
    }
    setQ(searchQuery);
  }, [tab, searchQuery]);

  return (
    <form
      className={className || "skin-search"}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        void search(q);
      }}
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || "搜索歌曲 / 歌手…"}
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        aria-label="搜索"
      />
      <button type="submit" disabled={searching} aria-label="提交搜索">
        {searching ? "…" : "搜索"}
      </button>
    </form>
  );
}
