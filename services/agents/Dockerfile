FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AUDIENCE_TAKE_SCHEMA_ROOT=/service/contracts/schemas \
    PORT=8080

WORKDIR /service

COPY services/agents/pyproject.toml ./
COPY services/agents/src ./src
COPY contracts/schemas ./contracts/schemas

RUN pip install --no-cache-dir .

RUN useradd --create-home --uid 10001 runtime
USER runtime

CMD ["sh", "-c", "uvicorn audience_take_agents.http_app:app --host 0.0.0.0 --port ${PORT}"]
