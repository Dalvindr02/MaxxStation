import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { AppTheme } from '../theme';

const TAB_ICONS: Record<string, string> = {
  Home: 'home',
  Attendance: 'check-square',
  Logs: 'file-text',
  Expenses: 'dollar-sign',
  Profile: 'user',
};

const ACCENT_GLOW_LIGHT = '#FF62EB';
const ACCENT_GLOW_DARK = '#5FCBFF';

type CustomTabBarProps = BottomTabBarProps & {
  theme: AppTheme;
};

export function CustomTabBar({
  state,
  descriptors,
  navigation,
  insets,
  theme,
}: CustomTabBarProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const anims = useRef<Record<string, Animated.Value>>({});

  state.routes.forEach((route, index) => {
    if (!anims.current[route.key]) {
      anims.current[route.key] = new Animated.Value(
        state.index === index ? 1 : 0,
      );
    }
  });

  useEffect(() => {
    Animated.parallel(
      state.routes.map((route, index) =>
        Animated.timing(anims.current[route.key], {
          toValue: state.index === index ? 1 : 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [state.index, state.routes]);

  return (
    <View
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <View style={styles.bar}>
        <LinearGradient
          colors={theme.gradients.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.barGradient}
        />
        <View style={styles.topAccent} pointerEvents="none" />

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const iconName = TAB_ICONS[route.name] || 'circle';
          const itemAnim = anims.current[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Animated.View
              key={route.key}
              style={[
                styles.tabItem,
                {
                  transform: [
                    {
                      translateY: itemAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -2],
                      }),
                    },
                    {
                      scale: itemAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.06],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={
                  descriptors[route.key].options.tabBarAccessibilityLabel
                }
                testID={descriptors[route.key].options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.85}
                style={[
                  styles.tabButton,
                  isFocused ? styles.tabButtonFocused : undefined,
                ]}
              >
                <View
                  style={[
                    styles.iconChip,
                    isFocused ? styles.iconChipFocused : undefined,
                  ]}
                >
                  <Feather
                    name={iconName}
                    size={18}
                    color={isFocused ? '#FFFFFF' : theme.colors.muted}
                  />
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
      {/* <View style={styles.bottomHandle} pointerEvents="none" /> */}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    outer: {
      backgroundColor: 'transparent',
      paddingHorizontal: 16,
      paddingTop: 6,
    },
    bar: {
      height: 74,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 2,
      shadowColor: theme.isDark ? ACCENT_GLOW_DARK : ACCENT_GLOW_LIGHT,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: theme.isDark ? 0.48 : 0.34,
      shadowRadius: 18,
      elevation: 11,
      overflow: 'hidden',
    },
    barGradient: {
      ...StyleSheet.absoluteFillObject,
      opacity: 1,
    },
    topAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: 'rgba(255,255,255,0.32)',
    },
    activePill: {
      display: 'none',
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    tabButton: {
      minWidth: 62,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      paddingHorizontal: 8,
    },
    tabButtonFocused: {
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    iconChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    iconChipFocused: {
      backgroundColor: theme.colors.primary,
      borderColor: 'rgba(255,255,255,0.22)',
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
    },
    bottomHandle: {
      position: 'absolute',
      bottom: 12,
      alignSelf: 'center',
      width: 78,
      height: 4,
      borderRadius: 8,
      backgroundColor: theme.isDark ? '#15243E' : '#D8E5FF',
    },
  });
