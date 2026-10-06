export function FormCover({
  url,
  position,
}: {
  url?: string | null;
  position?: number;
}) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="mb-6 h-40 w-full rounded-lg object-cover sm:h-52"
      style={{ objectPosition: `50% ${position ?? 50}%` }}
    />
  );
}
