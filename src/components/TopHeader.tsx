import React, {useMemo, useRef, useState} from 'react';
import {
 Animated,
 Easing,
 Modal,
 Pressable,
 StyleProp,
 StyleSheet,
 Text,
 TouchableOpacity,
 View,
 ViewStyle,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {useAppTheme} from '../context/ThemeContext';
import {AppTheme} from '../theme';
import {useAppSelector} from '../store/hooks';

type TopHeaderProps = {
 title: string;
 subtitle?: string;
 rightType?: 'actions' | 'bell' | 'avatar' | 'none';
 onRightPress?: () => void;
 onBackPress?: () => void;
 forceShowBack?: boolean;
 hideBack?: boolean;
 style?: StyleProp<ViewStyle>;
};

export const TopHeader = ({
 title,
 subtitle,
 rightType = 'actions',
 onRightPress,
 onBackPress,
 forceShowBack,
 hideBack,
 style,
}: TopHeaderProps) => {
 const navigation = useNavigation<any>();
 const {theme} = useAppTheme();
 const auth = useAppSelector(state => state.auth);
 const styles = useMemo(() => createStyles(theme), [theme]);
 const showBack = !hideBack && (forceShowBack ?? navigation.canGoBack());
 const profile = useMemo(
  () => buildHeaderProfile(auth.loginData, auth.user),
  [auth.loginData, auth.user],
 );
 const [profileModalVisible, setProfileModalVisible] = useState(false);
 const profileAnim = useRef(new Animated.Value(0)).current;

 const openProfileModal = () => {
  setProfileModalVisible(true);
  profileAnim.stopAnimation();
  profileAnim.setValue(0);
  Animated.spring(profileAnim, {
   toValue: 1,
   damping: 17,
   stiffness: 180,
   mass: 0.9,
   useNativeDriver: true,
  }).start();
 };

 const closeProfileModal = (onClosed?: () => void) => {
  profileAnim.stopAnimation();
  Animated.timing(profileAnim, {
   toValue: 0,
   duration: 180,
   easing: Easing.in(Easing.cubic),
   useNativeDriver: true,
  }).start(({finished}) => {
   if (finished) {
    setProfileModalVisible(false);
    onClosed?.();
   }
  });
 };

 const handleBack = () => {
  if (onBackPress) {
   onBackPress();
   return;
  }

  if (navigation.canGoBack()) {
   navigation.goBack();
  }
 };

 const handleRightPress = () => {
  if (onRightPress) {
   onRightPress();
   return;
  }

  if (rightType === 'avatar' || rightType === 'actions') {
   openProfileModal();
  }
 };

 const handleViewProfile = () => {
  closeProfileModal(() => {
   if (navigation.getState()?.routeNames?.includes('Profile')) {
    navigation.navigate('Profile');
    return;
   }
   navigation.navigate('Main', {screen: 'Profile'});
  });
 };

 const backdropAnimatedStyle = {
  opacity: profileAnim.interpolate({
   inputRange: [0, 1],
   outputRange: [0, 1],
  }),
 };

 const cardAnimatedStyle = {
  opacity: profileAnim,
  transform: [
   {
    translateY: profileAnim.interpolate({
     inputRange: [0, 0.7, 1],
     outputRange: [-20, 4, 0],
    }),
   },
   {
    scale: profileAnim.interpolate({
     inputRange: [0, 0.7, 1],
     outputRange: [0.92, 1.02, 1],
    }),
   },
   {
    rotate: profileAnim.interpolate({
     inputRange: [0, 1],
     outputRange: ['-3deg', '0deg'],
    }),
   },
  ],
 };

 const contentAnimatedStyle = {
  opacity: profileAnim.interpolate({
   inputRange: [0, 0.35, 1],
   outputRange: [0, 0, 1],
  }),
  transform: [
   {
    translateY: profileAnim.interpolate({
     inputRange: [0, 0.45, 1],
     outputRange: [8, 8, 0],
    }),
   },
  ],
 };

 const glowAnimatedStyle = {
  opacity: profileAnim.interpolate({
   inputRange: [0, 1],
   outputRange: [0, 1],
  }),
  transform: [
   {
    scale: profileAnim.interpolate({
     inputRange: [0, 1],
     outputRange: [0.85, 1],
    }),
   },
  ],
 };

 return (
  <>
   <View style={[styles.wrapper, style]}>
    <View style={styles.card}>
     <LinearGradient
      colors={theme.gradients.card}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.cardGradient}
     />
     <View style={styles.shapeLeft} />
     <View style={styles.shapeRight} />
     <View style={styles.sideSlot}>
      {showBack ? (
       <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
        <Feather
         name="chevron-left"
         size={20}
         color={theme.isDark ? '#FFFFFF' : theme.colors.text}
        />
       </TouchableOpacity>
      ) : (
       <View style={styles.slotPlaceholder} />
      )}
     </View>

     <View pointerEvents="none" style={styles.titleWrap}>
      <View style={styles.titleChip}>
       <View style={styles.titleDot} />
       <Text numberOfLines={1} style={styles.title}>
        {title}
       </Text>
      </View>
     </View>

     <View style={[styles.sideSlot, styles.sideRight]}>
      {rightType === 'none' ? <View style={styles.slotPlaceholder} /> : null}
      {rightType === 'bell' || rightType === 'actions' ? (
       <TouchableOpacity style={styles.iconButton} onPress={onRightPress}>
        <Feather
         name="bell"
         size={18}
         color={theme.isDark ? '#FFFFFF' : theme.colors.text}
        />
       </TouchableOpacity>
      ) : null}
      {rightType === 'avatar' || rightType === 'actions' ? (
       <TouchableOpacity style={styles.avatarButton} onPress={handleRightPress}>
        <View style={styles.avatarInner}>
         <Feather name="user" size={15} color="#FFFFFF" />
        </View>
        <View style={styles.avatarBadge} />
       </TouchableOpacity>
      ) : null}
     </View>
    </View>

    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
   </View>

   <Modal
    visible={profileModalVisible}
    transparent
    animationType="none"
    statusBarTranslucent
    onRequestClose={() => closeProfileModal()}>
    <View style={styles.modalRoot}>
     <Pressable
      style={StyleSheet.absoluteFill}
      onPress={() => closeProfileModal()}>
      <Animated.View style={[styles.modalBackdrop, backdropAnimatedStyle]} />
     </Pressable>
     <Animated.View style={[styles.modalCardWrap, cardAnimatedStyle]}>
      <Pressable style={styles.modalCard} onPress={() => {}}>
       <LinearGradient
        colors={theme.gradients.accent}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.modalHero}
       />
       <Animated.View style={[styles.modalTopGlow, glowAnimatedStyle]} />
       <Animated.View style={[styles.modalContentWrap, contentAnimatedStyle]}>
        <View style={styles.modalHeaderRow}>
         <View style={styles.modalProfileRow}>
          <View style={styles.modalAvatar}>
           <View style={styles.modalAvatarInner}>
            <Feather name="user" size={20} color="#FFFFFF" />
           </View>
           <View style={styles.modalAvatarBadge} />
          </View>
          <View style={styles.modalIdentity}>
           <Text allowFontScaling={false} style={styles.modalEyebrow}>
            Signed in
           </Text>
           <Text allowFontScaling={false} style={styles.modalName}>
            {profile.fullName}
           </Text>
           <Text allowFontScaling={false} style={styles.modalMeta}>
            {profile.role}
           </Text>
          </View>
         </View>
         <TouchableOpacity
          style={styles.modalDismissIcon}
          onPress={() => closeProfileModal()}
          activeOpacity={0.85}>
          <Feather name="x" size={16} color={theme.colors.text} />
         </TouchableOpacity>
        </View>
        <View style={styles.modalMetaRow}>
         <View style={styles.metaChip}>
          <Feather name="hash" size={12} color={theme.colors.primary} />
          <Text allowFontScaling={false} style={styles.metaChipText}>
           ID {profile.employeeId}
          </Text>
         </View>
         <View style={styles.metaChip}>
          <Feather name="phone" size={12} color={theme.colors.primary} />
          <Text allowFontScaling={false} style={styles.metaChipText}>
           {profile.phone}
          </Text>
         </View>
        </View>
        <View style={styles.infoCard}>
         <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
           <Feather name="briefcase" size={14} color={theme.colors.primary} />
          </View>
          <View style={styles.infoCopy}>
           <Text allowFontScaling={false} style={styles.infoLabel}>
            Agency
           </Text>
           <Text allowFontScaling={false} style={styles.infoValue}>
            {profile.agency}
           </Text>
          </View>
         </View>
         <View style={styles.infoDivider} />
         <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
           <Feather name="zap" size={14} color={theme.colors.primary} />
          </View>
          <View style={styles.infoCopy}>
           <Text allowFontScaling={false} style={styles.infoLabel}>
            Email
           </Text>
           <Text allowFontScaling={false} style={styles.infoValue}>
            {profile.email}
           </Text>
          </View>
         </View>
        </View>
        <TouchableOpacity
         style={styles.modalPrimaryBtn}
         onPress={handleViewProfile}
         activeOpacity={0.9}>
         <Feather name="user-check" size={15} color="#FFFFFF" />
         <Text allowFontScaling={false} style={styles.modalPrimaryText}>
          View Profile
         </Text>
         <Feather name="arrow-up-right" size={14} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
         style={styles.modalSecondaryBtn}
         onPress={() => closeProfileModal()}
         activeOpacity={0.85}>
         <Text allowFontScaling={false} style={styles.modalSecondaryText}>
          Dismiss
         </Text>
        </TouchableOpacity>
       </Animated.View>
      </Pressable>
     </Animated.View>
    </View>
   </Modal>
  </>
 );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
 Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const findNestedValue = (payload: unknown, keys: string[]): unknown => {
 if (!isRecord(payload)) {
  return undefined;
 }

 for (const key of keys) {
  if (key in payload) {
   return payload[key];
  }
 }

 for (const value of Object.values(payload)) {
  if (isRecord(value)) {
   const nested = findNestedValue(value, keys);
   if (nested !== undefined) {
    return nested;
   }
  }
 }

 return undefined;
};

