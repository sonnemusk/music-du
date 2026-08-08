import { useState } from "react";
import { usePlayer } from "../store/player";

export function SearchBar({ className, placeholder }: { className?: string; placeholder?: string }) {
  const search = usePlayer((s) => s.search);
  const searching = usePlayer((s) => s.searching);
  const q0 = usePlayer((s) => s.searchQuery);
  const [q, setQ] = useState(q0);

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
