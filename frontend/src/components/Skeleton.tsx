export function Skeleton({ width = "100%", height = "1em" }: { width?: string | number; height?: string | number }) {
  return <span className="skeleton" style={{ width, height }} />;
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-rows">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={44} />
      ))}
    </div>
  );
}
