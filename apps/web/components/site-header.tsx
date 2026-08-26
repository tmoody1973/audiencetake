import Link from "next/link";
import { ArrowIcon } from "./icons";

export function SiteHeader() {
  return <header className="site-header"><Link className="wordmark" href="/" aria-label="Audience Take home">Audience Take</Link><nav aria-label="Primary navigation"><Link href="/" aria-current="page"><span>01</span> Home</Link><Link href="/nominate"><span>02</span> Nominate</Link><Link href="/#selects"><span>03</span> The Selects</Link></nav><div className="header-actions"><Link className="sign-in-link" href="/sign-in?returnTo=%2F">Sign in</Link><Link className="header-nominate" href="/nominate">Nominate <ArrowIcon /></Link></div></header>;
}
