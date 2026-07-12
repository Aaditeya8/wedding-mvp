const TZ = "Asia/Kolkata";

export function fmtEventDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long",
  }).format(d);
}

export function fmtEventTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d).replace(/\s?(am|pm)/i, (m) => m.toLowerCase());
}

export function fmtWeddingDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ, day: "numeric", month: "long", year: "numeric",
  }).format(d);
}
