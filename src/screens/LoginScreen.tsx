import React, {useMemo, useState} from 'react';
import {
 KeyboardAvoidingView,
 Platform,
 ScrollView,
 StyleSheet,
 Text,
 TextInput,
 TouchableOpacity,
 View,
 useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import {moderateScale} from 'react-native-size-matters';
import {ActionButton} from '../components/ui';
import {useAppTheme} from '../context/ThemeContext';
import {AppTheme} from '../theme';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {login} from '../store/authSlice';

const LOGIN_PINK = '#FF1B6B';
const CARD_GRADIENT = ['#3B0A63', '#2B1450', '#6A0DAD'];
const BLOB_A_GRADIENT = ['rgba(255,27,107,0.4)', 'rgba(255,255,255,0.04)'];
const BLOB_B_GRADIENT = ['rgba(69,202,255,0.24)', 'rgba(106,13,173,0.24)'];

export default function LoginScreen({
 onLogin,
}: {
 onLogin?: (email: string, password: string) => Promise<void>;
}) {
 const {width} = useWindowDimensions();
 const [email, setEmail] = useState<string>('');
 const [password, setPassword] = useState<string>('');
 const [error, setError] = useState<string>('');
 const [_remember] = useState<boolean>(true);
 const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);

 const dispatch = useAppDispatch();
 const {theme} = useAppTheme();
 const isLoggingIn = useAppSelector(state => state.auth.isSigningIn);
 const styles = useMemo(() => createStyles(theme), [theme]);
 const isCompactWidth = width < 380;

 const cardWidth = Math.min(460, width - moderateScale(24));

 const handleLogin = async () => {
  if (!email || !password) {
   setError('Please enter email and password');
   return;
  }

  setError('');

  try {
   if (onLogin) {
    await onLogin(email, password);
   } else {
    await dispatch(login({email, password})).unwrap();
   }
  } catch (loginError) {
   if (loginError instanceof Error && loginError.message) {
    setError(loginError.message);
    return;
   }

   if (typeof loginError === 'string' && loginError.trim()) {
    setError(loginError);
    return;
   }

   setError('Login failed. Please try again.');
  }
 };

 return (
  <SafeAreaView style={styles.safe}>
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <View style={styles.backgroundMid} />
   <LinearGradient
    colors={BLOB_A_GRADIENT}
    start={{x: 0, y: 0}}
    end={{x: 1, y: 1}}
    style={styles.backgroundBlobA}
   />
   <LinearGradient
    colors={BLOB_B_GRADIENT}
    start={{x: 0, y: 0}}
    end={{x: 1, y: 1}}
    style={styles.backgroundBlobB}
   />
   <View style={styles.backgroundAura} />
   <View style={styles.backgroundRing} />
   <View style={styles.backgroundSpark} />

   <KeyboardAvoidingView
    style={{flex: 1}}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
    <ScrollView
     keyboardShouldPersistTaps="handled"
     contentContainerStyle={styles.scrollContent}
     showsVerticalScrollIndicator={false}>
     <LinearGradient
      colors={CARD_GRADIENT}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={[styles.cardGradient, {width: cardWidth}]}>
      <View style={styles.cardContent}>
       <View style={styles.heroHeader}>
        <View style={styles.logoPill}>
         <Text allowFontScaling={false} style={styles.logoBolt}>
          ⚡
         </Text>
        </View>
        <View style={styles.heroTextWrap}>
         <Text allowFontScaling={false} style={styles.heroTitle}>
          MaxxStations
         </Text>
        </View>
       </View>

       <View style={styles.bandRow}>
        <View style={styles.bandPillDark}>
         <Text allowFontScaling={false} style={styles.bandTextLight}>
          LIVE TRACKING
         </Text>
        </View>
       </View>

       <Text allowFontScaling={false} style={styles.heading}>
        Sign In
       </Text>
       <Text allowFontScaling={false} style={styles.subheading}>
        Continue to dashboard, logs, attendance and reports.
       </Text>

       <View style={styles.formSection}>
        <Text allowFontScaling={false} style={styles.label}>
         Email
        </Text>
        <TextInput
         allowFontScaling={false}
         value={email}
         onChangeText={setEmail}
         autoCapitalize="none"
         keyboardType="email-address"
         placeholder="user@gmail.com"
         placeholderTextColor={
          theme.isDark ? 'rgba(255,255,255,0.55)' : '#97A0BC'
         }
         style={styles.input}
        />

        <Text allowFontScaling={false} style={styles.label}>
         Password
        </Text>
        <View style={styles.passwordInputWrap}>
         <TextInput
          allowFontScaling={false}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={
           theme.isDark ? 'rgba(255,255,255,0.55)' : '#97A0BC'
          }
          secureTextEntry={!isPasswordVisible}
          style={styles.passwordInput}
         />
         <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsPasswordVisible(prev => !prev)}
          style={styles.passwordToggle}
          accessibilityRole="button"
          accessibilityLabel={
           isPasswordVisible ? 'Hide password' : 'Show password'
          }>
          <Feather
           name={isPasswordVisible ? 'eye' : 'eye-off'}
           size={18}
           color={theme.colors.primary}
          />
         </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
         <TouchableOpacity activeOpacity={0.8}>
          <Text allowFontScaling={false} style={styles.link}>
           Forgot password?
          </Text>
         </TouchableOpacity>
        </View>

        {error ? (
         <Text allowFontScaling={false} style={styles.error}>
          {error}
         </Text>
        ) : null}

        <ActionButton
         style={[styles.submit, isLoggingIn && styles.submitDisabled]}
         onPress={handleLogin}
         disabled={isLoggingIn}
         icon="lock"
         label={isLoggingIn ? 'Signing In...' : 'Sign In Securely'}
         subtitle={
          isCompactWidth ? undefined : 'Continue to your dashboard and reports'
         }
        />
       </View>
      </View>
     </LinearGradient>
    </ScrollView>
   </KeyboardAvoidingView>
  </SafeAreaView>
 );
}

