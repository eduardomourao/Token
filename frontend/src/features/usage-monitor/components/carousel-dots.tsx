type CarouselDotsProps = {
  total: number;
  active: number;
};

export function CarouselDots({ total, active }: CarouselDotsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-[22px] items-center justify-center gap-1.5" aria-label={t("usageMonitor.carouselPosition")}>
      {Array.from({ length: total }, (_, index) => {
        const isActive = index === active;
        return <span key={index} aria-hidden="true" className={isActive ? "h-2 w-2 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full bg-zinc-700"} />;
      })}
    </div>
  );
}
import { useTranslation } from "react-i18next";
