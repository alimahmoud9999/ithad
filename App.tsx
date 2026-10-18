import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, I18nManager } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider } from './src/store/AppContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { COLORS } from './src/theme/colors';

export default function App() {
  useEffect(() => {
    try {
      I18nManager.allowRTL(true);
    } catch {
      // Ignore if platform does not support dynamic RTL toggle
    }
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.surfaceCard}
          translucent={false}
        />
        <SafeAreaView
          style={styles.safeArea}
          edges={['left', 'right']}
        >
          <RootNavigator />
        </SafeAreaView>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
  },
});
