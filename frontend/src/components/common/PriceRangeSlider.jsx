export const PRICE_SLIDER_MAX = 500_000;
export const PRICE_INPUT_MAX = 3_000_000;
const PRICE_STEP = 1_000;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizePrice(value, fallback, min, max) {
  if (value === "" || value == null) return fallback;

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? clamp(parsedValue, min, max) : fallback;
}

function formatPrice(value) {
  return `${Number(value).toLocaleString()}원`;
}

export default function PriceRangeSlider({
  min = 0,
  sliderMax = PRICE_SLIDER_MAX,
  inputMax = PRICE_INPUT_MAX,
  minValue,
  maxValue,
  onChange,
  label = "가격 범위",
  className = "",
}) {
  const rangeMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const maximumInput = Number.isFinite(Number(inputMax))
    ? Math.max(rangeMin, Number(inputMax))
    : PRICE_INPUT_MAX;
  const rangeMax = Number.isFinite(Number(sliderMax))
    ? clamp(Number(sliderMax), rangeMin, maximumInput)
    : Math.min(PRICE_SLIDER_MAX, maximumInput);
  const lowerValue = normalizePrice(minValue, rangeMin, rangeMin, maximumInput);
  const upperValue = normalizePrice(
    maxValue,
    rangeMax,
    lowerValue,
    maximumInput,
  );
  const sliderLowerValue = clamp(lowerValue, rangeMin, rangeMax);
  const sliderUpperValue = clamp(upperValue, rangeMin, rangeMax);
  const rangeSize = Math.max(rangeMax - rangeMin, 1);
  const lowerPercent = ((sliderLowerValue - rangeMin) / rangeSize) * 100;
  const upperPercent = ((sliderUpperValue - rangeMin) / rangeSize) * 100;

  const handleLowerChange = (event) => {
    const upperLimit = Math.max(rangeMin, sliderUpperValue - PRICE_STEP);
    const nextValue = Math.min(Number(event.target.value), upperLimit);

    onChange({ minValue: Math.max(rangeMin, nextValue), maxValue: upperValue });
  };

  const handleUpperChange = (event) => {
    const lowerLimit = Math.min(rangeMax, sliderLowerValue + PRICE_STEP);
    const nextValue = Math.max(Number(event.target.value), lowerLimit);

    onChange({ minValue: lowerValue, maxValue: Math.min(rangeMax, nextValue) });
  };

  const commitMinimumInput = () => {
    const roundedValue = Math.round(Number(minValue) / PRICE_STEP) * PRICE_STEP;
    const nextValue = Number.isFinite(roundedValue)
      ? clamp(roundedValue, rangeMin, upperValue)
      : rangeMin;

    onChange({ minValue: nextValue, maxValue: upperValue });
  };

  const commitMaximumInput = () => {
    const roundedValue =
      maxValue === ""
        ? rangeMax
        : Math.round(Number(maxValue) / PRICE_STEP) * PRICE_STEP;
    const nextValue = Number.isFinite(roundedValue)
      ? clamp(roundedValue, lowerValue, maximumInput)
      : rangeMax;

    onChange({ minValue: lowerValue, maxValue: nextValue });
  };

  const handleInputKeyDown = (event) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    event.currentTarget.blur();
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-[#444A45]">{label}</span>
        <span className="text-xs font-bold text-[#6D5CCF]">
          {formatPrice(lowerValue)} ~ {formatPrice(upperValue)}
        </span>
      </div>
      <div className="relative mt-4 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#6D5CCF]"
          style={{ left: `${lowerPercent}%`, right: `${100 - upperPercent}%` }}
        />
        <input
          type="range"
          min={rangeMin}
          max={rangeMax}
          step={PRICE_STEP}
          value={sliderLowerValue}
          onChange={handleLowerChange}
          aria-label="최소 가격"
          className="price-range-input z-20"
        />
        <input
          type="range"
          min={rangeMin}
          max={rangeMax}
          step={PRICE_STEP}
          value={sliderUpperValue}
          onChange={handleUpperChange}
          aria-label="최대 가격"
          className="price-range-input z-30"
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-400">
        <span>{formatPrice(rangeMin)}</span>
        <span>{formatPrice(rangeMax)}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-slate-500">
          최소 가격
          <div className="relative mt-1.5">
            <input
              type="number"
              min={rangeMin}
              max={maximumInput}
              step={PRICE_STEP}
              value={minValue === "" ? "" : lowerValue}
              onChange={(event) =>
                onChange({ minValue: event.target.value, maxValue: upperValue })
              }
              onBlur={commitMinimumInput}
              onKeyDown={handleInputKeyDown}
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-7 text-right text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              원
            </span>
          </div>
        </label>
        <label className="text-xs font-semibold text-slate-500">
          최대 가격
          <div className="relative mt-1.5">
            <input
              type="number"
              min={rangeMin}
              max={maximumInput}
              step={PRICE_STEP}
              value={maxValue === "" ? "" : upperValue}
              onChange={(event) =>
                onChange({ minValue: lowerValue, maxValue: event.target.value })
              }
              onBlur={commitMaximumInput}
              onKeyDown={handleInputKeyDown}
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-7 text-right text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              원
            </span>
          </div>
        </label>
      </div>
      <p className="mt-2 text-right text-[11px] font-medium text-slate-400">
        최대 {formatPrice(maximumInput)}
      </p>
    </div>
  );
}
