export function PlateTag({ plate }: { plate: string }) {
  return (
    <span className="inline-block rounded border border-line-strong bg-subtle px-2 py-0.5 font-mono text-xs font-semibold tracking-wide">
      {plate}
    </span>
  );
}
