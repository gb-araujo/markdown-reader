# Payments Service — Architecture

```mermaid
flowchart LR
  A[Checkout API] --> B[Validate] --> C[Reserve funds] --> D[(PostgreSQL)] --> E[Publish event] --> F[Order pipeline]
```

> **Status:** approved · **Owner:** Platform team · **Last review:** Sep 2026

The payments service receives checkout requests, reserves funds with the card processor and
publishes the result to the order pipeline. It is stateless; every decision is persisted in
PostgreSQL before the response is sent.[^stateless]

## Rollout checklist

Tick a box — the change is written back to this file.

- [x] Idempotency keys on every write endpoint
- [x] Retry with exponential backoff
- [x] Dashboards for latency and error rate
- [ ] Load test at 2× peak traffic
- [ ] Runbook reviewed by on-call

## Services

Click a column header to sort.

| Service     | Language   | p95 latency | Owner    |
| ----------- | ---------- | ----------: | -------- |
| checkout    | TypeScript |       84 ms | Payments |
| reservation | Go         |       41 ms | Payments |
| ledger      | Kotlin     |       63 ms | Finance  |
| notifier    | TypeScript |       29 ms | Platform |

## Retry policy

Failed calls to the processor are retried with jittered exponential backoff:

$$
t_n = \min\left(t_{max},\; t_0 \cdot 2^{n}\right) + \text{jitter}
$$

```ts
export async function withRetry<T>(call: () => Promise<T>, attempts = 5): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await call()
    } catch (error) {
      if (n + 1 >= attempts || !isTransient(error)) throw error
      await sleep(Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** n) + jitter())
    }
  }
}
```

The retry settings live in [config.yaml](config.yaml); error codes are listed in
[api/errors.md](api/errors.md#error-codes).

## Failure modes

### Processor timeout

The reservation is marked `pending` and reconciled by the nightly job.

### Duplicate request

The idempotency key returns the stored response without calling the processor again.

[^stateless]: Any instance can serve any request, so the service scales horizontally.