const getStringValue = (payload: unknown, keys: string[]): string | null => {
 const value = findNestedValue(payload, keys);

 if (typeof value === 'string' && value.trim()) {
  return value.trim();
 }

 if (typeof value === 'number' && Number.isFinite(value)) {
  return String(value);
 }

 return null;
};

const buildHeaderProfile = (
 loginData: Record<string, unknown> | null,
 user: Record<string, unknown> | null,
) => {
 const source = user ?? loginData ?? {};
 const agency = findNestedValue(source, ['agency']);

 return {
  agency:
   getStringValue(agency, ['name']) ??
   getStringValue(source, ['agency_name', 'agencyName']) ??
   'MaxxStation',
  email: getStringValue(source, ['email']) ?? 'No email',
  employeeId:
   getStringValue(source, ['emp_id', 'employee_id', 'employeeId', 'id']) ??
   'N/A',
  fullName:
   getStringValue(source, [
    'userName',
    'user_name',
    'name',
    'full_name',
    'fullName',
   ]) ?? 'User',
  phone: getStringValue(source, ['phone']) ?? 'No phone',
  role:
   getStringValue(source, ['role', 'designation', 'department']) ??
   'Team Member',
 };
};

const createStyles = (theme: AppTheme) =>
 StyleSheet.create({
  wrapper: {
   marginBottom: 14,
  },
  card: {
   height: 70,
   borderRadius: 24,
   paddingHorizontal: 12,
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   backgroundColor: theme.colors.surface,
   borderWidth: 1,
   borderColor: theme.colors.border,
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: theme.isDark ? 0.4 : 0.24,
   shadowRadius: 18,
   elevation: 6,
   position: 'relative',
   overflow: 'hidden',
  },
  cardGradient: {
   ...StyleSheet.absoluteFillObject,
   opacity: 0.95,
  },
  shapeLeft: {
   position: 'absolute',
   left: -40,
   top: -28,
   width: 130,
   height: 130,
   borderRadius: 65,
   backgroundColor: 'rgba(255,77,215,0.22)',
  },
  shapeRight: {
   position: 'absolute',
   right: -28,
   top: -42,
   width: 106,
   height: 106,
   borderRadius: 53,
   backgroundColor: 'rgba(95,203,255,0.16)',
  },
  titleWrap: {
   position: 'absolute',
   left: 64,
   right: 64,
   alignItems: 'center',
   justifyContent: 'center',
   height: 70,
  },
  titleChip: {
   borderRadius: 16,
   paddingHorizontal: 13,
   paddingVertical: 7,
   backgroundColor: 'rgba(92,48,182,0.58)',
   borderWidth: 1,
   borderColor: 'rgba(255,120,246,0.3)',
   flexDirection: 'row',
   alignItems: 'center',
   gap: 6,
  },
  titleDot: {
   width: 8,
   height: 8,
   borderRadius: 4,
   backgroundColor: theme.colors.primary,
  },
  sideSlot: {
   width: 48,
   alignItems: 'center',
   justifyContent: 'center',
  },
  sideRight: {
   alignItems: 'flex-end',
   flexDirection: 'row',
   width: 96,
   justifyContent: 'flex-end',
   gap: 8,
  },
  iconButton: {
   width: 38,
   height: 38,
   borderRadius: 14,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(255,255,255,0.08)',
   borderWidth: 1,
   borderColor: 'rgba(255,120,246,0.22)',
  },
  avatarButton: {
   width: 38,
   height: 38,
   borderRadius: 14,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: theme.colors.primary,
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.35)',
   position: 'relative',
   shadowColor: theme.colors.secondary,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.4,
   shadowRadius: 16,
   elevation: 6,
  },
  avatarInner: {
   width: 30,
   height: 30,
   borderRadius: 11,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(255,255,255,0.16)',
  },
  avatarBadge: {
   position: 'absolute',
   right: 2,
   bottom: 2,
   width: 8,
   height: 8,
   borderRadius: 4,
   backgroundColor: '#34D399',
   borderWidth: 1,
   borderColor: '#FFFFFF',
  },
  slotPlaceholder: {
   width: 38,
   height: 38,
  },
  title: {
   textAlign: 'center',
   fontSize: 15,
   fontWeight: '800',
   color: '#FFFFFF',
   letterSpacing: 0.3,
   paddingHorizontal: 2,
   textTransform: 'uppercase',
  },
  subtitle: {
   marginTop: 5,
   color: theme.colors.muted,
   fontSize: 12,
   textAlign: 'center',
  },
  modalRoot: {
   flex: 1,
  },
  modalBackdrop: {
   flex: 1,
   backgroundColor: theme.colors.overlay,
  },
  modalCardWrap: {
   position: 'absolute',
   top: 84,
   right: 16,
   width: 286,
   maxWidth: '88%',
  },
  modalCard: {
   backgroundColor: 'rgba(14,6,34,0.98)',
   borderRadius: 24,
   paddingHorizontal: 16,
   paddingTop: 16,
   paddingBottom: 14,
   borderWidth: 1,
   borderColor: theme.colors.border,
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.4,
   shadowRadius: 24,
   elevation: 12,
   overflow: 'hidden',
  },
  modalContentWrap: {
   gap: 0,
  },
  modalHero: {
   position: 'absolute',
   left: -30,
   right: -30,
   top: -40,
   height: 130,
   borderRadius: 999,
   opacity: 0.3,
  },
  modalTopGlow: {
   position: 'absolute',
   top: 16,
   right: 18,
   width: 88,
   height: 88,
   borderRadius: 44,
   backgroundColor: 'rgba(95,203,255,0.14)',
  },
  modalHeaderRow: {
   flexDirection: 'row',
   alignItems: 'flex-start',
   justifyContent: 'space-between',
   marginBottom: 14,
  },
  modalProfileRow: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 10,
   flex: 1,
  },
  modalAvatar: {
   width: 58,
   height: 58,
   borderRadius: 29,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: theme.colors.primary,
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.22)',
   shadowColor: theme.colors.primary,
   shadowOffset: {width: 0, height: 10},
   shadowOpacity: 0.28,
   shadowRadius: 18,
   elevation: 6,
   position: 'relative',
  },
  modalAvatarInner: {
   width: 42,
   height: 42,
   borderRadius: 21,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(255,255,255,0.16)',
  },
  modalAvatarBadge: {
   position: 'absolute',
   right: 4,
   bottom: 5,
   width: 11,
   height: 11,
   borderRadius: 6,
   backgroundColor: '#34D399',
   borderWidth: 2,
   borderColor: theme.isDark ? '#081127' : '#FFFFFF',
  },
  modalIdentity: {
   flex: 1,
   paddingRight: 8,
  },
  modalEyebrow: {
   color: theme.colors.primary,
   fontWeight: '700',
   fontSize: 11,
   letterSpacing: 0.5,
   textTransform: 'uppercase',
   marginBottom: 3,
  },
  modalDismissIcon: {
   width: 32,
   height: 32,
   borderRadius: 12,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(255,255,255,0.06)',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.08)',
  },
  modalName: {
   color: theme.colors.text,
   fontWeight: '800',
   fontSize: 17,
  },
  modalMeta: {
   color: theme.colors.muted,
   fontWeight: '500',
   fontSize: 13,
   marginTop: 2,
  },
  modalMetaRow: {
   flexDirection: 'row',
   gap: 8,
   marginBottom: 14,
  },
  metaChip: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 4,
   borderRadius: 999,
   paddingHorizontal: 10,
   paddingVertical: 6,
   backgroundColor: 'rgba(255,255,255,0.07)',
   borderWidth: 1,
   borderColor: theme.colors.border,
  },
  metaChipText: {
   color: theme.colors.text,
   fontSize: 11,
   fontWeight: '600',
  },
  infoCard: {
   borderRadius: 18,
   padding: 12,
   marginBottom: 14,
   backgroundColor: 'rgba(255,255,255,0.04)',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.08)',
   gap: 10,
  },
  infoRow: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 10,
  },
  infoIcon: {
   width: 32,
   height: 32,
   borderRadius: 12,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(115,103,255,0.18)',
  },
  infoCopy: {
   flex: 1,
  },
  infoLabel: {
   fontSize: 11,
   fontWeight: '700',
   color: theme.colors.muted,
   marginBottom: 2,
   textTransform: 'uppercase',
   letterSpacing: 0.4,
  },
  infoValue: {
   fontSize: 13,
   fontWeight: '600',
   color: theme.colors.text,
  },
  infoDivider: {
   height: 1,
   backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalPrimaryBtn: {
   backgroundColor: theme.colors.primary,
   borderRadius: 14,
   minHeight: 44,
   alignItems: 'center',
   justifyContent: 'center',
   marginBottom: 8,
   flexDirection: 'row',
   gap: 8,
   shadowColor: theme.colors.primary,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.35,
   shadowRadius: 18,
   elevation: 4,
  },
  modalPrimaryText: {
   color: '#FFFFFF',
   fontWeight: '700',
   fontSize: 13,
  },
  modalSecondaryBtn: {
   borderRadius: 14,
   minHeight: 40,
   alignItems: 'center',
   justifyContent: 'center',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.08)',
   backgroundColor: 'rgba(255,255,255,0.03)',
  },
  modalSecondaryText: {
   color: theme.colors.text,
   fontWeight: '600',
   fontSize: 13,
  },
 });
