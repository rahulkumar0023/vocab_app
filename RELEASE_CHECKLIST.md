# Release Checklist

## Product QA

- Verify onboarding, starter quiz, and starter deck import on a real device.
- Verify dictionary lookup and manual add flow with online and offline states.
- Verify review scheduling, streak, and completion state.
- Verify local reminders after fresh install and after device reboot.
- Verify audio pronunciation, haptics, sharing, and document import on iOS and Android.
- Verify backup export and restore using a real shared file.

## Store-readiness

- Replace bundle/package identifiers if you want a different production namespace.
- Create store screenshots for iPhone and Android phone sizes.
- Add final app description, subtitle, keywords, and support contact.
- Publish a final privacy policy URL.
- Decide whether AI is enabled in production and document that in the store listing.

## Build & submission

- Install EAS CLI: `npm install -g eas-cli`
- Log in: `eas login`
- Configure the project: `eas build:configure`
- Build preview: `eas build --profile preview --platform all`
- Build production: `eas build --profile production --platform all`
- Submit when ready: `eas submit --profile production --platform ios` and `eas submit --profile production --platform android`

## Optional hardening

- Add crash monitoring
- Add offline-specific error states
- Add accessibility labels and screen-reader checks
- Add a legal Terms document if you introduce accounts or subscriptions
