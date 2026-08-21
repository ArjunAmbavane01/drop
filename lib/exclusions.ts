const EXCLUDE_PATTERNS = [
  /(^|\/)node_modules($|\/)/,
  /(^|\/)\.git($|\/)/,
  /(^|\/)\.next($|\/)/,
  /(^|\/)\.nuxt($|\/)/,
  /(^|\/)\.angular($|\/)/,
  /(^|\/)dist($|\/)/,
  /(^|\/)build($|\/)/,
  /(^|\/)out($|\/)/,
  /(^|\/)\.turbo($|\/)/,
  /(^|\/)coverage($|\/)/,
  /(^|\/)\.DS_Store$/,
  /(^|\/)Thumbs\.db$/,
];

export function isExcludedPath(path: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(path));
}