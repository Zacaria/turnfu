export function getStatStep(event: { shiftKey: boolean }): number {
  return event.shiftKey ? 10 : 1;
}
