import React, {useEffect, useMemo, useState} from 'react';
import {
 Image,
 Platform,
 ScrollView,
 StyleSheet,
 Text,
 TextInput,
 TouchableOpacity,
 View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import DateTimePicker, {
 DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {SelectList} from 'react-native-dropdown-select-list';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {ActionButton, AnimatedCard} from '../components/ui';
import {ThemedIOSDateTimePicker} from '../components/ThemedIOSDateTimePicker';
import {TopHeader} from '../components/TopHeader';
import {useAppTheme} from '../context/ThemeContext';
import {AppTheme} from '../theme';
import {
 createExpenseRequest,
 deleteExpenseRequest,
 fetchExpenseCategories,
 fetchExpenseList,
 updateExpenseRequest,
} from '../services/expenseService';
import LinearGradient from 'react-native-linear-gradient';
import {useDialog} from '../context/DialogContext';
import {useAppSelector} from '../store/hooks';

const FALLBACK_CATEGORIES = [
 {
  key: '1',
  value: 'Meals & Entertainment',
  icon: 'coffee',
 },
 {key: '2', value: 'Travel', icon: 'map-pin'},
 {key: '3', value: 'Office Supplies', icon: 'briefcase'},
];

const formatDate = (date: Date) => {
 return date.toLocaleDateString([], {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
 });
};

const formatTime = (date: Date) => {
 const hh = String(date.getHours()).padStart(2, '0');
 const mm = String(date.getMinutes()).padStart(2, '0');
 return `${hh}:${mm}`;
};

const formatApiDate = (date: Date) => {
 const year = date.getFullYear();
 const month = String(date.getMonth() + 1).padStart(2, '0');
 const day = String(date.getDate()).padStart(2, '0');
 return `${year}-${month}-${day}`;
};

const parseDateFromValue = (value?: string) => {
 if (!value) {
  return new Date();
 }
 const direct = new Date(value);
 if (!Number.isNaN(direct.getTime())) {
  return direct;
 }
 const normalized = Date.parse(value);
 if (!Number.isNaN(normalized)) {
  return new Date(normalized);
 }
 return new Date();
};

export type ExpenseEntry = {
 id: string | number;
 amount: string;
 category: string;
 category_name?: string;
 date: string;
 time?: string;
 notes: string;
 hasReceipt?: boolean;
 receipt?: string;
 status?: string;
 created_at?: string;
};

export const ExpensesScreen = () => {
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const {showDialog} = useDialog();
 const navigation = useNavigation<any>();
 const route = useRoute<any>();
 const [amount, setAmount] = useState('45.00');
 const [category, setCategory] = useState('');
 const [expenseDate, setExpenseDate] = useState(new Date());
 const [expenseTime, setExpenseTime] = useState(new Date());
 const [notes, setNotes] = useState('');
 const [receiptUri, setReceiptUri] = useState<string | null>(null);
 const [pickerVisible, setPickerVisible] = useState(false);
 const [categoryOptions, setCategoryOptions] = useState(FALLBACK_CATEGORIES);
 const [isLoadingCategories, setIsLoadingCategories] = useState(true);
 const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
 const [pickerDate, setPickerDate] = useState(new Date());
 const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
 const [currentPage, setCurrentPage] = useState(1);
 const [hasMorePages, setHasMorePages] = useState(false);
 const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(
  null,
 );
 const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
 const authToken = useAppSelector(state => state.auth.token);

 useEffect(() => {
  const loadCategories = async () => {
   try {
    setIsLoadingCategories(true);
    const res = await fetchExpenseCategories(authToken);

    // Handle varying API responses gracefully
    const list = Array.isArray(res?.data)
     ? res.data
     : Array.isArray(res)
     ? res
     : [];
    if (list.length > 0) {
     const mapped = list.map((item: any) => ({
      key: String(item.id || item.category_id || Math.random()),
      value: String(item.name || item.category_name || item.title || 'Unknown'),
      icon: 'tag',
     }));
     setCategoryOptions(mapped);
     if (mapped[0]) setCategory(mapped[0].key);
    }
   } catch (err) {
    setCategoryOptions(FALLBACK_CATEGORIES);
    setCategory(FALLBACK_CATEGORIES[0].key);
   } finally {
    setIsLoadingCategories(false);
   }
  };

  const loadExpenses = async (page = 1) => {
   try {
    setIsLoadingExpenses(true);
    const res = await fetchExpenseList(authToken, page);
    if (res?.data?.data) {
     if (page === 1) {
      setExpenses(res.data.data);
     } else {
      setExpenses(prev => [...prev, ...res.data.data]);
     }
     setHasMorePages(res.data.current_page < res.data.last_page);
     setCurrentPage(res.data.current_page);
    }
   } catch (err) {
    console.log('Failed to fetch expenses', err);
   } finally {
    setIsLoadingExpenses(false);
   }
  };

  loadCategories();
  loadExpenses(1);
 }, [authToken]);

 const handleReceiptCamera = async () => {
  const result = await launchCamera({
   mediaType: 'photo',
   quality: 0.8,
  });
  const uri = result.assets?.[0]?.uri;
  if (uri) setReceiptUri(uri);
 };

 const handleReceiptGallery = async () => {
  const result = await launchImageLibrary({
   mediaType: 'photo',
   quality: 0.8,
  });
  const uri = result.assets?.[0]?.uri;
  if (uri) setReceiptUri(uri);
 };

 const selectReceipt = () => {
  showDialog({
   title: 'Upload receipt',
   message: 'Choose receipt source',
   variant: 'info',
   primaryAction: {label: 'Camera', onPress: handleReceiptCamera},
   secondaryAction: {label: 'Gallery', onPress: handleReceiptGallery},
  });
 };

 const resetExpenseForm = () => {
  setAmount('');
  setExpenseDate(new Date());
  setExpenseTime(new Date());
  setNotes('');
  setReceiptUri(null);
  setEditingExpenseId(null);
  navigation.setParams?.({editExpense: undefined});
 };

 const handleDiscardEdit = () => {
  if (!editingExpenseId) {
   return;
  }
  showDialog({
   title: 'Discard changes?',
   message:
    'Your expense edits will be lost and the form will return to Add Expense mode.',
   variant: 'warning',
   primaryAction: {
    label: 'Discard',
    onPress: () => {
     resetExpenseForm();
    },
   },
   secondaryAction: {label: 'Keep editing'},
  });
 };

 useEffect(() => {
  const editingEntry = route.params?.editExpense as ExpenseEntry | undefined;
  if (!editingEntry) {
   return;
  }
  setEditingExpenseId(String(editingEntry.id));
  setAmount(String(editingEntry.amount ?? ''));
  const foundCategory = categoryOptions.find(
   option =>
    option.key === String(editingEntry.category) ||
    option.value === (editingEntry.category_name || editingEntry.category),
  );
  if (foundCategory) {
   setCategory(foundCategory.key);
  }
  setExpenseDate(parseDateFromValue(editingEntry.date));
  setNotes(editingEntry.notes ?? '');
  setReceiptUri(null);
  navigation.setParams?.({editExpense: undefined});
 }, [route.params?.editExpense, categoryOptions, navigation]);

 const submitExpense = async () => {
  const numericAmount = Number.parseFloat(amount);
  if (!amount.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
   showDialog({
    title: 'Invalid amount',
    message: 'Please enter a valid amount greater than zero.',
    variant: 'error',
    primaryAction: {label: 'Okay'},
   });
   return;
  }

  if (!notes.trim() || !category) {
   showDialog({
    title: 'Missing fields',
    message: 'Amount, category, and notes are required.',
    variant: 'error',
    primaryAction: {label: 'Okay'},
   });
   return;
  }

  const normalizedAmount = numericAmount.toFixed(2);

  // Create FormData for the API request
  const formData = new FormData();
  formData.append('amount', normalizedAmount);
  formData.append('category', category);
  formData.append('date', formatApiDate(expenseDate));
  formData.append('notes', notes.trim());

  if (receiptUri) {
   const filename = receiptUri.split('/').pop() || 'receipt.jpg';
   const type = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
   formData.append('receipt', {
    uri: receiptUri,
    name: filename,
    type,
   } as any);
  }

  try {
   setIsSubmitting(true);

   const selectedCategoryName =
    categoryOptions.find(c => c.key === category)?.value || category;

   const payload: ExpenseEntry = {
    id: Date.now().toString(),
    amount: normalizedAmount,
    category: selectedCategoryName,
    date: formatDate(expenseDate),
    time: formatTime(expenseTime),
    notes: notes.trim(),
    hasReceipt: Boolean(receiptUri),
   };

   if (editingExpenseId) {
    await updateExpenseRequest(authToken, editingExpenseId, formData);
   } else {
    await createExpenseRequest(formData, authToken);
   }

   // Refetch page 1 to ensure UI list is in sync with backend IDs
   const res = await fetchExpenseList(authToken, 1);
   if (res?.data?.data) {
    setExpenses(res.data.data);
    setHasMorePages(res.data.current_page < res.data.last_page);
    setCurrentPage(res.data.current_page);
   }

   showDialog({
    title: editingExpenseId ? 'Expense updated' : 'Expense submitted',
    message: editingExpenseId
     ? 'Expense has been updated successfully.'
     : 'Expense has been submitted successfully.',
    variant: 'success',
    primaryAction: {label: 'Great'},
   });
   resetExpenseForm();
  } catch (error: any) {
   showDialog({
    title: 'Failed to submit',
    message: error.message || 'An error occurred while saving the expense.',
    variant: 'error',
    primaryAction: {label: 'Okay'},
   });
  } finally {
   setIsSubmitting(false);
  }
 };

 const openExpenseDetail = (expense: ExpenseEntry) => {
  navigation.navigate('ExpenseDetail', {expense});
 };

 const beginEditExpense = (expense: ExpenseEntry) => {
  setEditingExpenseId(String(expense.id));
  setAmount(String(expense.amount ?? ''));
  const foundCategory = categoryOptions.find(
   option =>
    option.key === String(expense.category) ||
    option.value === (expense.category_name || expense.category),
  );
  if (foundCategory) {
   setCategory(foundCategory.key);
  }
  setExpenseDate(parseDateFromValue(expense.date));
  setNotes(expense.notes ?? '');
  setReceiptUri(null);
 };

 const handleDeleteExpense = (expense: ExpenseEntry) => {
  const expenseId = String(expense.id ?? '').trim();
  if (!expenseId) {
   showDialog({
    title: 'Delete failed',
    message: 'Expense id is missing.',
    variant: 'error',
    primaryAction: {label: 'Okay'},
   });
   return;
  }

  showDialog({
   title: 'Delete expense',
   message: 'Are you sure you want to delete this expense log?',
   variant: 'warning',
   primaryAction: {
    label: 'Delete',
    onPress: async () => {
     try {
      setDeletingExpenseId(expenseId);
      await deleteExpenseRequest(authToken, expenseId);
      setExpenses(prev =>
       prev.filter(item => String(item.id ?? '').trim() !== expenseId),
      );
      showDialog({
       title: 'Expense deleted',
       message: 'Expense log was deleted successfully.',
       variant: 'success',
       primaryAction: {label: 'Okay'},
      });
     } catch (error: any) {
      showDialog({
       title: 'Delete failed',
       message: error.message || 'Unable to delete expense.',
       variant: 'error',
       primaryAction: {label: 'Okay'},
      });
     } finally {
      setDeletingExpenseId(null);
     }
    },
   },
   secondaryAction: {label: 'Cancel'},
  });
 };

 const selectedCategoryIcon =
  categoryOptions.find(item => item.key === category)?.icon || 'tag';

 const openDatePicker = () => {
  setPickerMode('date');
  setPickerDate(expenseDate);
  setPickerVisible(true);
 };

 const openTimePicker = () => {
  setPickerMode('time');
  setPickerDate(expenseTime);
  setPickerVisible(true);
 };

 const confirmPicker = () => {
  if (pickerMode === 'date') {
   setExpenseDate(pickerDate);
  } else {
   setExpenseTime(pickerDate);
  }
  setPickerVisible(false);
 };

 const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
  if (Platform.OS === 'android') {
   setPickerVisible(false);
   if (event.type !== 'set' || !date) return;
   if (pickerMode === 'date') {
    setExpenseDate(date);
   } else {
    setExpenseTime(date);
   }
   return;
  }

  if (date) setPickerDate(date);
 };

 return (
  <SafeAreaView style={styles.safe}>
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title={'Add Expense'} />

   <ScrollView
    showsVerticalScrollIndicator={false}
    contentContainerStyle={styles.container}>
    <AnimatedCard style={styles.card} delay={40}>
     <View style={styles.cardHeader}>
      <View>
       <Text allowFontScaling={false} style={styles.cardTitle}>
        Capture a verified claim
       </Text>
      </View>
     </View>
     <Text allowFontScaling={false} style={styles.cardDescription}>
      Keep receipts, amount, and notes in one clean submission.
     </Text>
     <Text allowFontScaling={false} style={styles.sectionHeading}>
      Claim details
     </Text>
     <Text allowFontScaling={false} style={styles.label}>
      Amount
     </Text>
     <View style={styles.amountBox}>
      <Text allowFontScaling={false} style={styles.currency}>
       $
      </Text>
      <TextInput
       allowFontScaling={false}
       value={amount}
       onChangeText={setAmount}
       keyboardType="numeric"
       style={styles.amountInput}
      />
     </View>

     <Text allowFontScaling={false} style={styles.label}>
      Category
     </Text>
     <View style={styles.dropdownWrap}>
      <View style={styles.dropdownLeftIcon}>
       <Feather
        name={selectedCategoryIcon}
        size={14}
        color={theme.colors.primary}
       />
      </View>
      <SelectList
       setSelected={(value: string) => setCategory(value)}
       data={categoryOptions}
       save="key"
       defaultOption={
        categoryOptions.find(c => c.key === category) || {
         key: '',
         value: isLoadingCategories ? 'Loading...' : 'Select category',
        }
       }
       placeholder={isLoadingCategories ? 'Loading...' : 'Select category'}
       boxStyles={styles.selectBox}
       inputStyles={styles.selectText}
       dropdownStyles={styles.selectDropdown}
       dropdownTextStyles={styles.selectDropdownText}
       search={false}
      />
     </View>

     <Text allowFontScaling={false} style={styles.sectionHeading}>
      When it happened
     </Text>
     <View style={styles.dateTimeRow}>
      <View style={styles.dateTimeCol}>
       <Text allowFontScaling={false} style={styles.fieldCaption}>
        Date
       </Text>
       <TouchableOpacity
        style={styles.inputBox}
        onPress={openDatePicker}
        accessibilityLabel="Expense date">
        <Text allowFontScaling={false} style={styles.inputText}>
         {formatDate(expenseDate)}
        </Text>
        <Feather name="calendar" size={16} color={theme.colors.muted} />
       </TouchableOpacity>
      </View>
      <View style={styles.dateTimeCol}>
       <Text allowFontScaling={false} style={styles.fieldCaption}>
        Time
       </Text>
       <TouchableOpacity
        style={styles.inputBox}
        onPress={openTimePicker}
        accessibilityLabel="Expense time">
        <Text allowFontScaling={false} style={styles.inputText}>
         {formatTime(expenseTime)}
        </Text>
        <Feather name="clock" size={16} color={theme.colors.muted} />
       </TouchableOpacity>
      </View>
     </View>

     <Text allowFontScaling={false} style={styles.label}>
      Notes
     </Text>
     <TextInput
      allowFontScaling={false}
      style={styles.notes}
      multiline
      value={notes}
      onChangeText={setNotes}
      placeholder="Add expense note"
      placeholderTextColor={theme.colors.muted}
     />

     <Text allowFontScaling={false} style={styles.label}>
      Receipt
     </Text>
     <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.receiptBox, receiptUri && styles.receiptBoxHasImage]}
      onPress={selectReceipt}>
      {receiptUri ? (
       <>
        <Image
         source={{uri: receiptUri}}
         style={styles.receiptImagePreview}
         resizeMode="cover"
        />
        <View style={styles.receiptImageOverlay}>
         <View style={styles.cameraCircle}>
          <Feather name="edit-2" size={17} color="#FFF" />
         </View>
         <Text allowFontScaling={false} style={styles.receiptTitleOverlay}>
          Tap to change image
         </Text>
        </View>
       </>
      ) : (
       <>
        <View style={styles.cameraCircle}>
         <Feather name="camera" size={17} color={theme.colors.primary} />
        </View>
        <Text allowFontScaling={false} style={styles.receiptTitle}>
         Tap to scan or upload receipt
        </Text>
        <Text allowFontScaling={false} style={styles.receiptHint}>
         Supports JPG, PNG, PDF
        </Text>
       </>
      )}
     </TouchableOpacity>

     <ActionButton
      style={[styles.submitButton, isSubmitting && {opacity: 0.7}]}
      onPress={submitExpense}
      disabled={isSubmitting}
      icon={isSubmitting ? 'loader' : 'send'}
      label={
       isSubmitting
        ? editingExpenseId
          ? 'Updating...'
          : 'Submitting...'
        : editingExpenseId
        ? 'Update Expense'
        : 'Submit Expense'
      }
      subtitle={
       editingExpenseId
        ? 'Save the latest expense changes'
        : 'Upload the claim with receipt'
      }
     />
     {editingExpenseId ? (
      <TouchableOpacity
       activeOpacity={0.85}
       onPress={handleDiscardEdit}
       style={styles.discardEditButton}>
       <Feather name="x-circle" size={14} color={theme.colors.warning} />
       <Text allowFontScaling={false} style={styles.discardEditText}>
        Discard Edit
       </Text>
      </TouchableOpacity>
     ) : null}
    </AnimatedCard>
    <TouchableOpacity
     style={{alignSelf: 'flex-end', top: 12}}
     onPress={() => navigation.navigate('ExpenseList')}>
     <Text
      style={{
       color: theme.colors.text,
       fontSize: 14,
       fontWeight: 'bold',
       marginTop: 11,
      }}>
      See All Expenses
     </Text>
    </TouchableOpacity>
    <AnimatedCard style={styles.listCard} delay={70}>
     <View style={styles.listHeader}>
      <View>
       <Text allowFontScaling={false} style={styles.sectionTitle}>
        Recent Expenses
       </Text>
      </View>
      <Text allowFontScaling={false} style={styles.listCount}>
       {expenses.length} items
      </Text>
     </View>
     {expenses.length === 0 ? (
      <Text allowFontScaling={false} style={styles.emptyListText}>
       No expenses added yet.
      </Text>
     ) : (
      expenses.slice(0, 2).map(entry => (
       <View key={entry.id} style={styles.expenseRow}>
        <TouchableOpacity
         style={styles.expenseRowTouchable}
         activeOpacity={0.9}
         onPress={() => openExpenseDetail(entry)}>
         <View style={styles.expenseIcon}>
          <Feather name="credit-card" size={14} color={theme.colors.primary} />
         </View>
         <View style={styles.expenseInfo}>
          <Text allowFontScaling={false} style={styles.expenseAmount}>
           ${entry.amount || '0'}
          </Text>
          <Text allowFontScaling={false} style={styles.expenseMeta}>
           {entry.category_name || entry.category} • {entry.date}
          </Text>
          {entry.notes ? (
           <Text
            allowFontScaling={false}
            style={styles.expenseNotes}
            numberOfLines={1}>
            {entry.notes}
           </Text>
          ) : null}
         </View>
         {entry.status === 'pending' || entry.hasReceipt || entry.receipt ? (
          <View
           style={[
            styles.receiptBadge,
            entry.status === 'pending' && {
             backgroundColor: 'rgba(255,216,107,0.16)',
            },
           ]}>
           <Text
            allowFontScaling={false}
            style={[
             styles.receiptBadgeText,
             entry.status === 'pending' && {color: theme.colors.warning},
            ]}>
            {entry.status === 'pending' ? 'Pending' : 'Receipt'}
           </Text>
          </View>
         ) : null}
        </TouchableOpacity>
        <TouchableOpacity
         onPress={() => beginEditExpense(entry)}
         style={styles.editButton}>
         <Feather name="edit-2" size={14} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
         onPress={() => handleDeleteExpense(entry)}
         disabled={deletingExpenseId === String(entry.id)}
         style={styles.deleteButton}>
         <Feather
          name={deletingExpenseId === String(entry.id) ? 'loader' : 'trash-2'}
          size={14}
          color={theme.colors.danger}
         />
        </TouchableOpacity>
       </View>
      ))
     )}
     {hasMorePages && !isLoadingExpenses && (
      <TouchableOpacity
       onPress={() => {
        const fetchMore = async () => {
         setIsLoadingExpenses(true);
         try {
          const res = await fetchExpenseList(authToken, currentPage + 1);
          if (res?.data?.data) {
           setExpenses(prev => [...prev, ...res.data.data]);
           setHasMorePages(res.data.current_page < res.data.last_page);
           setCurrentPage(res.data.current_page);
          }
         } catch (e) {}
         setIsLoadingExpenses(false);
        };
        fetchMore();
       }}
       style={styles.loadMoreBtn}>
       <Text style={styles.loadMoreText}>Load More</Text>
      </TouchableOpacity>
     )}
     {isLoadingExpenses && (
      <Text allowFontScaling={false} style={styles.emptyListText}>
       Loading expenses...
      </Text>
     )}
    </AnimatedCard>
   </ScrollView>

   {pickerVisible && Platform.OS === 'ios' ? (
    <ThemedIOSDateTimePicker
     visible={pickerVisible}
     title={pickerMode === 'date' ? 'Date' : 'Time'}
     showTitle={false}
     value={pickerDate}
     mode={pickerMode}
     is24Hour
     onChange={handlePickerChange}
     onCancel={() => setPickerVisible(false)}
     onConfirm={confirmPicker}
    />
   ) : null}
   {pickerVisible && Platform.OS === 'android' ? (
    <DateTimePicker
     value={pickerDate}
     mode={pickerMode}
     display="default"
     is24Hour
     onChange={handlePickerChange}
    />
   ) : null}
  </SafeAreaView>
 );
};

