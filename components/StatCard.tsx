type StatCardProps = {
  title: string;
  value: string | number;
  description: string;
  icon: string;
  color: "blue" | "green" | "red" | "yellow";
};

const colorStyles = {
  blue: {
    icon: "bg-blue-50 text-blue-600",
    line: "bg-blue-600",
    value: "text-slate-900",
  },

  green: {
    icon: "bg-green-50 text-green-600",
    line: "bg-green-600",
    value: "text-green-700",
  },

  red: {
    icon: "bg-red-50 text-red-600",
    line: "bg-red-600",
    value: "text-red-700",
  },

  yellow: {
    icon: "bg-amber-50 text-amber-600",
    line: "bg-[#D4A72C]",
    value: "text-[#9B7518]",
  },
};

export default function StatCard({
  title,
  value,
  description,
  icon,
  color,
}: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      {/* TOP LINE */}
      <div className={`absolute left-0 top-0 h-1 w-full ${styles.line}`} />

      <div className="flex items-start justify-between">
        {/* TEXT */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {title}
          </p>

          <p
            className={`mt-3 text-3xl font-bold tracking-tight ${styles.value}`}
          >
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-400">{description}</p>
        </div>

        {/* ICON */}
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold ${styles.icon}`}
        >
          {icon}
        </div>
      </div>

      {/* DECORATION */}
      <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-slate-100 opacity-50 transition-transform duration-500 group-hover:scale-150" />
    </div>
  );
}
