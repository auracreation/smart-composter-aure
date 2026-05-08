"use client";

type Accent = "blue" | "orange" | "green";
type BadgeTone = "blue" | "orange" | "green" | "red" | "gray";

interface MetricGaugeProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  accent: Accent;
  icon: string;
  badge: { label: string; tone: BadgeTone };
  decimals?: number;
  offline?: boolean;
}

const accentMap: Record<Accent, { iconBg: string; iconText: string; bar: string }> = {
  blue:   { iconBg: "bg-blue-50",   iconText: "text-brand-blue",   bar: "bg-brand-blue" },
  orange: { iconBg: "bg-orange-50", iconText: "text-brand-orange", bar: "bg-brand-orange" },
  green:  { iconBg: "bg-green-50",  iconText: "text-brand-green",  bar: "bg-brand-green" },
};

const toneMap: Record<BadgeTone, { bg: string; text: string }> = {
  blue:   { bg: "bg-blue-100",   text: "text-brand-blue" },
  orange: { bg: "bg-orange-100", text: "text-brand-orange" },
  green:  { bg: "bg-green-100",  text: "text-brand-green" },
  red:    { bg: "bg-red-100",    text: "text-brand-red" },
  gray:   { bg: "bg-gray-100",   text: "text-gray-500" },
};

export default function MetricGauge({
  label, value, unit, min, max, accent, icon, badge, decimals = 0, offline = false,
}: MetricGaugeProps) {
  const clampedValue = isNaN(value) ? min : Math.max(min, Math.min(max, value));
  const pct = offline ? 0 : ((clampedValue - min) / (max - min)) * 100;
  const displayValue = offline ? "--" : (isNaN(value) ? "--" : value.toFixed(decimals));
  const { iconBg, iconText, bar } = accentMap[accent];
  const { bg: badgeBg, text: badgeText } = toneMap[badge.tone];

  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-card transition-opacity ${offline ? "border-gray-200 opacity-60" : "border-gray-100"}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wider truncate">{label}</h3>
        {!offline && (
          <span className={`${badgeBg} ${badgeText} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center ${iconText} text-xl flex-shrink-0`}>
          <i className={`fa-solid ${icon}`} />
        </div>
        <div className={`text-3xl font-bold ${iconText}`}>
          {displayValue}<span className="text-lg text-gray-400">{unit}</span>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-4">
        <div
          className={`${bar} h-1.5 rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
