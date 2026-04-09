import { StyleSheet } from 'react-native';

export const COLORS = {
  primary: '#ff8a55',
  secondary: '#22446f',
  background: '#fff7ef',
  surface: '#fffdfb',
  textPrimary: '#25314c',
  textSecondary: '#6f748f',
  border: '#ead9cd',
  error: '#ffe0da',
  success: '#dff7ec',
};

export const COMMON_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 18,
    gap: 18,
  },
});
