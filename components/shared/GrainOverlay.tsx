export function GrainOverlay({ opacity = 0.06 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="grain"
      style={{ opacity }}
    />
  );
}
