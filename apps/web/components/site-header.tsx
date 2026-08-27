"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArrowIcon } from "./icons";

export function SiteHeader() {
  const pathname = usePathname();
  const homeIsCurrent = pathname === "/";
  const nominateIsCurrent = pathname === "/nominate" || pathname?.startsWith("/nominate/") === true;
  const returnTo = encodeURIComponent(pathname || "/");
  return <header className="site-header"><Link className="wordmark" href="/" aria-label="Audience Take home">Audience Take</Link><nav aria-label="Primary navigation"><Link href="/" aria-current={homeIsCurrent ? "page" : undefined}><span>01</span> Home</Link><Link href="/nominate" aria-current={nominateIsCurrent ? "page" : undefined}><span>02</span> Nominate</Link><Link href="/#selects"><span>03</span> The Selects</Link></nav><div className="header-actions"><Link className="sign-in-link" href={`/sign-in?returnTo=${returnTo}`}>Sign in</Link><Link className="header-nominate" href="/nominate">Nominate <ArrowIcon /></Link></div></header>;
}
