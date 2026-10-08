export function imageKeyFromUrl(value?: string | null) {
  if (!value) return null;

  const rawPath = (() => {
    try {
      return new URL(value, "https://badmintontracker.local").pathname;
    } catch {
      return value;
    }
  })();

  const fileName = decodeURIComponent(rawPath.split("/").filter(Boolean).pop() ?? "");
  if (!fileName) return null;

  return fileName.replace(/\.[a-z0-9]+$/i, "");
}
