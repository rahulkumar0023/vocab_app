import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as LocalAuthentication from 'expo-local-authentication';

export type DeviceAuthState = {
  available: boolean;
  label: string;
};

export async function detectAvailableSignInOptions(): Promise<{
  appleAvailable: boolean;
  deviceAuth: DeviceAuthState;
}> {
  const [appleAvailable, hasHardware, isEnrolled, supportedAuthTypes] = await Promise.all([
    Platform.OS === 'ios'
      ? AppleAuthentication.isAvailableAsync().catch(() => false)
      : Promise.resolve(false),
    LocalAuthentication.hasHardwareAsync().catch(() => false),
    LocalAuthentication.isEnrolledAsync().catch(() => false),
    LocalAuthentication.supportedAuthenticationTypesAsync().catch(
      () => [] as LocalAuthentication.AuthenticationType[],
    ),
  ]);

  let label = 'Device unlock';

  if (
    supportedAuthTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    label = 'Face ID';
  } else if (
    supportedAuthTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
  ) {
    label = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
  } else if (
    supportedAuthTypes.includes(LocalAuthentication.AuthenticationType.IRIS)
  ) {
    label = 'Iris unlock';
  }

  return {
    appleAvailable,
    deviceAuth: {
      available: hasHardware && isEnrolled,
      label,
    },
  };
}
