"""Publication boundary exceptions."""


class SemanticContractError(ValueError):
    """Raised when schema-valid-looking research violates truth constraints."""


class PublicationConflictError(RuntimeError):
    """Raised when an idempotency key is replayed with different content."""


class ImmutableVersionError(PublicationConflictError):
    """Raised when a caller attempts to replace a versioned artifact."""


class PublicationWriteError(RuntimeError):
    """Raised by a failed transactional publication stage."""
