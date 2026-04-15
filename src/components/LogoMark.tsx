import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../context/ThemeContext';

type LogoMarkProps = {
  size?: number;
  subtitle?: string;
};

export const LogoMark = ({ size = 140, subtitle }: LogoMarkProps) => {
  const { theme } = useAppTheme();
  const ringSize = size + 26;
  const stroke = Math.max(6, size * 0.08);

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderColor: theme.colors.secondary,
          },
        ]}
      />
      <LinearGradient
        colors={theme.isDark ? ['#14213D', '#1B51A3'] : ['#F0F4FF', '#C2DBFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        <View
          style={[
            styles.glow,
            {
              borderRadius: size / 2,
            },
          ]}
        />

        <View style={styles.symbolRow}>
          <View
            style={[
              styles.stroke,
              {
                width: stroke,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
          <View style={styles.symbolStack}>
            <View
              style={[
                styles.slanted,
                {
                  backgroundColor: theme.colors.secondary,
                  transform: [{ rotate: '-24deg' }],
                },
              ]}
            />
            <View
              style={[
                styles.slanted,
                {
                  backgroundColor: theme.colors.primary,
                  transform: [{ rotate: '24deg' }],
                },
              ]}
            />
          </View>
          <View
            style={[
              styles.stroke,
              {
                width: stroke,
                backgroundColor: theme.colors.secondary,
              },
            ]}
          />
        </View>

        <View style={styles.sparkRow}>
          <View
            style={[
              styles.spark,
              { borderColor: theme.colors.primary, opacity: 0.7 },
            ]}
          />
          <View
            style={[
              styles.spark,
              { borderColor: theme.colors.secondary, opacity: 0.35 },
            ]}
          />
        </View>
      </LinearGradient>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            { color: theme.isDark ? 'rgba(255,255,255,0.82)' : theme.colors.muted },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  glow: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0.35,
  },
  symbolRow: {
    width: '68%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  stroke: {
    height: '82%',
    borderRadius: 999,
  },
  symbolStack: {
    width: '40%',
    height: '62%',
    justifyContent: 'space-between',
  },
  slanted: {
    height: '48%',
    borderRadius: 999,
    opacity: 0.9,
  },
  sparkRow: {
    position: 'absolute',
    width: '60%',
    top: '18%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
