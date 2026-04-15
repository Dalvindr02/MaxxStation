import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import { moderateScale } from 'react-native-size-matters';
import { useAppTheme } from '../context/ThemeContext';
import { AppTheme } from '../theme';

export function SectionTitle({ children }: { children: string }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={[styles.card, style]}>{children}</View>;
}

const AnimatedView = Animated.View;

export function AnimatedCard({
  children,
  style,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <AnimatedView
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </AnimatedView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  style,
  disabled,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <ActionButton
      label={label}
      onPress={onPress}
      style={style}
      disabled={disabled}
      trailingIcon={null}
    />
  );
}

export function SecondaryButton({
  label,
  onPress,
  style,
  disabled,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <ActionButton
      label={label}
      onPress={onPress}
      style={style}
      disabled={disabled}
      trailingIcon={null}
      variant="secondary"
    />
  );
}

export function ActionButton({
  label,
  onPress,
  icon,
  subtitle,
  style,
  disabled,
  variant = 'primary',
  trailingIcon,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  trailingIcon?: string | null;
}) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isPrimary = variant === 'primary';
  const gradientColors = isPrimary
    ? theme.isDark
      ? ['rgba(255,106,136,0.96)', 'rgba(255,79,216,0.9)']
      : ['rgba(255,255,255,0.92)', 'rgba(255,236,242,0.98)']
    : theme.isDark
    ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
    : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.72)'];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionButtonShell,
        disabled && styles.buttonDisabled,
        style,
      ]}
      activeOpacity={0.88}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.actionButtonGradient,
          isPrimary ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        ]}
      >
        {icon ? (
          <View
            style={[
              styles.actionButtonIconWrap,
              isPrimary
                ? styles.actionButtonIconWrapPrimary
                : styles.actionButtonIconWrapSecondary,
            ]}
          >
            <Feather
              name={icon as any}
              size={17}
              color={isPrimary ? '#0F172A' : theme.colors.primary}
            />
          </View>
        ) : null}
        <View
          style={[
            styles.actionButtonContent,
            !icon &&
              trailingIcon === null &&
              styles.actionButtonContentCentered,
          ]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.actionButtonLabel,
              !isPrimary && styles.actionButtonLabelSecondary,
              !icon && trailingIcon === null && styles.actionButtonTextCentered,
            ]}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.actionButtonSubtitle,
                !isPrimary && styles.actionButtonSubtitleSecondary,
                !icon &&
                  trailingIcon === null &&
                  styles.actionButtonTextCentered,
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailingIcon === null ? null : (
          <View
            style={[
              styles.actionButtonArrow,
              !isPrimary && styles.actionButtonArrowSecondary,
            ]}
          >
            <Feather
              name={
                (trailingIcon ||
                  (isPrimary ? 'arrow-up-right' : 'chevron-right')) as any
              }
              size={16}
              color={isPrimary ? '#FFFFFF' : theme.colors.primary}
            />
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function StatusBadge({
  children,
  type,
}: {
  children: string;
  type: 'success' | 'warning' | 'danger' | 'info';
}) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const getBadgeStyle = () => {
    switch (type) {
      case 'success':
        return styles.statusBadgeSuccess;
      case 'warning':
        return styles.statusBadgeWarning;
      case 'danger':
        return styles.statusBadgeDanger;
      case 'info':
        return styles.statusBadgeInfo;
      default:
        return styles.statusBadgeInfo;
    }
  };

  return (
    <View style={[styles.statusBadge, getBadgeStyle()]}>
      <Text style={styles.statusBadgeText}>{children}</Text>
    </View>
  );
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: string;
}) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricIcon}>{icon}</Text>
        <View style={styles.metricTitleContainer}>
          <Text style={styles.metricTitle}>{title}</Text>
          {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 16,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: theme.isDark ? 0.35 : 0.22,
      shadowRadius: 14,
      elevation: 8,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 999,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.24)',
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.42,
      shadowRadius: 16,
      elevation: 8,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 16,
      letterSpacing: 0.4,
    },
    secondaryButton: {
      backgroundColor: theme.colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 999,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.glowStrong,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 6,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    actionButtonShell: {
      width: '100%',
      alignSelf: 'stretch',
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,106,136,0.18)',
      shadowColor: theme.colors.glow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: theme.isDark ? 0.28 : 0.12,
      shadowRadius: 18,
      elevation: 8,
    },
    actionButtonGradient: {
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: moderateScale(55),
      gap: 9,
    },
    actionButtonPrimary: {},
    actionButtonSecondary: {
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonIconWrap: {
      width: moderateScale(42),
      height: moderateScale(42),
      borderRadius: moderateScale(14),
      margin: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    actionButtonIconWrapPrimary: {
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.18)'
        : 'rgba(255,106,136,0.14)',
      borderColor: theme.isDark
        ? 'rgba(255,255,255,0.16)'
        : 'rgba(255,106,136,0.2)',
    },
    actionButtonIconWrapSecondary: {
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,106,136,0.08)',
      borderColor: theme.colors.border,
    },
    actionButtonContent: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    actionButtonContentCentered: {
      flex: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonLabel: {
      color: '#0F172A',
      fontWeight: '800',
      fontSize: moderateScale(14),
      lineHeight: moderateScale(18),
    },
    actionButtonLabelSecondary: {
      color: theme.colors.text,
    },
    actionButtonSubtitle: {
      marginTop: 2,
      color: '#475569',
      fontSize: moderateScale(11),
      lineHeight: moderateScale(14),
      fontWeight: '600',
    },
    actionButtonSubtitleSecondary: {
      color: theme.colors.muted,
    },
    actionButtonTextCentered: {
      textAlign: 'center',
    },
    actionButtonArrow: {
      width: moderateScale(34),
      height: moderateScale(34),
      right: 12,
      borderRadius: moderateScale(17),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    actionButtonArrowSecondary: {
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.1)'
        : 'rgba(255,106,136,0.12)',
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      alignSelf: 'flex-start',
      marginBottom: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    statusBadgeSuccess: { backgroundColor: 'rgba(93,255,169,0.2)' },
    statusBadgeWarning: { backgroundColor: 'rgba(255,216,107,0.18)' },
    statusBadgeDanger: { backgroundColor: 'rgba(248,113,113,0.2)' },
    statusBadgeInfo: { backgroundColor: 'rgba(115,103,255,0.24)' },
    statusBadgeText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    metricCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.glowStrong,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
      elevation: 5,
    },
    metricHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    metricIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    metricTitleContainer: {
      flex: 1,
    },
    metricTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    metricSubtitle: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    metricValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      textShadowColor: 'rgba(255,99,235,0.35)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
  });
