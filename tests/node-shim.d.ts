// Minimal Node.js types for the config files, so we don't need @types/node.
declare const process: { cwd(): string; env: Record<string, string | undefined> };
