import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../context/ThemeContext';
import { AppTheme } from '../theme';

export type DialogVariant =
  | 'success'
  | 'info'
  | 'message'
  | 'warning'
  | 'error';

export type DialogAction = {
  label: string;
  onPress?: () => void;
};

type AppDialogProps = {
  visible: boolean;
  title?: string;
  message: string;
  variant?: DialogVariant;
  primaryAction?: DialogAction;
  secondaryAction?: DialogAction;
  onClose?: () => void;
  dismissOnBackdrop?: boolean;
};

export const AppDialog = ({
  visible,
  title,
  message,
  variant = 'info',
  primaryAction,
  secondaryAction,
  onClose,
  dismissOnBackdrop = true,
}: AppDialogProps) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const palette = useMemo(
    () => getVariantStyles(theme, variant),
    [theme, variant],
  );
  const scale = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.92);
      cardOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 160,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scale, cardOpacity]);

  const handleClose = () => {
    if (dismissOnBackdrop && onClose) {
      onClose();
    }
  };

  const renderAction = (
    action: DialogAction | undefined,
    type: 'primary' | 'secondary',
  ) => {
    if (!action) return null;

    const isPrimary = type === 'primary';
    const gradientColors = isPrimary
      ? theme.isDark
        ? ['rgba(255,106,136,0.96)', 'rgba(255,79,216,0.9)']
        : ['rgba(255,255,255,0.92)', 'rgba(255,236,242,0.98)']
      : theme.isDark
      ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
      : ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.72)'];

    return (
      <TouchableOpacity
        key={action.label}
        style={styles.actionButton}
        activeOpacity={0.88}
        onPress={() => {
          action.onPress?.();
          onClose?.();
        }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.actionButtonGradient,
            !isPrimary && styles.actionButtonGradientSecondary,
          ]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              styles.actionButtonText,
              !isPrimary && styles.actionButtonTextSecondary,
            ]}
          >
            {action.label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={{ width: '100%' }} onPress={() => {}}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(6,14,34,0.96)'
                  : 'rgba(255,255,255,0.98)',
                opacity: cardOpacity,
                transform: [{ scale }],
              },
            ]}
          >
            {onClose && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
              >
                <Feather name="x" size={16} color={palette.color} />
              </TouchableOpacity>
            )}
            <View style={[styles.iconWrap, { backgroundColor: palette.tint }]}>
              <Feather
                name={palette.icon as any}
                size={22}
                color={palette.color}
              />
            </View>
            {title ? (
              <Text allowFontScaling={false} style={styles.title}>
                {title}
              </Text>
            ) : null}
            <View style={styles.messageBubble}>
              <Text allowFontScaling={false} style={styles.message}>
                {message}
              </Text>
            </View>
            <View style={styles.actionsRow}>
              {renderAction(secondaryAction, 'secondary')}
              {renderAction(primaryAction, 'primary')}
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const getVariantStyles = (theme: AppTheme, variant: DialogVariant) => {
  switch (variant) {
    case 'success':
      return {
        icon: 'check-circle',
        color: theme.colors.success,
        tint: theme.isDark ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.15)',
      };
    case 'error':
      return {
        icon: 'alert-triangle',
        color: theme.colors.danger,
        tint: theme.isDark
          ? 'rgba(248,113,113,0.25)'
          : 'rgba(248,113,113,0.18)',
      };
    case 'message':
    default:
      return {
        icon: 'info',
        color: theme.colors.primary,
        tint: theme.isDark ? 'rgba(28,126,214,0.25)' : theme.colors.blueSoft,
      };
  }
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 20,
      elevation: 10,
      position: 'relative',
    },
    iconWrap: {
      width: 54,
      height: 54,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 12,
    },
    closeButton: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(15,23,42,0.05)',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    messageBubble: {
      marginTop: 12,
      borderRadius: 16,
      padding: 14,
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.04)'
        : theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    message: {
      color: theme.colors.text,
      textAlign: 'center',
      fontSize: 14,
      lineHeight: 20,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    actionButton: {
      minWidth: 120,
      flexGrow: 1,
      flexBasis: 120,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,106,136,0.18)',
      shadowColor: theme.colors.glow,
      shadowOpacity: theme.isDark ? 0.22 : 0.12,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 18,
      // elevation: 6,
    },
    actionButtonGradient: {
      minHeight: 54,
      // paddingHorizontal: 14,
      // paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
    actionButtonGradientSecondary: {
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonText: {
      color: '#0F172A',
      textAlign: 'center',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '800',
    },
    actionButtonTextSecondary: {
      color: theme.colors.text,
    },
  });

export default AppDialog;