const createStyles = (theme: AppTheme) => {
 const glassCard = theme.colors.card;
 const borderColor = theme.colors.border;
 const inputBg = 'rgba(255,255,255,0.02)';
 const muted = theme.colors.muted;

 return StyleSheet.create({
  safe: {
   flex: 1,
   backgroundColor: theme.colors.background,
   padding: 14,
  },
  backgroundGradient: {
   ...StyleSheet.absoluteFillObject,
   opacity: 0.9,
  },
  container: {
   paddingHorizontal: 8,
   paddingBottom: 24,
  },
  card: {
   backgroundColor: glassCard,
   borderWidth: 1,
   borderColor,
   borderRadius: 22,
   paddingVertical: 20,
   paddingHorizontal: 16,
   // shadowColor: theme.colors.glow,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.14,
   shadowRadius: 10,
   // elevation: 2,
  },
  cardHeader: {
   marginBottom: 6,
  },
  cardTitle: {
   fontSize: 20,
   fontWeight: '800',
   color: theme.colors.text,
  },
  cardDescription: {
   color: muted,
   fontSize: 12,
   lineHeight: 18,
   marginBottom: 14,
  },
  sectionHeading: {
   fontSize: 15,
   fontWeight: '800',
   color: theme.colors.text,
   marginTop: 4,
   marginBottom: 10,
   letterSpacing: 0.2,
  },
  dateTimeRow: {
   flexDirection: 'row',
   gap: 12,
   marginBottom: 12,
  },
  dateTimeCol: {
   flex: 1,
   minWidth: 0,
  },
  fieldCaption: {
   fontSize: 12,
   fontWeight: '700',
   color: theme.colors.text,
   marginBottom: 6,
  },
  label: {
   fontSize: 13,
   color: theme.colors.text,
   fontWeight: '600',
   marginBottom: 6,
   marginTop: 2,
  },
  amountBox: {
   height: 56,
   borderWidth: 1,
   borderColor,
   borderRadius: 16,
   backgroundColor: inputBg,
   paddingHorizontal: 14,
   flexDirection: 'row',
   alignItems: 'center',
   marginBottom: 10,
  },
  currency: {
   fontSize: 22,
   color: muted,
   marginRight: 8,
  },
  amountInput: {
   flex: 1,
   color: theme.colors.text,
   fontSize: 18,
   fontWeight: '700',
  },
  dropdownWrap: {
   marginBottom: 10,
   position: 'relative',
  },
  dropdownLeftIcon: {
   position: 'absolute',
   left: 10,
   top: 11,
   width: 22,
   height: 22,
   borderRadius: 11,
   backgroundColor: 'transparent',
   alignItems: 'center',
   justifyContent: 'center',
   zIndex: 2,
  },
  selectBox: {
   borderColor,
   borderRadius: 16,
   minHeight: 52,
   paddingLeft: 28,
   backgroundColor: inputBg,
  },
  selectText: {
   fontSize: 14,
   color: theme.colors.text,
   marginLeft: '4%',
  },
  selectDropdown: {
   borderColor: theme.colors.border,
   borderRadius: 14,
   backgroundColor: theme.colors.card,
  },
  selectDropdownText: {
   fontSize: 14,
   color: theme.colors.text,
  },
  inputBox: {
   height: 52,
   borderWidth: 1,
   borderColor,
   borderRadius: 16,
   backgroundColor: inputBg,
   paddingHorizontal: 14,
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   marginBottom: 0,
  },
  inputText: {
   color: theme.colors.text,
   fontSize: 14,
   fontWeight: '500',
  },
  notes: {
   borderWidth: 1,
   borderColor,
   borderRadius: 16,
   backgroundColor: inputBg,
   minHeight: 112,
   textAlignVertical: 'top',
   padding: 14,
   fontSize: 13,
   color: theme.colors.text,
   marginBottom: 10,
  },
  receiptBox: {
   borderWidth: 1,
   borderColor,
   borderRadius: 18,
   backgroundColor: inputBg,
   minHeight: 140,
   alignItems: 'center',
   justifyContent: 'center',
   padding: 16,
   overflow: 'hidden',
   position: 'relative',
  },
  receiptBoxHasImage: {
   padding: 0,
   borderWidth: 0,
  },
  receiptImagePreview: {
   width: '100%',
   height: 180,
   borderRadius: 18,
  },
  receiptImageOverlay: {
   ...StyleSheet.absoluteFillObject,
   backgroundColor: 'rgba(0,0,0,0.4)',
   alignItems: 'center',
   justifyContent: 'center',
   borderRadius: 18,
  },
  receiptTitleOverlay: {
   color: '#FFFFFF',
   fontWeight: '700',
   fontSize: 14,
   textAlign: 'center',
  },
  cameraCircle: {
   width: 40,
   height: 40,
   borderRadius: 20,
   backgroundColor: 'rgba(255,255,255,0.05)',
   borderWidth: 1,
   borderColor: borderColor,
   alignItems: 'center',
   justifyContent: 'center',
   marginBottom: 8,
  },
  receiptTitle: {
   color: theme.colors.text,
   fontWeight: '700',
   fontSize: 14,
   textAlign: 'center',
  },
  receiptHint: {
   marginTop: 5,
   color: muted,
   fontSize: 12,
  },
  submitButton: {
   marginTop: 16,
  },
  discardEditButton: {
   marginTop: 10,
   borderWidth: 1,
   borderColor: 'rgba(255, 216, 107, 0.4)',
   backgroundColor: 'rgba(255, 216, 107, 0.12)',
   borderRadius: 14,
   height: 44,
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   gap: 8,
  },
  discardEditText: {
   color: theme.colors.warning,
   fontSize: 13,
   fontWeight: '700',
  },
  pickerOverlay: {
   flex: 1,
   backgroundColor: theme.colors.overlay,
   justifyContent: 'center',
   alignItems: 'center',
  },
  pickerSheet: {
   backgroundColor: glassCard,
   width: '88%',
   borderRadius: 16,
   padding: 16,
   borderWidth: 1,
   borderColor,
  },
  pickerTitle: {
   fontSize: 15,
   fontWeight: '700',
   color: theme.colors.text,
   marginBottom: 8,
  },
  nativePicker: {
   alignSelf: 'stretch',
   backgroundColor: theme.colors.surface,
   borderRadius: 12,
   marginBottom: 8,
  },
  pickerActions: {
   flexDirection: 'row',
   justifyContent: 'flex-end',
   gap: 8,
  },
  pickerCancel: {
   height: 36,
   paddingHorizontal: 14,
   borderRadius: 10,
   borderWidth: 1,
   borderColor,
   alignItems: 'center',
   justifyContent: 'center',
  },
  pickerCancelText: {
   fontSize: 13,
   fontWeight: '600',
   color: muted,
  },
  pickerConfirm: {
   height: 36,
   paddingHorizontal: 14,
   borderRadius: 8,
   backgroundColor: theme.colors.primary,
   alignItems: 'center',
   justifyContent: 'center',
  },
  pickerConfirmText: {
   fontSize: 13,
   fontWeight: '700',
   color: '#FFFFFF',
  },
  listCard: {
   marginTop: 18,
   backgroundColor: glassCard,
   borderRadius: 22,
   borderWidth: 1,
   borderColor,
   paddingVertical: 18,
   paddingHorizontal: 16,
   shadowColor: theme.colors.glowStrong,
   shadowOffset: {width: 0, height: 0},
   shadowOpacity: 0.1,
   shadowRadius: 8,
  },
  listHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'flex-start',
   marginBottom: 10,
  },
  sectionTitle: {
   fontSize: 18,
   fontWeight: '800',
   color: theme.colors.text,
  },
  listCount: {
   color: theme.colors.muted,
   fontSize: 11,
   fontWeight: '700',
  },
  emptyListText: {
   textAlign: 'center',
   color: muted,
   fontSize: 12,
   paddingVertical: 16,
  },
  expenseRow: {
   flexDirection: 'row',
   alignItems: 'flex-start',
   paddingVertical: 14,
   paddingHorizontal: 14,
   borderWidth: 1,
   borderColor: borderColor,
   borderRadius: 18,
   backgroundColor: inputBg,
   gap: 10,
   marginBottom: 10,
  },
  expenseRowTouchable: {
   flex: 1,
   flexDirection: 'row',
   alignItems: 'flex-start',
   gap: 10,
  },
  expenseIcon: {
   width: 34,
   height: 34,
   borderRadius: 12,
   backgroundColor: theme.colors.blueSoft,
   alignItems: 'center',
   justifyContent: 'center',
  },
  expenseInfo: {
   flex: 1,
  },
  expenseAmount: {
   color: theme.colors.text,
   fontSize: 15,
   fontWeight: '700',
  },
  expenseMeta: {
   color: muted,
   fontSize: 12,
   marginTop: 2,
  },
  expenseNotes: {
   marginTop: 4,
   color: theme.colors.text,
   fontSize: 12,
  },
  receiptBadge: {
   alignSelf: 'flex-start',
   borderRadius: 999,
   paddingHorizontal: 10,
   paddingVertical: 4,
   backgroundColor: theme.colors.blueSoft,
  },
  receiptBadgeText: {
   color: theme.colors.primary,
   fontSize: 11,
   fontWeight: '700',
  },
  deleteButton: {
   width: 32,
   height: 32,
   borderRadius: 16,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  editButton: {
   width: 32,
   height: 32,
   borderRadius: 16,
   alignItems: 'center',
   justifyContent: 'center',
   backgroundColor: 'rgba(37, 99, 235, 0.12)',
   marginRight: 6,
  },
  loadMoreBtn: {
   marginTop: 10,
   paddingVertical: 10,
   alignItems: 'center',
   borderWidth: 1,
   borderColor: borderColor,
   borderRadius: 14,
   backgroundColor: 'rgba(255,255,255,0.02)',
  },
  loadMoreText: {
   color: theme.colors.primary,
   fontSize: 13,
   fontWeight: '600',
  },
 });
};
