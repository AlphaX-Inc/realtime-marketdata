import type { MarketState } from "../market-data/types.js";

const marketTimeZone = "America/New_York";

type EasternParts = {
  weekday: string;
  minutes: number;
};

function getEasternParts(date: Date): EasternParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: marketTimeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));

  return {
    weekday: value("weekday"),
    minutes: hour * 60 + minute,
  };
}

export function getUsMarketState(date = new Date()): MarketState {
  const { weekday, minutes } = getEasternParts(date);

  if (weekday === "Sat" || weekday === "Sun") {
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
