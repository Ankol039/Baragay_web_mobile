# Resident mobile app

The user-approved Package C uses Expo React Native JavaScript with React Navigation (auth stack and protected resident tabs). Preserve the existing navigation architecture.

- Follow the root project memory and docs/firebase-runtime-contract.md. All mobile data access belongs in src/services/.
- Before changing Expo/native APIs, check package.json and the matching SDK documentation. Use npx expo install for compatible native dependencies.
- Keep the Firebase JS SDK persistence adapter on native; web has its platform-specific initializer. Never copy privileged credentials into the app.
- Run npm run lint, npm test, npm run build and npx expo-doctor. This JavaScript app has no TypeScript toolchain; record that limitation rather than introducing an unrelated conversion.
- Do not generate/edit ios/ or android/ by hand. Use Expo Go-supported modules. Device checks must be marked pending unless actually performed.
- The LAN gateway is an explicitly acknowledged private-network emulator demo, never production hosting. Preserve its allowlists and owner/Admin filtering.
