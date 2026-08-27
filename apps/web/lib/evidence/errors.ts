export class EvidenceError extends Error {
  constructor(
    readonly code:
      | "project_not_found"
      | "project_not_published"
      | "suggestion_not_found"
      | "review_conflict"
      | "source_context_missing",
    message: string,
    readonly status: 404 | 409,
  ) {
    super(message);
    this.name = "EvidenceError";
  }
}
