interface ErrorBannerProps {
  message: string;
  className?: string;
}

export function ErrorBanner({ message, className = '' }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      className={`rounded-lg border border-destructive/50 bg-destructive/5 p-3 ${className}`.trim()}
    >
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
