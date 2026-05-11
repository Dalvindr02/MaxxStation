import React, {useMemo} from 'react';
import {
 StyleProp,
 StyleSheet,
 Text,
 TouchableOpacity,
 View,
 ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import {useAppTheme} from '../context/ThemeContext';
import {AppTheme} from '../theme';
import {moderateScale} from 'react-native-size-matters';

export type NotificationVariant = 'danger' | 'warning' | 'info' | 'success';

export type NotificationAction = {
 label: string;
 onPress?: () => void;
};

export type NotificationBannerProps = {
 title: string;
 description: string;
 icon?: string;
 variant?: NotificationVariant;
 actions?: NotificationAction[];
 style?: StyleProp<ViewStyle>;
};

export const NotificationBanner = ({
 title,
 description,
 icon,
 variant = 'info',
 actions = [],
 style,
}: NotificationBannerProps) => {
 const {theme} = useAppTheme();
 const palette = useMemo(() => buildPalette(theme, variant), [theme, variant]);
 const styles = useMemo(() => createStyles(theme), [theme]);

 return (
  <LinearGradient
   colors={palette.gradient}
   start={{x: 0, y: 0}}
   end={{x: 1, y: 1}}
   style={[styles.container, style, {borderColor: palette.border}]}>
   <View style={[styles.iconWrap, {backgroundColor: palette.iconBackground}]}>
    <Feather
     name={(icon ?? palette.icon) as any}
     size={16}
     color={palette.iconColor}
    />
   </View>

   <View style={styles.content}>
    <Text allowFontScaling={false} style={[styles.title, {marginTop: 4}]}>
     {title}
    </Text>
    <Text allowFontScaling={false} style={styles.description}>
     {description}
    </Text>
    {actions.length ? (
     <View style={styles.actionsRow}>
      {actions.map(action => (
       <TouchableOpacity
        key={action.label}
        style={[
         styles.actionButton,
         {backgroundColor: palette.actionBackground},
        ]}
        onPress={action.onPress}
        activeOpacity={0.9}>
        <Text
         allowFontScaling={false}
         style={[styles.actionLabel, {color: palette.actionText}]}>
         {action.label}
        </Text>
       </TouchableOpacity>
      ))}
     </View>
    ) : null}
   </View>
  </LinearGradient>
 );
};

const buildPalette = (theme: AppTheme, variant: NotificationVariant) => {
 const shared = {
  iconColor: theme.isDark ? '#F8FAFC' : '#0F172A',
  actionText: theme.isDark ? '#0F172A' : '#0F172A',
 } as const;

 switch (variant) {
  case 'danger':
   return {
    ...shared,
    icon: 'alert-triangle',
    gradient: theme.isDark
     ? ['rgba(69,10,10,0.9)', 'rgba(127,29,29,0.92)']
     : ['#FFF1F2', '#FEE2E2'],
    border: theme.isDark ? 'rgba(248,113,113,0.26)' : 'rgba(248,113,113,0.5)',
    iconBackground: theme.isDark
     ? 'rgba(248,113,113,0.2)'
     : 'rgba(248,113,113,0.28)',
    actionBackground: '#FFFFFF',
   };
  case 'warning':
   return {
    ...shared,
    icon: 'alert-circle',
    gradient: theme.isDark
     ? ['rgba(120,53,15,0.85)', 'rgba(133,77,14,0.92)']
     : ['#FEF3C7', '#FDE68A'],
    border: theme.isDark ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.45)',
    iconBackground: theme.isDark
     ? 'rgba(251,191,36,0.16)'
     : 'rgba(251,191,36,0.35)',
    actionBackground: '#FFFFFF',
   };
  case 'success':
   return {
    ...shared,
    icon: 'check-circle',
    gradient: theme.isDark
     ? ['rgba(6,95,70,0.85)', 'rgba(5,122,85,0.92)']
     : ['#DCFCE7', '#BBF7D0'],
    border: theme.isDark ? 'rgba(16,185,129,0.24)' : 'rgba(16,185,129,0.45)',
    iconBackground: theme.isDark
     ? 'rgba(16,185,129,0.2)'
     : 'rgba(16,185,129,0.35)',
    actionBackground: theme.isDark ? '#CCFBF1' : '#FFFFFF',
   };
  case 'info':
  default:
   return {
    ...shared,
    icon: 'info',
    gradient: theme.isDark
     ? ['rgba(30,64,175,0.85)', 'rgba(17,94,89,0.85)']
     : ['#E0F2FE', '#E9D5FF'],
    border: theme.isDark ? 'rgba(147,197,253,0.24)' : 'rgba(147,197,253,0.45)',
    iconBackground: theme.isDark
     ? 'rgba(59,130,246,0.25)'
     : 'rgba(59,130,246,0.4)',
    actionBackground: theme.isDark ? '#BAE6FD' : '#FFFFFF',
   };
 }
};

const createStyles = (theme: AppTheme) =>
 StyleSheet.create({
  container: {
   borderRadius: 18,
   borderWidth: 1,
   // padding: 16,
   minHeight: moderateScale(110),
   flexDirection: 'row',
   gap: 12,
   shadowColor: theme.colors.shadow,
   shadowOffset: {width: 0, height: 10},
   shadowOpacity: theme.isDark ? 0.45 : 0.18,
   shadowRadius: 20,
   elevation: 6,
  },
  iconWrap: {
   width: 40,
   height: 40,
   margin: 12,
   borderRadius: 12,
   alignItems: 'center',
   justifyContent: 'center',
  },
  content: {
   flex: 1,
  },
  title: {
   fontSize: 14,
   fontWeight: '700',
   color: theme.colors.text,
  },
  description: {
   marginTop: 4,
   color: theme.colors.text,
   fontSize: 12,
   lineHeight: 18,
  },
  actionsRow: {
   flexDirection: 'row',
   flexWrap: 'wrap',
   gap: 8,
   marginTop: 12,
  },
  actionButton: {
   borderRadius: 999,
   paddingHorizontal: 12,
   paddingVertical: 6,
  },
  actionLabel: {
   fontWeight: '700',
   fontSize: 10,
   letterSpacing: 0.1,
  },
 });
