// The admin tool is reached at <app-url>/#admin. Hidden (not linked from the player UI)
// and hash-based so it needs no server rewrite on static hosting.
export function isAdminEntry(hash: string): boolean {
  return hash === '#admin';
}
