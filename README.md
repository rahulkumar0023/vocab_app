# Vocab Builder Mobile App

A lightweight Expo/React Native app to help you build vocabulary every day.

## Features

- Smart review scheduling with `Again`, `Hard`, `Good`, and `Easy` ratings.
- Starter placement quiz to estimate the learner's level and set a better default daily goal.
- Local SQLite storage for words, review state, and review history.
- Topic-based word imports using multiple Datamuse query strategies, dictionary enrichment, and curated fallback packs.
- AI study kits that generate simpler explanations, memory hooks, mini quizzes, and usage tips.
- Super-simple local sign-in options with Apple, biometrics, and guest mode.
- A stronger mobile UI with dedicated `Today`, `Library`, `Add`, and `Profile` sections.
- Practice modes for flashcards, multiple choice, and typing recall.
- Word detail, edit, and delete flows for cleaning up your saved deck.
- Text-to-speech pronunciation and optional daily local reminders.
- Progress metrics for due cards, streak, retention, new words, and mastered words.
- Add your own words and example sentences, then send them straight into the study queue.

## Run locally

```bash
npm install
npm run start
```

Then open the app with an emulator (Android/iOS) or in Expo Go.

## Architecture notes

- `expo-sqlite` stores study data on-device.
- The review scheduler tracks interval, ease, repetitions, lapses, and due date per word.
- Imports try multiple Datamuse query strategies, enrich saved entries through Dictionary API, and fall back to curated topic packs when APIs are sparse.
- AI study kits are cached locally after generation so the app does not need to regenerate them each time.
- The user profile table stores onboarding results, reminder settings, favorite topic, and the current daily goal.
- A backend is optional. Add one later only if you need login, cloud sync, or shared decks.

## App flow

- `Today`: due reviews, practice mode switching, AI study kit, and progress toward the daily goal.
- `Library`: search, filter, inspect, edit, and delete saved words.
- `Add`: import topic-based words from live APIs or add custom words manually.
- `Profile`: local sign-in, starter quiz, daily goal, reminder toggle, and preferred topic.

## Notifications & speech

- Daily reminders use `expo-notifications` and require notification permission on the device.
- Pronunciation uses `expo-speech` with the device's available English voice.
- After changing notification-related app config, rebuild the native app if you are not running inside Expo Go.

## Release config

- App icon, Android adaptive icon, notification icon, splash image, and favicon now live under [assets](./assets).
- Expo app identifiers are configured in [app.json](./app.json):
  - iOS bundle identifier: `com.rahulkumar.vocabbuilder`
  - Android package: `com.rahulkumar.vocabbuilder`
- EAS build profiles are configured in [eas.json](./eas.json).

If you want a different production identifier, change those values before the first store submission.

## Publishing

Install EAS CLI and build with:

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform all
eas build --profile production --platform all
```

Files to review before publishing:

- [app.json](./app.json)
- [eas.json](./eas.json)
- [PRIVACY.md](./PRIVACY.md)
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)

## AI setup

The app includes a built-in `Smart Coach` mode that works out of the box with no AI account setup.

This repo is now scaffolded for `Firebase Functions + Gemini` as the hosted upgrade path. Create a local env file and restart Expo after changing it:

```bash
cp .env.example .env
npx expo start -c
```

- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- Optional: `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION`

Then deploy the server side:

```bash
cd functions
npm install
firebase login
firebase use <your-project-id>
firebase functions:secrets:set GEMINI_API_KEY
firebase deploy --only functions,firestore
```

The hosted function enforces a `5/day` Gemini quota per anonymous Firebase user and falls back to `Smart Coach` in the app when the cloud path is unavailable.

## iOS setup & testing

1. Install Xcode from the App Store.
2. Open Xcode once and accept the license.
3. Install iOS simulator components from Xcode settings.
4. Select Xcode command line tools:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
```

5. Verify simctl works:

```bash
xcrun simctl list devices
```

6. Start and run the app on iOS simulator:

```bash
npm run ios
```

If you still see `xcrun simctl ... code: 69`, it usually means Xcode/CLI tools are not fully installed or selected.
