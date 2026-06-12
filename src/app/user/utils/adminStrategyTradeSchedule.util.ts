import { HttpStatusCode } from "../../../types/constants";
import {
  AdminStrategyTradeScheduleEvaluation,
  AdminStrategyTradeScheduleSettings,
  AdminStrategyTradeScheduleWindow,
} from "../interfaces";

export const DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE =
  "Asia/Kolkata";

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function validationError(message: string) {
  return {
    statusCode: HttpStatusCode._BAD_REQUEST,
    message,
  };
}

function ensureValidTimeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw validationError("timezone must be a valid IANA timezone");
  }
}

function normalizeTimeString(
  value: unknown,
  fieldLabel: string,
): string {
  const normalized = String(value ?? "").trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized)) {
    throw validationError(`${fieldLabel} must use HH:mm format`);
  }

  return normalized;
}

function timeStringToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map((part) => Number(part));
  return hour * 60 + minute;
}

function normalizeDaysOfWeek(value: unknown, index: number): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw validationError(
      `windows[${index}].daysOfWeek must be a non-empty array of integers between 0 and 6`,
    );
  }

  const normalized = Array.from(
    new Set(
      value.map((entry) => {
        if (!Number.isInteger(entry) || entry < 0 || entry > 6) {
          throw validationError(
            `windows[${index}].daysOfWeek must be a non-empty array of integers between 0 and 6`,
          );
        }
        return Number(entry);
      }),
    ),
  );

  normalized.sort((left, right) => left - right);
  return normalized;
}

function normalizeWindow(
  value: unknown,
  index: number,
  seenIds: Set<string>,
): AdminStrategyTradeScheduleWindow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(`windows[${index}] must be an object`);
  }

  const candidate = value as Record<string, unknown>;
  const id = String(candidate.id ?? "").trim() || `window_${index + 1}`;
  if (seenIds.has(id)) {
    throw validationError("window ids must be unique");
  }
  seenIds.add(id);

  const label = candidate.label;
  if (label !== undefined && label !== null && typeof label !== "string") {
    throw validationError(`windows[${index}].label must be a string or null`);
  }

  const isEnabled = candidate.isEnabled;
  if (typeof isEnabled !== "boolean") {
    throw validationError(`windows[${index}].isEnabled must be a boolean`);
  }

  return {
    id,
    label: typeof label === "string" ? label.trim() || null : null,
    daysOfWeek: normalizeDaysOfWeek(candidate.daysOfWeek, index),
    startTime: normalizeTimeString(
      candidate.startTime,
      `windows[${index}].startTime`,
    ),
    endTime: normalizeTimeString(
      candidate.endTime,
      `windows[${index}].endTime`,
    ),
    isEnabled,
  };
}

export function normalizeAdminStrategyTradeScheduleInput(payload: {
  isEnabled?: unknown;
  timezone?: unknown;
  windows?: unknown;
}): Omit<AdminStrategyTradeScheduleSettings, "updatedAt"> {
  if (typeof payload?.isEnabled !== "boolean") {
    throw validationError("isEnabled must be a boolean");
  }

  const timezoneInput =
    String(payload.timezone ?? DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE)
      .trim() || DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE;

  const timezone = ensureValidTimeZone(timezoneInput);

  if (!Array.isArray(payload.windows)) {
    throw validationError("windows must be an array");
  }

  const seenIds = new Set<string>();
  const windows = payload.windows.map((window, index) =>
    normalizeWindow(window, index, seenIds),
  );

  return {
    isEnabled: payload.isEnabled,
    timezone,
    windows,
  };
}

function getScheduleLocalParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );

  return {
    dayOfWeek: WEEKDAY_MAP[weekday] ?? 0,
    minutesOfDay: hour * 60 + minute,
  };
}

function matchesWindow(
  window: AdminStrategyTradeScheduleWindow,
  dayOfWeek: number,
  minutesOfDay: number,
): boolean {
  const startMinutes = timeStringToMinutes(window.startTime);
  const endMinutes = timeStringToMinutes(window.endTime);

  if (startMinutes === endMinutes) {
    return window.daysOfWeek.includes(dayOfWeek);
  }

  if (endMinutes > startMinutes) {
    return (
      window.daysOfWeek.includes(dayOfWeek) &&
      minutesOfDay >= startMinutes &&
      minutesOfDay < endMinutes
    );
  }

  const previousDay = (dayOfWeek + 6) % 7;
  if (
    window.daysOfWeek.includes(dayOfWeek) &&
    minutesOfDay >= startMinutes
  ) {
    return true;
  }

  return (
    window.daysOfWeek.includes(previousDay) && minutesOfDay < endMinutes
  );
}

export function evaluateAdminStrategyTradeSchedule(
  schedule: Pick<AdminStrategyTradeScheduleSettings, "isEnabled" | "timezone" | "windows">,
  evaluatedAt = new Date(),
): AdminStrategyTradeScheduleEvaluation {
  if (!schedule.isEnabled || schedule.windows.length === 0) {
    return {
      isBlocked: false,
      matchingWindowIds: [],
      evaluatedAt,
    };
  }

  let timezone = String(schedule.timezone || "").trim();
  if (!timezone) {
    timezone = DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE;
  }

  try {
    ensureValidTimeZone(timezone);
  } catch {
    timezone = DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE;
  }

  const { dayOfWeek, minutesOfDay } = getScheduleLocalParts(
    evaluatedAt,
    timezone,
  );

  const matchingWindowIds = schedule.windows
    .filter((window) => window.isEnabled)
    .filter((window) => matchesWindow(window, dayOfWeek, minutesOfDay))
    .map((window) => window.id);

  return {
    isBlocked: matchingWindowIds.length > 0,
    matchingWindowIds,
    evaluatedAt,
  };
}
