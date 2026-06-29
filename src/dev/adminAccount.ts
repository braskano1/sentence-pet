// DEV-only. Fixed admin credentials for the one-click admin sign-in button.
// The {admin:true} custom claim can only be granted server-side — seed this
// account once per emulator session with `npm run dev:admin`
// (scripts/seed-dev-admin.mjs uses the SAME email/password).
export const DEV_ADMIN_EMAIL = 'admin@test.dev';
export const DEV_ADMIN_PASSWORD = 'test1234';
