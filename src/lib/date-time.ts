export const APP_TIME_ZONE = "America/Sao_Paulo";
export const APP_LOCALE = "pt-BR";

const dateTimeLocalPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

type DateInput = Date | string | number | null | undefined;

type ZonedParts = {
  day: string;
  hour: string;
  minute: string;
  month: string;
  second: string;
  year: string;
};

function toValidDate(value: DateInput) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getZonedParts(date: Date, timeZone = APP_TIME_ZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: byType.day,
    hour: byType.hour,
    minute: byType.minute,
    month: byType.month,
    second: byType.second,
    year: byType.year
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone = APP_TIME_ZONE) {
  const parts = getZonedParts(date, timeZone);
  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return localAsUtc - date.getTime();
}

export function serverNow() {
  return new Date();
}

export function formatDateTimeInSaoPaulo(value: DateInput, options?: { seconds?: boolean }) {
  const date = toValidDate(value);

  if (!date) {
    return "-";
  }

  const parts = getZonedParts(date);
  const time = options?.seconds
    ? `${parts.hour}:${parts.minute}:${parts.second}`
    : `${parts.hour}:${parts.minute}`;

  return `${parts.day}/${parts.month}/${parts.year} as ${time}`;
}

export function formatDateInSaoPaulo(value: DateInput) {
  const date = toValidDate(value);

  if (!date) {
    return "-";
  }

  const parts = getZonedParts(date);

  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatDateTimeLocalForSaoPaulo(value: DateInput, options?: { seconds?: boolean }) {
  const date = toValidDate(value);

  if (!date) {
    return "";
  }

  const parts = getZonedParts(date);
  const base = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;

  return options?.seconds ? `${base}:${parts.second}` : base;
}

export function parseSaoPauloDateTimeLocalToUtc(value: string) {
  const match = dateTimeLocalPattern.exec(value.trim());

  if (!match) {
    return new Date(Number.NaN);
  }

  const [, year, month, day, hour, minute, second = "00", millisecond = "0"] = match;
  const normalizedMillisecond = millisecond.padEnd(3, "0").slice(0, 3);
  const naiveUtcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(normalizedMillisecond)
  );
  const firstOffset = getTimeZoneOffsetMs(new Date(naiveUtcMs));
  let utcDate = new Date(naiveUtcMs - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(utcDate);

  if (secondOffset !== firstOffset) {
    utcDate = new Date(naiveUtcMs - secondOffset);
  }

  const roundTrip = formatDateTimeLocalForSaoPaulo(utcDate, {
    seconds: value.trim().length > 16
  });
  const expected =
    value.trim().length === 16
      ? value.trim()
      : `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  return roundTrip === expected ? utcDate : new Date(Number.NaN);
}

export function preprocessSaoPauloDateTimeLocal(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return dateTimeLocalPattern.test(trimmedValue)
    ? parseSaoPauloDateTimeLocalToUtc(trimmedValue)
    : value;
}

export function getSaoPauloDateKey(value: DateInput) {
  const date = toValidDate(value);

  if (!date) {
    return "";
  }

  const parts = getZonedParts(date);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getSaoPauloDayRangeUtc(value: DateInput = serverNow()) {
  const date = toValidDate(value) ?? serverNow();
  const parts = getZonedParts(date);
  const start = parseSaoPauloDateTimeLocalToUtc(`${parts.year}-${parts.month}-${parts.day}T00:00`);
  const end = new Date(start.getTime() + 86_400_000);

  return {
    end,
    start
  };
}

export function getSaoPauloMonthRangeUtc(value: DateInput = serverNow()) {
  const date = toValidDate(value) ?? serverNow();
  const parts = getZonedParts(date);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const start = parseSaoPauloDateTimeLocalToUtc(`${parts.year}-${parts.month}-01T00:00`);
  const end = parseSaoPauloDateTimeLocalToUtc(
    `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01T00:00`
  );

  return {
    end,
    start
  };
}

export function getSaoPauloDayDifference(a: DateInput, b: DateInput) {
  const first = getSaoPauloDayRangeUtc(a).start.getTime();
  const second = getSaoPauloDayRangeUtc(b).start.getTime();

  return Math.round((first - second) / 86_400_000);
}

export function isBeforeOrEqualNow(value: DateInput, now: Date = serverNow()) {
  const date = toValidDate(value);

  return !date || date.getTime() <= now.getTime();
}

export function isWithinServerWindow(start: DateInput, end: DateInput, now: Date = serverNow()) {
  const startDate = toValidDate(start);
  const endDate = toValidDate(end);

  return Boolean(
    startDate &&
    endDate &&
    startDate.getTime() <= now.getTime() &&
    endDate.getTime() >= now.getTime()
  );
}
