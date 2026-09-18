"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
export default function BoardNavLink() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetch("/api/lost-found/meta", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active) setUnread(d?.unread || 0);
        })
        .catch(() => {});
    void refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return (
    <Link className="board-sidebar-link" href="/lost-found">
      <Search size={21} />
      Lost &amp; Found
      {unread > 0 && (
        <span
          className="lf-count"
          aria-label={`${unread} unread notifications`}
        >
          {unread}
        </span>
      )}
    </Link>
  );
}
