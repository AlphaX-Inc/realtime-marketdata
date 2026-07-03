import type { MarketState } from "../market-data/types.js";

const marketTimeZone = "America/New_York";

type EasternParts = {
  date: string;
  weekday: string;
  minutes: number;
};

function getEasternParts(date: Date): EasternParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: marketTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: value("weekday"),
    minutes: hour * 60 + minute,
  };
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function fixedHolidayObservedDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();

  if (weekday === 6) {
    return toDateString(addDays(date, -1));
  }

  if (weekday === 0) {
    return toDateString(addDays(date, 1));
  }

  return toDateString(date);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return toDateString(addDays(first, offset + (nth - 1) * 7));
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return toDateString(addDays(last, -offset));
}

function getEasterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function getFullDayMarketHolidays(year: number) {
  return new Set([
    fixedHolidayObservedDate(year, 1, 1),
    nthWeekdayOfMonth(year, 1, 1, 3),
    nthWeekdayOfMonth(year, 2, 1, 3),
    toDateString(addDays(getEasterSunday(year), -2)),
    lastWeekdayOfMonth(year, 5, 1),
    fixedHolidayObservedDate(year, 6, 19),
    fixedHolidayObservedDate(year, 7, 4),
    nthWeekdayOfMonth(year, 9, 1, 1),
    nthWeekdayOfMonth(year, 11, 4, 4),
    fixedHolidayObservedDate(year, 12, 25),
  ]);
}

function isFullDayMarketHoliday(date: string) {
  const year = Number(date.slice(0, 4));
  const holidays = new Set([
    ...getFullDayMarketHolidays(year),
    ...getFullDayMarketHolidays(year + 1),
  ]);

  return holidays.has(date);
}

export function getUsMarketState(date = new Date()): MarketState {
  const { date: marketDate, weekday, minutes } = getEasternParts(date);

  if (weekday === "Sat" || weekday === "Sun" || isFullDayMarketHoliday(marketDate)) {
    return "closed";
  }

  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) {
    return "pre";
  }

  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) {
    return "regular";
  }

  if (minutes >= 16 * 60 && minutes < 20 * 60) {
    return "post";
  }

  return "closed";
}
