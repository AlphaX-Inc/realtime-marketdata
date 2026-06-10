import type { MarketState } from "../market-data/types.js";

function getTokyoParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: value("weekday"),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function minutesSinceMidnight(hour: number, minute: number) {
  return hour * 60 + minute;
}

export function getJapanMarketState(date = new Date()): MarketState {
  const { weekday, hour, minute } = getTokyoParts(date);

  if (weekday === "Sat" || weekday === "Sun") {
    return "closed";
  }

  const minutes = minutesSinceMidnight(hour, minute);
  const morningOpen = minutesSinceMidnight(9, 0);
  const morningClose = minutesSinceMidnight(11, 30);
  const afternoonOpen = minutesSinceMidnight(12, 30);
  const afternoonClose = minutesSinceMidnight(15, 30);

  if (
    (minutes >= morningOpen && minutes < morningClose) ||
    (minutes >= afternoonOpen && minutes < afternoonClose)
  ) {
    return "regular";
  }

  return "closed";
}
