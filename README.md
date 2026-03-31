# Vocab Builder Mobile App

A lightweight Expo/React Native app to help you build vocabulary every day.

## Features

- Flashcard-style review for words and definitions.
- Progress metrics (total, learning, and known words).
- Add your own words and example sentences.
- Daily challenge list prioritized by words still in learning mode.

## Run locally

```bash
npm install
npm run start
```

Then open the app with an emulator (Android/iOS) or in Expo Go.

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


