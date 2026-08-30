import { RotateCw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

type LandscapeGateProps = {
  children: ReactNode;
};

function portraitMatches(): boolean {
  return window.matchMedia("(orientation: portrait)").matches;
}

export function LandscapeGate({ children }: LandscapeGateProps) {
  const { t } = useTranslation();
  const [isPortrait, setIsPortrait] = useState(portraitMatches);

  useEffect(() => {
    const portraitQuery = window.matchMedia("(orientation: portrait)");
    const updateOrientation = () => setIsPortrait(portraitQuery.matches);
    updateOrientation();
    portraitQuery.addEventListener("change", updateOrientation);
    return () => portraitQuery.removeEventListener("change", updateOrientation);
  }, []);

  if (isPortrait) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4 text-center text-sm text-muted-foreground" role="status">
        <div className="flex flex-col items-center gap-2">
          <RotateCw className="h-7 w-7 text-primary" aria-hidden="true" />
          <p>{t("usageMonitor.rotateLandscape")}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
