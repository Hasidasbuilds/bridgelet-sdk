/**
 * Event names emitted by the backend.
 *
 * Keeping them in one place prevents the drift that made the README claim the
 * sweep webhooks were still commented out (issue #1071). The same strings are
 * the values integrators subscribe to; see `docs/webhook-events.md`.
 */
export enum WebhookEvent {
  SweepPartial = 'sweep.partial',
  SweepCompleted = 'sweep.completed',
  SweepFailed = 'sweep.failed',
}
