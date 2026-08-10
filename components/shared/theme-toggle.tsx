"use client";

import { useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      title={
        mounted
          ? resolvedTheme === "dark"
            ? "Switch to light theme"
            : "Switch to dark theme"
          : "Toggle theme"
      }
      aria-label="Toggle theme"
    >
      {mounted && resolvedTheme === "dark" ? (
        <MoonStar className="size-4" />
      ) : (
        <SunMedium className="size-4" />
      )}
    </Button>
  );
}
