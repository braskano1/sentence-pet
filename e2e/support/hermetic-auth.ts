import { type Page } from '@playwright/test';

// Shared hermetic Firebase-auth-emulator stub + menu-walk helpers for full-UI
// e2e specs. Mounts the real game UI with zero auth/emulator/network dependency:
// intercept the emulator's Identity Toolkit REST calls so anonymous sign-in
// resolves, then walk the real menu to enter the game.

/**
 * Hermetic auth: the app boots into a Firebase Auth-EMULATOR anonymous sign-in
 * (.env.local has VITE_USE_EMULATOR=true). With no emulator reachable, the SDK's
 * signInAnonymously never resolves, so PlayerRoot stays on the loading splash and
 * the game UI never mounts — which the store-only spec never noticed because it
 * never renders any UI. We intercept the emulator's Identity Toolkit REST calls
 * and fulfill the anonymous-bootstrap (accounts:signUp) + account lookup so
 * onAuthChange fires with an anonymous user and `loading` flips false. That lands
 * us on the MainMenu (isAnonymous → not inGame); the caller then walks the real
 * menu UI ("Play as guest" → Skip intro) to mount the game — no emulator, no
 * network to a live Firebase project.
 *
 * Call this BEFORE `waitForHarness` (i.e. before `page.goto`) so the routes are
 * registered before the SDK fires its first request.
 */
export async function stubFirebaseAuth(page: Page) {
  const localId = 'e2e-uid';
  const idToken = 'e2e-id-token';
  const refreshToken = 'e2e-refresh-token';

  // NOTE: Playwright evaluates routes LAST-registered-first. Register the broad
  // catch-alls FIRST so the specific handlers below win for their exact endpoints.

  // Belt-and-suspenders: any other identitytoolkit / firestore call returns 200 so
  // the SDK never blocks on the unreachable emulator (cloud sync, etc.).
  await page.route(/firestore\.googleapis\.com\//, (route) =>
    route.fulfill({ contentType: 'application/json', body: '{}' }),
  );
  await page.route(/identitytoolkit\.googleapis\.com\//, (route) =>
    route.fulfill({ contentType: 'application/json', body: '{}' }),
  );

  // Anonymous bootstrap (signInAnonymously → accounts:signUp).
  await page.route(/identitytoolkit\.googleapis\.com\/v1\/accounts:signUp/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'identitytoolkit#SignupNewUserResponse',
        idToken, refreshToken, expiresIn: '3600', localId,
      }),
    }),
  );

  // getIdTokenResult(true) refreshes via the secure-token endpoint.
  await page.route(/securetoken\.googleapis\.com\/v1\/token/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: idToken, expires_in: '3600', token_type: 'Bearer',
        refresh_token: refreshToken, id_token: idToken, user_id: localId, project_id: 'demo-sentence-pet',
      }),
    }),
  );

  // accounts:lookup returns the user record (anonymous: no provider info).
  await page.route(/identitytoolkit\.googleapis\.com\/v1\/accounts:lookup/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        kind: 'identitytoolkit#GetAccountInfoResponse',
        users: [{ localId, validSince: '0', disabled: false, lastLoginAt: '0', createdAt: '0' }],
      }),
    }),
  );
}

/** Walk the real menu → game: anon sign-in lands on MainMenu, "Play as guest"
 *  starts the intro, "Skip" enters the game (petRoom). */
export async function enterGameViaMenu(page: Page) {
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await page.getByRole('button', { name: 'Play as guest' }).click();
  await page.getByRole('button', { name: /Skip/ }).click();
}
