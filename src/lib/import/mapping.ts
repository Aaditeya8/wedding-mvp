import type { ColumnProfile } from "./profile";
import type { TargetField } from "./targets";

export type EventRef = { id: string; name: string; sortOrder: number };

/** How a sheet's columns line up with our fields. Column indexes refer to Sheet.headers. */
export type Mapping = {
  granularity: "family" | "guest";
  fields: Record<TargetField, number | null>;
  /** eventId → index of a yes/no column for that event */
  eventColumns: Record<string, number | null>;
  /** 0..1 per field, display only */
  confidence: Partial<Record<TargetField, number>>;
};

export type QuestionId = "granularity" | "groupBy" | "events" | "missingEmail" | "onExisting";

export type Question = {
  id: QuestionId;
  text: string;
  options: { value: string; label: string }[];
  default: string;
  /** For the "choose" style option: the multi-select list shown when it is picked. */
  choices?: { value: string; label: string }[];
};

export type Answers = Record<string, string | string[]>;

export type Proposal = {
  mapping: Mapping;
  questions: Question[];
  notes: string[];
  engine: "heuristic" | "ai";
};

export const EMPTY_FIELDS: Record<TargetField, number | null> = {
  familyName: null, guestName: null, side: null, relation: null,
  email: null, ageGroup: null, headcount: null, eventsList: null,
};

export function mainEvents(events: EventRef[]): EventRef[] {
  return [...events].sort((a, b) => a.sortOrder - b.sortOrder).slice(-3);
}

/**
 * The questions the sheet cannot answer by itself. Deterministic from the mapping,
 * so the AI and heuristic engines ask the same things.
 */
export function buildQuestions(
  mapping: Mapping,
  profiles: ColumnProfile[],
  events: EventRef[],
  missingEmailCount: number,
): Question[] {
  const qs: Question[] = [];
  const header = (i: number | null) => (i === null ? null : profiles[i]?.header ?? `column ${i + 1}`);

  qs.push({
    id: "granularity",
    text: "Is each row one household, or one person?",
    options: [
      { value: "family", label: "One household per row" },
      { value: "guest", label: "One person per row" },
    ],
    default: mapping.granularity,
  });

  if (mapping.granularity === "guest") {
    const fam = mapping.fields.familyName;
    const options: Question["options"] = [];
    if (fam !== null) options.push({ value: `column:${fam}`, label: `By the “${header(fam)}” column` });
    options.push(
      { value: "email", label: "Same email = same household" },
      { value: "surname", label: "Same surname = same household" },
      { value: "none", label: "Each row is its own household" },
    );
    qs.push({
      id: "groupBy",
      text: "How should people be grouped into households? (One invite goes to each household.)",
      options,
      default: fam !== null ? `column:${fam}` : mapping.fields.email !== null ? "email" : "surname",
    });
  }

  const hasEventInfo = Object.values(mapping.eventColumns).some((v) => v !== null) || mapping.fields.eventsList !== null;
  if (!hasEventInfo && events.length > 0) {
    const main = mainEvents(events);
    const options: Question["options"] = [{ value: "all", label: "Every event" }];
    if (events.length > 3) options.push({ value: "main", label: `Main events only: ${main.map((e) => e.name).join(", ")}` });
    options.push({ value: "choose", label: "Let me pick…" });
    qs.push({
      id: "events",
      text: "Your sheet doesn't say which events each household is invited to. Invite everyone to:",
      options,
      default: "all",
      choices: [...events].sort((a, b) => a.sortOrder - b.sortOrder).map((e) => ({ value: e.id, label: e.name })),
    });
  }

  if (missingEmailCount > 0) {
    qs.push({
      id: "missingEmail",
      text: `${missingEmailCount} ${missingEmailCount === 1 ? "row has" : "rows have"} no email. Import ${missingEmailCount === 1 ? "it" : "them"} anyway (you can add emails later) or skip?`,
      options: [
        { value: "import", label: "Import anyway, add emails later" },
        { value: "skip", label: "Skip rows without an email" },
      ],
      default: "import",
    });
  }

  return qs;
}
