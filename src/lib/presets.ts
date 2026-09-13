/** Indian wedding ceremonies a couple can add with one tap. `dayOffset` is
    relative to the wedding day; `hour` is IST. Used to prefill a brand-new site
    and by the "add event" picker in the editor. */
export type EventPreset = {
  name: string;
  blurb: string;
  dressCode: string;
  dayOffset: number;
  hour: number;
  /** included when a new wedding is created */
  starter?: boolean;
};

export const EVENT_PRESETS: EventPreset[] = [
  { name: "Roka", blurb: "The families meet and the match is sealed with sweets and blessings.", dressCode: "Festive Indian", dayOffset: -30, hour: 12 },
  { name: "Engagement", blurb: "Rings exchanged, promises made, dinner to follow.", dressCode: "Cocktail", dayOffset: -14, hour: 19 },
  { name: "Ganesh Puja", blurb: "We begin by asking for the remover of obstacles to bless the days ahead.", dressCode: "Traditional", dayOffset: -3, hour: 10 },
  { name: "Haldi", blurb: "Turmeric, laughter and a lot of yellow. Wear something you don't mind staining.", dressCode: "Yellows", dayOffset: -2, hour: 10, starter: true },
  { name: "Mehendi", blurb: "Henna on hands, chai on the lawn, and the dhol arrives after lunch.", dressCode: "Greens & florals", dayOffset: -2, hour: 16, starter: true },
  { name: "Sangeet", blurb: "Both families take the stage. Practised dances, unpractised ones, and dinner at the end.", dressCode: "Shimmer & silk", dayOffset: -1, hour: 19, starter: true },
  { name: "Baraat", blurb: "The groom arrives — with the band, the horse, and everyone dancing in front of it.", dressCode: "Traditional", dayOffset: 0, hour: 9 },
  { name: "Pheras", blurb: "Seven rounds of the sacred fire. The moment the whole week is for.", dressCode: "Traditional", dayOffset: 0, hour: 10, starter: true },
  { name: "Nikah", blurb: "The nikah ceremony, followed by lunch with both families.", dressCode: "Traditional", dayOffset: 0, hour: 11 },
  { name: "Muhurtham", blurb: "The auspicious hour. Mangalsutra, the fire, and blessings from every elder present.", dressCode: "Traditional / silks", dayOffset: 0, hour: 9 },
  { name: "Anand Karaj", blurb: "The wedding ceremony at the gurudwara, followed by langar.", dressCode: "Traditional — heads covered", dayOffset: 0, hour: 10 },
  { name: "Reception", blurb: "The celebration dinner — come dressed up, stay for the dance floor.", dressCode: "Formal", dayOffset: 0, hour: 19, starter: true },
  { name: "Walima", blurb: "The wedding feast hosted by the groom's family.", dressCode: "Formal", dayOffset: 1, hour: 19 },
  { name: "Vidaai", blurb: "The bride's farewell from her parents' home.", dressCode: "Traditional", dayOffset: 1, hour: 11 },
  { name: "Griha Pravesh", blurb: "Welcoming the bride into her new home.", dressCode: "Traditional", dayOffset: 1, hour: 17 },
];

export const DIET_OPTIONS = [
  { value: "veg", label: "Vegetarian" },
  { value: "non-veg", label: "Non-vegetarian" },
  { value: "jain", label: "Jain" },
  { value: "vegan", label: "Vegan" },
] as const;

const IST = "+05:30";

/** Event start time for a preset, given the wedding day (date part, IST). */
export function presetStart(preset: Pick<EventPreset, "dayOffset" | "hour">, weddingDate: Date): Date {
  const day = new Date(weddingDate.getTime() + preset.dayOffset * 86_400_000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
  return new Date(`${ymd}T${String(preset.hour).padStart(2, "0")}:00:00${IST}`);
}

export function starterEvents(weddingDate: Date, city: string) {
  return EVENT_PRESETS.filter((p) => p.starter).map((p, i) => ({
    name: p.name,
    startsAt: presetStart(p, weddingDate),
    venueName: "Venue to be announced",
    address: city,
    dressCode: p.dressCode,
    description: p.blurb,
    isPublished: true,
    sortOrder: i,
  }));
}
