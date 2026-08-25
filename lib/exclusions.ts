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
  const exactNames = new Set<string>();
  const extensions: string[] = [];
  const exactPaths: string[] = [];
  const regexes: RegExp[] = [];

  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (!trimmed) continue;

    const hasGlob = /[**?]/.test(trimmed);
    const hasSlash = trimmed.includes("/");

    if (!hasGlob && !hasSlash) {
      exactNames.add(trimmed);
    } else if (
      trimmed.startsWith("*.") &&
      !trimmed.slice(2).includes("*") &&
      !trimmed.slice(2).includes("?") &&
      !trimmed.includes("/")
    ) {
      extensions.push(trimmed.slice(1));
    } else if (!hasGlob && hasSlash) {
      const clean = trimmed.replace(/^\/+|\/+$/g, "");
      if (clean) exactPaths.push(clean);
    } else {
      try {
        regexes.push(globToRegex(trimmed));
      } catch {
        // ignore invalid regex
      }
    }
  }

  return (path: string) => {
    if (!path) return false;

    // 1. Fast check for exact segment names (e.g. node_modules, .git, dist, build)
    if (exactNames.size > 0) {
      let start = 0;
      while (start < path.length) {
        let end = path.indexOf("/", start);
        if (end === -1) end = path.length;
        const segment = path.substring(start, end);
        if (exactNames.has(segment)) {
          return true;
        }
        start = end + 1;
      }
    }

    // 2. Fast check for file extensions (e.g. .log)
    if (extensions.length > 0) {
      for (let i = 0; i < extensions.length; i++) {
        if (path.endsWith(extensions[i])) {
          return true;
        }
      }
    }

    // 3. Fast check for exact paths (e.g. foo/bar)
    if (exactPaths.length > 0) {
      for (let i = 0; i < exactPaths.length; i++) {
        const ep = exactPaths[i];
        if (
          path === ep ||
          path.startsWith(ep + "/") ||
          path.endsWith("/" + ep) ||
          path.includes("/" + ep + "/")
        ) {
          return true;
        }
      }
    }

    // 4. Fallback regexes for complex patterns
    if (regexes.length > 0) {
      for (let i = 0; i < regexes.length; i++) {
        if (regexes[i].test(path)) {
          return true;
        }
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