# Shared contracts

JSON Schema files in `schemas/` are the canonical contracts between the TypeScript web application and Python agent service. Fixtures in `fixtures/` must validate in both runtimes. Runtime-specific types may wrap these schemas but may not silently add incompatible fields.
