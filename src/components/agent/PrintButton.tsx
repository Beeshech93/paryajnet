"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-ghost print:hidden">
      🖨️ {label}
    </button>
  );
}
