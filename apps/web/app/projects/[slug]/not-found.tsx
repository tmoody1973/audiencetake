import Link from "next/link";

import { SiteHeader } from "../../../components/site-header";

export default function ProjectNotFound() {
  return <><SiteHeader /><main className="project-not-found paper-texture"><h1>Scout Card not found</h1><p>This public card may not exist, or its address may have changed.</p><Link className="button-primary" href="/">Return to the program</Link></main></>;
}
