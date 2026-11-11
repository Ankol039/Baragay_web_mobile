# Package C — Expo resident implementation

Implemented the resident app in mobile/ with React Navigation, platform-specific Firebase initialization/persistence, per-app services, original schema/validator, complete registration/profile/survey/history/password flows and explicit staff/admin refusal. A narrowly allowlisted private-interface opt-in emulator gateway supports Expo Go and a same-origin Expo web demo. No Admin key or real environment file is included.

Fresh static verification: lint PASS, nine validator/family/gateway contract tests PASS, all-platform web/iOS/Android export PASS. Earlier agent Expo doctor: 20/20 PASS. Final coordinator browser rerun passes 35 real-service checks, including actual built React history, contact changes in both directions and website submissions in Expo history. Synthetic Expo web screenshots are under docs/evidence/expo-web/. User confirms the actual iPhone Expo Go app opens after matching Expo/CLI sign-in. Native restart/photo/submission/share and live bidirectional proof remain PENDING.

User-facing labels/palette and resident data semantics reuse the current web app. Native sharing/picking/printing remain platform-adapter implementations, not claims of an observed phone run. See mobile/README.md for exact dependency, emulator browser and trusted-LAN Expo Go commands. No live project operation was performed by this package.
