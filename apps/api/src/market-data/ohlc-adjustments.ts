import { db } from "../db.js";

type DailyOhlcAdjustmentRow = {
  id: string;
  date: Date | string;
  open: string | null;
  high: string | null;
  low: string | null;
  close: string | null;
  volume: string | null;
};

function toDateString(date: Date | string) {
  return typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const fixed = value.toFixed(10);
  const trimmed = fixed.replace(/\.?0+$/, "");

  return trimmed === "-0" ? "0" : trimmed;
}

function applyPriceFactor(value: string | null, factor: number) {
  if (value === null || factor === 1) {
    return value;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return value;
  }

  return formatNumber(numeric / factor);
}

function applyVolumeFactor(value: string | null, factor: number) {
  if (value === null || factor === 1) {
    return value;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return value;
  }

  return formatNumber(numeric * factor);
}

function getManualAdjustmentFactor(
  row: DailyOhlcAdjustmentRow,
  splits: { adjustmentDate: Date | string; factor: string }[],
) {
  const rowDate = toDateString(row.date);

  return splits.reduce((factor, split) => {
    if (rowDate < toDateString(split.adjustmentDate)) {
      const splitFactor = Number(split.factor);

      if (Number.isFinite(splitFactor) && splitFactor > 0) {
        return factor * splitFactor;
      }
    }

    return factor;
  }, 1);
}

export async function recomputeManualStockSplitAdjustments(symbol: string) {
  const [splits, rows] = await Promise.all([
    db.stockSplitAdjustment.findMany({
      where: {
        symbol,
        active: true,
        providerRefreshedAt: null,
      },
      orderBy: {
        adjustmentDate: "asc",
      },
      select: {
        adjustmentDate: true,
        factor: true,
      },
    }),
    db.dailyOhlcBar.findMany({
      where: {
        symbol,
      },
      orderBy: {
        date: "asc",
      },
      select: {
        id: true,
        date: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    }),
  ]);
  const adjustedAt = new Date();
  let adjustedRows = 0;

  await Promise.all(
    rows.map((row) => {
      const factor = getManualAdjustmentFactor(row, splits);
      const shouldAdjust = factor !== 1;

      if (shouldAdjust) {
        adjustedRows += 1;
      }

      return db.dailyOhlcBar.update({
        where: {
          id: row.id,
        },
        data: {
          manualAdjustedOpen: shouldAdjust ? applyPriceFactor(row.open, factor) : null,
          manualAdjustedHigh: shouldAdjust ? applyPriceFactor(row.high, factor) : null,
          manualAdjustedLow: shouldAdjust ? applyPriceFactor(row.low, factor) : null,
          manualAdjustedClose: shouldAdjust ? applyPriceFactor(row.close, factor) : null,
          manualAdjustedVolume: shouldAdjust ? applyVolumeFactor(row.volume, factor) : null,
          manualAdjustedAt: shouldAdjust ? adjustedAt : null,
        },
      });
    }),
  );

  return {
    adjustedRows,
  };
}
