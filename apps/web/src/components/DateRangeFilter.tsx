"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function DateRangeFilter({ from, to }: { from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [fromVal, setFromVal] = useState(from ?? "");
  const [toVal, setToVal] = useState(to ?? "");

  function apply() {
    const params = new URLSearchParams();
    if (fromVal) params.set("from", fromVal);
    if (toVal) params.set("to", toVal);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function reset() {
    setFromVal("");
    setToVal("");
    router.push(pathname);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-gray-600">Date range</span>
      <input
        type="date"
        value={fromVal}
        onChange={(e) => setFromVal(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
      />
      <span className="text-sm text-gray-400">to</span>
      <input
        type="date"
        value={toVal}
        onChange={(e) => setToVal(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
      />
      <button
        onClick={apply}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Apply
      </button>
      {(from || to) && (
        <button
          onClick={reset}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
