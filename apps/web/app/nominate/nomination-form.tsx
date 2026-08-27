"use client";

import { FormEvent, useMemo, useState } from "react";

import { ArrowIcon } from "../../components/icons";
import { nominationCommandHeaders } from "../../lib/nomination/client-auth";

type Mode = "fan" | "creator";
type FormState = {
  projectUrl: string;
  reason: string;
  potential: string;
  audience: string;
  supportingLinks: string[];
  creatorConnection: boolean;
};
type Errors = Partial<Record<"projectUrl" | "reason" | "supportingLinks" | "creatorConnection", string>>;

const emptyState = (initialUrl: string): FormState => ({ projectUrl: initialUrl, reason: "", potential: "", audience: "", supportingLinks: [""], creatorConnection: false });

function publicUrlError(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required.`;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(parsed.protocol)) return `${label} must use http or https.`;
    if (host === "localhost" || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) return `${label} must be a public page, not a private address.`;
    return undefined;
  } catch {
    return `Enter a complete public URL, including https://.`;
  }
}

export function NominationForm({ initialUrl = "" }: { initialUrl?: string }) {
  const [mode, setMode] = useState<Mode>("fan");
  const [values, setValues] = useState<FormState>(() => emptyState(initialUrl));
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const statusLabel = mode === "creator" ? "Creator-submitted — claim not yet verified" : "Fan nomination — unclaimed by creator";
  const completedSupportingLinks = useMemo(() => values.supportingLinks.filter((link) => link.trim()), [values.supportingLinks]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  }

  function validate(): Errors {
    const next: Errors = {};
    const urlMessage = publicUrlError(values.projectUrl, "Project URL");
    if (urlMessage) next.projectUrl = urlMessage;
    if (!values.reason.trim()) next.reason = "Tell us why this project should grow.";
    else if (values.reason.trim().length < 20) next.reason = "Give scouts a little more context — at least 20 characters.";
    const invalidSupport = completedSupportingLinks.find((link) => publicUrlError(link, "Supporting link"));
    if (invalidSupport) next.supportingLinks = publicUrlError(invalidSupport, "Supporting link");
    if (mode === "creator" && !values.creatorConnection) next.creatorConnection = "Confirm your connection before reviewing a creator submission.";
    return next;
  }

  function review(event: FormEvent) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    setStep("review");
    setSubmitError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitNomination() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/nominations", {
        method: "POST",
        headers: await nominationCommandHeaders(),
        body: JSON.stringify({
          submittedUrl: values.projectUrl.trim(),
          whyItShouldGrow: values.reason.trim(),
          submissionType: mode,
          suggestedFormat: values.potential.trim() || undefined,
          audienceFit: values.audience.trim() || undefined,
          supportingUrls: completedSupportingLinks,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        data?: { duplicate?: boolean; researchUrl?: string; canonicalUrl?: string };
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(result.error?.message || "The research desk could not start this nomination.");
      const destination = result.data?.duplicate
        ? result.data.canonicalUrl
        : result.data?.researchUrl;
      if (!destination) throw new Error("The nomination was received, but no research destination was returned.");
      window.location.assign(destination);
    } catch (error) {
      setSubmitError(error instanceof Error ? `${error.message} Your nomination is still here—try again.` : "Research could not start. Your nomination is still here—try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "review") {
    return (
      <section className="review-sheet" aria-labelledby="review-title">
        <div className="review-heading"><div><span>Final check</span><h2 id="review-title">Review your nomination</h2></div><span className="review-status">{statusLabel}</span></div>
        <dl className="review-list">
          <div><dt>Public project URL</dt><dd><a href={values.projectUrl}>{values.projectUrl}</a></dd></div>
          <div><dt>Why should this grow?</dt><dd>{values.reason}</dd></div>
          <div><dt>What could it become?</dt><dd>{values.potential || "Not supplied"}</dd></div>
          <div><dt>Who is it for?</dt><dd>{values.audience || "Not supplied"}</dd></div>
          <div><dt>Fan-supplied supporting links</dt><dd>{completedSupportingLinks.length ? <ul>{completedSupportingLinks.map((link) => <li key={link}><a href={link}>{link}</a></li>)}</ul> : "None supplied"}</dd></div>
        </dl>
        <div className="evidence-note"><strong>What happens next</strong><p>Sign-in is required. After submission, Audience Take checks for an existing canonical Scout Card before beginning new research. Fan-supplied links remain leads until reviewed.</p></div>
        {submitError ? <div className="form-alert" role="alert"><strong>Research did not start</strong><p>{submitError}</p></div> : null}
        <div className="review-actions"><button type="button" className="button-secondary" onClick={() => setStep("edit")} disabled={submitting}>Back to edit</button><button type="button" className="button-primary" onClick={submitNomination} disabled={submitting} aria-describedby="submission-note">{submitting ? "Starting research…" : "Start scout research"}<ArrowIcon /></button></div>
        <p id="submission-note" className="submission-note">If you are signed out, the sign-in flow returns you to this nomination. Your entered text is kept if submission fails.</p>
      </section>
    );
  }

  return (
    <section className="form-sheet" aria-labelledby="form-title">
      <div className="form-sheet-heading"><h2 id="form-title">Start with the source.</h2><p>Required fields are marked <span aria-hidden="true">*</span><span className="sr-only">required</span>. Everything else helps the scouts orient faster.</p></div>
      <div className="mode-switch" role="group" aria-label="Submission type">
        <button type="button" aria-pressed={mode === "fan"} onClick={() => { setMode("fan"); setErrors({}); }}>Nominate a Project<span>I found someone else’s work</span></button>
        <button type="button" aria-pressed={mode === "creator"} onClick={() => { setMode("creator"); setErrors({}); }}>Submit My Project<span>I am connected to this work</span></button>
      </div>
      <p className={`mode-status mode-${mode}`} aria-live="polite">Card label: <strong>{statusLabel}</strong></p>
      <form onSubmit={review} noValidate>
        <div className="field-block field-primary">
          <label htmlFor="nomination-url">Public project URL <span>*</span></label>
          <p id="url-help">YouTube, Vimeo, a public creator page, trailer, episode, documentary sample, or public crowdfunding project.</p>
          <input id="nomination-url" type="url" inputMode="url" autoComplete="url" value={values.projectUrl} onChange={(event) => update("projectUrl", event.target.value)} aria-describedby={`url-help${errors.projectUrl ? " url-error" : ""}`} aria-invalid={Boolean(errors.projectUrl)} placeholder="https://…" />
          {errors.projectUrl ? <p className="field-error" id="url-error">{errors.projectUrl}</p> : null}
        </div>
        <div className="field-block">
          <label htmlFor="nomination-reason">Why should this grow? <span>*</span></label>
          <p id="reason-help">Tell us what caught you and why a wider audience should see it.</p>
          <textarea id="nomination-reason" value={values.reason} onChange={(event) => update("reason", event.target.value)} aria-describedby={`reason-help${errors.reason ? " reason-error" : ""}`} aria-invalid={Boolean(errors.reason)} maxLength={600} rows={5} />
          <div className="field-meta"><span>{errors.reason ? <span className="field-error" id="reason-error">{errors.reason}</span> : "Required · 20–600 characters"}</span><span>{values.reason.length}/600</span></div>
        </div>
        <div className="field-row">
          <div className="field-block"><label htmlFor="nomination-potential">What could it become? <small>Optional</small></label><textarea id="nomination-potential" value={values.potential} onChange={(event) => update("potential", event.target.value)} maxLength={400} rows={4} placeholder="A feature, series, live event, next chapter…" /></div>
          <div className="field-block"><label htmlFor="nomination-audience">Who is it for? <small>Optional</small></label><textarea id="nomination-audience" value={values.audience} onChange={(event) => update("audience", event.target.value)} maxLength={400} rows={4} placeholder="Describe the people who would care." /></div>
        </div>
        <fieldset className="supporting-links">
          <legend>Supporting public links <small>Optional · up to 5</small></legend>
          <p>These are labeled <strong>fan-supplied leads</strong>. They do not become verified evidence automatically.</p>
          {values.supportingLinks.map((link, index) => <div className="link-row" key={index}><label className="sr-only" htmlFor={`support-${index}`}>Supporting link {index + 1}</label><input id={`support-${index}`} type="url" inputMode="url" value={link} onChange={(event) => { const next = [...values.supportingLinks]; next[index] = event.target.value; update("supportingLinks", next); }} aria-invalid={Boolean(errors.supportingLinks)} placeholder={`Supporting link ${index + 1}`} />{values.supportingLinks.length > 1 ? <button type="button" onClick={() => update("supportingLinks", values.supportingLinks.filter((_, linkIndex) => linkIndex !== index))} aria-label={`Remove supporting link ${index + 1}`}>Remove</button> : null}</div>)}
          {errors.supportingLinks ? <p className="field-error" role="alert">{errors.supportingLinks}</p> : null}
          {values.supportingLinks.length < 5 ? <button className="add-link" type="button" onClick={() => update("supportingLinks", [...values.supportingLinks, ""])}>+ Add another public link</button> : <p className="link-limit">Five-link limit reached.</p>}
        </fieldset>
        {mode === "creator" ? <div className="creator-declaration"><input id="creator-connection" type="checkbox" checked={values.creatorConnection} onChange={(event) => update("creatorConnection", event.target.checked)} aria-invalid={Boolean(errors.creatorConnection)} aria-describedby={errors.creatorConnection ? "creator-error" : "creator-help"} /><label htmlFor="creator-connection">I confirm I am the creator or authorized project representative.<span id="creator-help">This labels nomination provenance only. After the Scout Card publishes, use Request to Claim for a real pending review. Unapproved status cannot edit agent evidence or suppress fan activity.</span></label>{errors.creatorConnection ? <p id="creator-error" className="field-error">{errors.creatorConnection}</p> : null}</div> : null}
        <div className="form-submit"><div><strong>Nothing publishes yet.</strong><p>You’ll review every field before the research run can start.</p></div><button className="button-primary" type="submit">Review nomination <ArrowIcon /></button></div>
      </form>
    </section>
  );
}
