---
name: assess-observability
description: Re-assess the Observability dimension and update the score. Run after adding logging, error handling, health check endpoints, or monitoring configuration.
---

# Assess observability

Score the Observability dimension, update `.sensible-harness/assessment.json`, and regenerate the dashboard.

## When to run
After adding a logging library, structured logging, error handling patterns, a `/health` endpoint, or monitoring/tracing configuration.

## What to assess

- **Logging**: a logging library configured (`winston`, `pino`, `structlog`, `slog`, `zap`)? Log levels used? Structured logging (JSON output)?
- **Error handling**: consistent patterns? Uncaught exception handlers? Error boundaries? `process.on('uncaughtException')` or equivalent?
- **Metrics / monitoring**: `prometheus`, `opentelemetry`, `datadog`, `newrelic`, `sentry` configured?
- **Health check endpoint**: `/health`, `/healthz`, `/ping` route present?
- **Runbooks**: any runbook or on-call documentation in `docs/`?
- **Distributed tracing**: trace IDs propagated? OpenTelemetry instrumentation?

## Scoring (0–100)

| Item | Points |
|------|--------|
| Logging library configured | +30 |
| Structured logging (JSON) | +20 |
| Consistent error handling patterns | +20 |
| Health check endpoint present | +15 |
| Monitoring / metrics configured | +10 |
| Runbooks present | +5 |

## Output

1. Write `.sensible-harness/reports/assessment/<latest-timestamp>/07-observability.md`.
2. Update `.sensible-harness/assessment.json` — patch `observability`.
3. Invoke `/regenerate-dashboard`.
4. Tell the user: new score, delta, gaps, report path.
