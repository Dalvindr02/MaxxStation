import React, {useMemo} from 'react';
import {Modal, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import DateTimePicker, {
 DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {useAppTheme} from '../context/ThemeContext';

type Props = {
 visible: boolean;
 title: string;
 /** When false, the sheet title is hidden (use when the form already shows the field label). */
 showTitle?: boolean;
 value: Date;
 mode: 'date' | 'time' | 'datetime';
 onChange: (event: DateTimePickerEvent, date?: Date) => void;
 onCancel: () => void;
 onConfirm: () => void;
 is24Hour?: boolean;
};

export function ThemedIOSDateTimePicker({
 visible,
 title,
 showTitle = true,
 value,
 mode,
 onChange,
 onCancel,
 onConfirm,
 is24Hour = false,
}: Props) {
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);

 return (
  <Modal visible={visible} transparent animationType="fade">
   <View style={styles.overlay}>
    <TouchableOpacity
     activeOpacity={1}
     style={StyleSheet.absoluteFill}
     onPress={onCancel}
    />
    <View style={styles.sheet}>
     {showTitle ? (
      <Text allowFontScaling={false} style={styles.title}>
       {title}
      </Text>
     ) : null}
     <View style={styles.pickerFrame}>
      <DateTimePicker
       value={value}
       mode={mode}
       display="spinner"
       is24Hour={is24Hour}
       onChange={onChange}
       themeVariant="dark"
       textColor="#F8EEFF"
       accentColor={theme.colors.primary}
       style={styles.picker}
      />
     </View>
     <View style={styles.actions}>
      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
       <Text allowFontScaling={false} style={styles.cancelText}>
        Cancel
       </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
       <Text allowFontScaling={false} style={styles.confirmText}>
        Confirm
       </Text>
      </TouchableOpacity>
     </View>
    </View>
   </View>
  </Modal>
 );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>['theme']) =>
 StyleSheet.create({
  overlay: {
   flex: 1,
   backgroundColor: 'rgba(6, 3, 14, 0.72)',
   justifyContent: 'center',
   alignItems: 'center',
   paddingHorizontal: 20,
  },
  sheet: {
   width: '100%',
   maxWidth: 420,
   borderRadius: 20,
   padding: 16,
   backgroundColor: '#1B1030',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.1)',
   shadowColor: '#000000',
   shadowOffset: {width: 0, height: 16},
   shadowOpacity: 0.35,
   shadowRadius: 24,
   elevation: 20,
  },
  title: {
   fontSize: 15,
   fontWeight: '700',
   color: '#F8EEFF',
   marginBottom: 12,
  },
  pickerFrame: {
   borderRadius: 16,
   overflow: 'hidden',
   backgroundColor: '#24153E',
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.08)',
   marginBottom: 12,
  },
  picker: {
   alignSelf: 'stretch',
   height: 200,
   backgroundColor: '#24153E',
  },
  actions: {
   flexDirection: 'row',
   justifyContent: 'flex-end',
   gap: 8,
  },
  cancelButton: {
   height: 38,
   paddingHorizontal: 14,
   borderRadius: 10,
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.14)',
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cancelText: {
   fontSize: 13,
   fontWeight: '600',
   color: theme.colors.muted,
  },
  confirmButton: {
   height: 38,
   paddingHorizontal: 14,
   borderRadius: 10,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: theme.colors.primary,
  },
  confirmText: {
   fontSize: 13,
   fontWeight: '700',
   color: '#FFFFFF',
  },
 });
