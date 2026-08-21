export const DEFAULT_EXCLUSIONS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".venv",
  "venv",
  "__pycache__",
  "*.log",
  ".DS_Store",
  "Thumbs.db",
];

export function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`(^|/)${escaped}($|/)`);
}

export function compileExclusionMatcher(patterns: string[]): (path: string) => boolean {
  const regexes = patterns
    .map((p) => {
      try {
        return globToRegex(p);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as RegExp[];

  return (path: string) => {
    for (let i = 0; i < regexes.length; i++) {
      if (regexes[i].test(path)) {
        return true;
      }
    }
    return false;
  };
}

export function validateExclusionPattern(pattern: string): string | null {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return "Pattern cannot be empty.";
  }
  if (trimmed.length > 255) {
    return "Pattern cannot exceed 255 characters.";
  }
  if (trimmed.includes("**")) {
    return "Recursive wildcards (**) are not supported. Use single asterisks (*).";
  }
  if (trimmed.includes("\\")) {
    return "Use forward slashes (/) instead of backslashes (\\).";
  }
  return null;
}

export function isExcludedPath(path: string, exclusions: string[] = DEFAULT_EXCLUSIONS): boolean {
  const matcher = compileExclusionMatcher(exclusions);
  return matcher(path);
}