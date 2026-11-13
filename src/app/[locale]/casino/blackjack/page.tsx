import { BlackjackGame } from "@/components/casino/BlackjackGame";
import { Link } from "@/i18n/navigation";

export default function BlackjackPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4">
        <Link
          href="/casino"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400 transition"
        >
          ← Back to Casino Hub
        </Link>
      </div>
      <BlackjackGame />
    </div>
  );
}