const createStyles = (theme: AppTheme) => {
 const safeBg = theme.colors.background;
 const cardBg = theme.colors.card;
 const formBg = theme.colors.surface;
 const borderColor = theme.colors.border;
 const secondaryText = theme.colors.muted;
 const chipBg = theme.colors.blueSoft;

 return StyleSheet.create({
  safe: {
   flex: 1,
   backgroundColor: safeBg,
  },
  backgroundGradient: {
   ...StyleSheet.absoluteFillObject,
  },
  backgroundMid: {
   position: 'absolute',
   left: 10,
   right: 10,
   top: 20,
   bottom: 20,
   borderRadius: 48,
   backgroundColor: 'rgba(255,255,255,0.04)',
  },
  backgroundBlobA: {
   position: 'absolute',
   width: 220,
   height: 220,
   borderRadius: 110,
   top: 70,
   right: -80,
  },
  backgroundBlobB: {
   position: 'absolute',
   width: 170,
   height: 170,
   borderRadius: 85,
   bottom: 40,
   left: -40,
  },
  backgroundAura: {
   position: 'absolute',
   width: 320,
   height: 320,
   borderRadius: 160,
   backgroundColor: 'rgba(69,202,255,0.1)',
   top: 150,
   right: -140,
  },
  backgroundRing: {
   position: 'absolute',
   width: 260,
   height: 260,
   borderRadius: 130,
   borderWidth: 2,
   borderColor: 'rgba(255,255,255,0.12)',
   top: 90,
   left: -70,
  },
  backgroundSpark: {
   position: 'absolute',
   width: 70,
   height: 70,
   borderRadius: 35,
   backgroundColor: 'rgba(255,255,255,0.12)',
   top: 140,
   right: 40,
  },
  scrollContent: {
   flexGrow: 1,
   justifyContent: 'center',
   alignItems: 'center',
   paddingHorizontal: moderateScale(12),
   paddingVertical: moderateScale(24),
  },
  cardGradient: {
   borderRadius: moderateScale(30),
   padding: 2,
   shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.28,
   shadowRadius: 20,
   elevation: 11,
  },
  cardContent: {
   backgroundColor: cardBg,
   borderRadius: moderateScale(28),
   paddingHorizontal: moderateScale(20),
   paddingVertical: moderateScale(24),
   borderWidth: 1,
   borderColor,
   shadowColor: theme.colors.glowStrong,
   shadowOffset: {width: 0, height: 0},
   // shadowOpacity: 0.16,
   shadowRadius: 16,
   // elevation: 11,
  },
  heroHeader: {
   flexDirection: 'row',
   alignItems: 'center',
   marginBottom: moderateScale(14),
  },
  logoPill: {
   width: moderateScale(54),
   height: moderateScale(54),
   borderRadius: moderateScale(18),
   backgroundColor: 'rgba(255,255,255,0.08)',
   borderWidth: 1,
   borderColor: borderColor,
   alignItems: 'center',
   justifyContent: 'center',
   marginRight: moderateScale(12),
  },
  logoBolt: {
   fontSize: moderateScale(24),
   color: theme.colors.primary,
  },
  heroTextWrap: {
   flex: 1,
  },
  heroTitle: {
   fontFamily: 'Poppins-Bold',
   color: theme.colors.text,
   fontSize: moderateScale(26),
   lineHeight: moderateScale(30),
  },
  heroSubtitle: {
   marginTop: 2,
   fontFamily: 'Montserrat-Medium',
   color: secondaryText,
   fontSize: 13,
  },
  bandRow: {
   flexDirection: 'row',
   marginBottom: moderateScale(16),
  },
  bandPillDark: {
   backgroundColor: LOGIN_PINK,
   borderRadius: 999,
   paddingHorizontal: moderateScale(12),
   paddingVertical: moderateScale(6),
   marginRight: moderateScale(8),
   shadowColor: LOGIN_PINK,
   shadowOffset: {width: 0, height: 5},
   shadowOpacity: 0.25,
   shadowRadius: 12,
   elevation: 3,
  },
  bandPillLight: {
   backgroundColor: chipBg,
   borderRadius: 999,
   paddingHorizontal: 11,
   paddingVertical: 6,
  },
  bandTextLight: {
   fontFamily: 'Montserrat-Bold',
   color: '#FFFFFF',
   fontSize: moderateScale(10),
   letterSpacing: 0.6,
  },
  bandTextDark: {
   fontFamily: 'Montserrat-Bold',
   color: theme.colors.primary,
   fontSize: 10,
  },
  heading: {
   fontFamily: 'Poppins-Bold',
   color: theme.colors.text,
   fontSize: moderateScale(30),
   lineHeight: moderateScale(34),
   marginBottom: moderateScale(6),
  },
  subheading: {
   fontFamily: 'Montserrat-Regular',
   color: secondaryText,
   fontSize: moderateScale(13),
   lineHeight: moderateScale(19),
   marginBottom: moderateScale(22),
  },
  formSection: {
   backgroundColor: formBg,
   borderWidth: 1,
   borderColor,
   borderRadius: moderateScale(22),
   padding: moderateScale(16),
  },
  label: {
   fontFamily: 'Montserrat-Bold',
   color: theme.colors.text,
   fontSize: moderateScale(12),
   marginBottom: moderateScale(7),
  },
  input: {
   height: moderateScale(48),
   borderWidth: 1,
   borderColor,
   borderRadius: moderateScale(16),
   backgroundColor: 'rgba(255,255,255,0.02)',
   color: theme.colors.text,
   alignItems: 'center',
   paddingHorizontal: moderateScale(13),
   marginBottom: moderateScale(12),
   fontFamily: 'Montserrat-Medium',
   fontSize: moderateScale(14),
  },
  passwordInputWrap: {
   height: moderateScale(48),
   borderWidth: 1,
   borderColor,
   borderRadius: moderateScale(16),
   backgroundColor: 'rgba(255,255,255,0.02)',
   flexDirection: 'row',
   alignItems: 'center',
   marginBottom: moderateScale(12),
   paddingRight: moderateScale(12),
  },
  passwordInput: {
   flex: 1,
   color: theme.colors.text,
   paddingHorizontal: moderateScale(13),
   fontFamily: 'Montserrat-Medium',
   fontSize: moderateScale(14),
  },
  passwordToggle: {
   paddingVertical: 4,
   paddingLeft: 8,
  },
  metaRow: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   marginBottom: moderateScale(12),
  },
  rememberWrap: {
   flexDirection: 'row',
   alignItems: 'center',
  },
  check: {
   width: 18,
   height: 18,
   borderRadius: 5,
   borderWidth: 1,
   borderColor,
   backgroundColor: cardBg,
   justifyContent: 'center',
   alignItems: 'center',
   marginRight: 7,
  },
  checkActive: {
   backgroundColor: theme.colors.primary,
   borderColor: theme.colors.primary,
  },
  checkMark: {
   color: '#FFFFFF',
   fontSize: 11,
   fontFamily: 'Montserrat-Bold',
   lineHeight: 12,
  },
  metaText: {
   fontFamily: 'Montserrat-Medium',
   color: secondaryText,
   fontSize: 12,
  },
  link: {
   fontFamily: 'Montserrat-Bold',
   color: theme.colors.primary,
   fontSize: moderateScale(12),
  },
  error: {
   fontFamily: 'Montserrat-Medium',
   fontSize: moderateScale(12),
   color: theme.colors.error,
   marginBottom: moderateScale(10),
  },
  actionButtons: {
   flexDirection: 'row',
   gap: 10,
   marginTop: 12,
  },
  flexButton: {
   flex: 1,
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   gap: 6,
   height: 44,
   borderRadius: 10,
  },
  primaryButton: {
   backgroundColor: LOGIN_PINK,
   shadowColor: LOGIN_PINK,
   shadowOffset: {width: 0, height: 8},
   shadowOpacity: 0.3,
   shadowRadius: 14,
   elevation: 6,
  },
  secondaryButton: {
   backgroundColor: cardBg,
   borderWidth: 1,
   borderColor,
  },
  secondaryText: {
   color: secondaryText,
   fontWeight: '600',
  },
  submit: {
   width: '100%',
   marginTop: moderateScale(8),
  },
  submitDisabled: {
   opacity: 0.6,
  },
 });
};
