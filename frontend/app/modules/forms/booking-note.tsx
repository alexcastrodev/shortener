export function BookingNote({
  message,
  warning,
}: {
  message: string | undefined;
  warning: boolean;
}) {
  return (
    <div aria-live="polite">
      {message && (
        <p
          className={`flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm font-medium ${
            warning
              ? 'border-amber-500/70 bg-amber-500/15'
              : 'border-teal-500/60 bg-teal-500/15'
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className={`mt-0.5 h-4 w-4 shrink-0 fill-none stroke-2 ${
              warning ? 'stroke-amber-500' : 'stroke-teal-500'
            }`}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {warning ? (
              <path d="M8 3v6M8 12.5v.01" />
            ) : (
              <path d="M3 8.5l3.2 3.2L13 4.5" />
            )}
          </svg>
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}
