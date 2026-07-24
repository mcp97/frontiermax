import Link from "next/link";

type ActiveRoute =
  | "benchmarks"
  | "interpret"
  | "route"
  | "methodology"
  | "docs"
  | "audit"
  | "fund";

const navigation: Array<{ id: ActiveRoute; href: string; label: string }> = [
  { id: "benchmarks", href: "/benchmarks", label: "Evidence" },
  { id: "methodology", href: "/methodology", label: "Methodology" },
  { id: "route", href: "/route", label: "Router Demo" },
  { id: "docs", href: "/docs", label: "Docs" },
  { id: "audit", href: "/audit", label: "Routing Audit" },
];

export default function SiteHeader({ active }: { active?: ActiveRoute }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Frontier Max home">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        Frontier Max
      </Link>
      <nav aria-label="Primary navigation">
        {navigation.map((item) => (
          <Link
            href={item.href}
            aria-current={active === item.id ? "page" : undefined}
            key={item.id}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Link className="header-cta" href="/signin-with-chatgpt?return_to=%2Fapp">Sign in <span>↗</span></Link>
    </header>
  );
}
