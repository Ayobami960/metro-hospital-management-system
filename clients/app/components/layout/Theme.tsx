import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/provider/theme-provider";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
  { value: "system", icon: Monitor, label: "System theme" },
] as const;

const Theme = () => {
  const { setTheme, theme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-full border border-[#241006]/10 bg-[#241006]/5 p-1 dark:border-white/10 dark:bg-white/10">
      {themes.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => setTheme(value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-all duration-200 lg:size-8",
              isActive
                ? "scale-105 bg-[#241006] text-white shadow-sm dark:bg-white dark:text-[#241006]"
                : "text-[#241006]/50 hover:bg-[#241006]/10 hover:text-[#241006] dark:text-white/60 dark:hover:bg-white/20 dark:hover:text-white"
            )}
          >
            <Icon className="size-4" strokeWidth={2.25} />
          </button>
        );
      })}
    </div>
  );
};

export default Theme;