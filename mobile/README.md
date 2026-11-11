# Barangay resident mobile app

Expo React Native JavaScript app for residents, sharing the website's Firebase Authentication, Firestore model and trusted JavaScript API. Staff/admin accounts use the website. Navigation uses an auth stack plus Overview, Surveys, History and Profile tabs. Components do not access Firebase directly.

## Install and check

```sh
npm ci
npm run lint
npm test
npm run build
npm run doctor
```

The lockfile selects Expo SDK 58 and its compatible React Native dependencies. Use an Expo Go version supporting that SDK. The all-platform export is a bundle check; it is not an installed APK or proof of a physical-device run. No paid EAS build is required for this deliverable.

## Local emulator browser demo

First start the root project's Auth/Firestore emulators, then run `npm --prefix frontend run demo:emulators` in the Integration checkout. With that API on loopback 8787, run here:

```sh
npm run demo:emulators
```

Open `http://127.0.0.1:8790/`. This builds the actual Expo web target with emulator-only public config and starts the narrow API/Auth/Firestore gateway. Registration issues a Resident Number. Existing migrated rehearsal accounts use their number as temporary password and must complete first-login password change. Do not publish the emulator demo bundle as production.

## Expo Go on a phone

Keep phone and computer on the same trusted Wi-Fi. Choose the computer's specific private IPv4 interface (for example 192.168.1.10); do not use localhost or a public/all-interfaces bind. In both gateway and Metro terminals set:

```sh
export MOBILE_LAN_HOST=192.168.1.10
export MOBILE_TRUSTED_LAN_DEMO=I_UNDERSTAND_EMULATOR_TOKENS_ARE_INSECURE
```

Keep the root emulators and standalone API running. Start `npm run lan:emulators` in one terminal and `npm run native:emulators` in another. Run `npx expo login` and complete its browser confirmation, then sign in to Expo Go on the iPhone with the same Expo account before scanning the Metro QR. Expo Go on physical iOS requires both sessions; see [Expo sign-in troubleshooting](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/). The launcher supplies the existing project and chosen gateway addresses. Allow the required local-network/firewall access for Metro and gateway ports 8790–8792. Stop the gateway/Metro after the demo.

This gateway is only for a private emulator demonstration. Emulator tokens are not production credentials; path/owner filters do not turn the emulator into a secure public backend. Do not expose it through a public tunnel or port-forward. It accepts only the resident API entries, normal sign-in/refresh operations, project-pinned Firestore Listen and transaction REST routes; Admin/emulator management routes and owner credentials are refused. Native Firebase persistence uses AsyncStorage; passwords and privileged credentials are never stored there.

## Real project configuration

Copy `.env.example` to ignored `.env.local`, supply the same public Firebase web config used by the website, set `EXPO_PUBLIC_USE_EMULATORS=false`, and set `EXPO_PUBLIC_API_BASE_URL` to the deployed HTTPS Cloudflare `workers.dev` origin. Then use `npm start`. Public config is not an Admin credential. Never put a service account, operation secret or private key in any `EXPO_PUBLIC_` variable. The approved real-project import and rules/index deployment are recorded in docs/live-migration-verification.md. Mobile scripts do not deploy or import. The JavaScript API deployment and current Cloudflare free-tier limits are documented in `../docs/firebase-runtime-contract.md`; a local real-project check is also available below.

## Local real-project check

From the root, configure frontend/.env.local with the existing public web configuration and `VITE_USE_EMULATORS=false`. Keep the Admin credential external and start `npm --prefix frontend run demo:live` with `GOOGLE_APPLICATION_CREDENTIALS` pointing to that external credential. It serves the real-project website/API on loopback 8788 and renews server access privately; it does not modify data by starting.

For the iPhone on trusted Wi-Fi, set `MOBILE_LAN_HOST` to this Mac's specific private IPv4 address and run `npm run lan:live`. This forwards only resident API paths on port 8793; Firebase Auth/Firestore connect directly over TLS. In ignored mobile/.env.local set `EXPO_PUBLIC_API_BASE_URL=http://<Mac-private-IPv4>:8793`, the same Firebase public config and `EXPO_PUBLIC_USE_EMULATORS=false`. Stop the emulator Metro process before running `npm start -- --lan` to use these real-project values. This local HTTP gateway is for private development, not public hosting. The emulator and real gateways use separate ports and never serve one another's bundles. Do not enter real records into an emulator session or mistake a synthetic rehearsal for a live write.

## Included resident features

Registration/number login/logout, persisted sessions, first-login and normal password change, lifecycle refusal, overview/stat views, all four survey types, shared required/choice/rating/text validation, immutable duplicate-safe submissions, confirmation/history/response/CSV/share, full profile/contact edits, identity/address/birthdate/family correction requests, ordered people, compressed profile photo replace/remove and loading/refresh/error states. The copied pure response validator is byte-checked against the web source.

## Automated integration and device evidence

`MOBILE_API_ROOT=/absolute/path/to/integration npm run test:emulators` runs the self-cleaning real-service Expo web browser test with exclusive use of local emulator/API ports and a previously built emulator demo. It uses the Integration PHP router; it does not upload rules, reset global data or call production. Coordinate with other stateful suites.

The browser target exercises the same services and app screens but cannot establish native image permissions, native session restart, real Wi-Fi reachability or Expo Go installation. These physical-device checks remain explicitly PENDING until actually performed. See docs/testing-results.md in the final merged project for the current evidence status.
