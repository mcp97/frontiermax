import Link from "next/link";
import { chatGPTSignOutPath } from "../chatgpt-auth";

const links = [
  ["overview", "/app", "Overview"],
  ["workloads", "/app/workloads", "Workloads"],
  ["evals", "/app/evals", "Private Benchmarks"],
  ["policies", "/app/policies", "Policies"],
  ["compare", "/app/compare", "Compare"],
  ["certifications", "/app/certifications", "Certifications"],
  ["receipts", "/app/receipts", "Receipts"],
  ["settings", "/app/settings", "Settings"],
] as const;

export default function AppNavigation({
  active,
  user,
}: {
  active: (typeof links)[number][0];
  user?: string;
}) {
  return (
    <aside className="app-nav">
      <Link className="brand" href="/">
        <span className="brand-mark"><i /><i /><i /></span>
        Frontier Max
      </Link>
      <nav aria-label="Application navigation">
        {links.map(([id, href, label]) => (
          <Link className={active === id ? "active" : undefined} href={href} key={id}>
            {label}
          </Link>
        ))}
      </nav>
      <div>
        {user ? <span>{user}</span> : null}
        <Link href="/benchmarks">Public evidence</Link>
        <a href={chatGPTSignOutPath("/")}>Sign out</a>
      </div>
    </aside>
  );
}
