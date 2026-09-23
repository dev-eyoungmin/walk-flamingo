import React from 'react';
import { StyleSheet, View } from 'react-native';

export const CoinGlyph: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <View style={[styles.coinOuter, { width: size, height: size, borderRadius: size / 2 }]}>
    <View style={[styles.coinInner, { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31 }]} />
  </View>
);

const styles = StyleSheet.create({
  coinOuter: {
    backgroundColor: '#D08A12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInner: {
    backgroundColor: '#FFD23F',
  },
});
