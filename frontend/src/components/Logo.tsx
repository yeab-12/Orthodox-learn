import { Link } from "react-router-dom";
import { CrossMark } from "./Art";

export function Logo({ light = false, to = "/" }: { light?: boolean; to?: string }) {
  return (
    <Link to={to} className="focus-ring inline-flex items-center gap-2.5 rounded">
      <CrossMark className={`h-8 w-8 ${light ? "text-gold-400" : "text-gold-600"}`} />
      <span className={`font-display text-xl font-semibold tracking-tight ${light ? "text-cream-50" : "text-navy-900"}`}>
        Tewahedo Learn
      </span>
    </Link>
  );
}
