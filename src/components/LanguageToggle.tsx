import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface LanguageToggleProps {
  compact?: boolean;
  className?: string;
}

export function LanguageToggle({ compact = false, className = "" }: LanguageToggleProps) {
  const { lang, setLang } = useLanguage();
  const toggle = () => setLang(lang === "en" ? "bn" : "en");
  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={className || "h-9 w-9"}
        aria-label={lang === "en" ? "বাংলা" : "English"}
        title={lang === "en" ? "বাংলা" : "English"}
        onClick={toggle}
      >
        <span className="text-base">{lang === "en" ? "🇧🇩" : "🇬🇧"}</span>
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className={"w-full justify-start gap-2 " + className}
      onClick={toggle}
    >
      <span className="text-base">{lang === "en" ? "🇧🇩" : "🇬🇧"}</span>
      <span>{lang === "en" ? "বাংলা" : "English"}</span>
    </Button>
  );
}
