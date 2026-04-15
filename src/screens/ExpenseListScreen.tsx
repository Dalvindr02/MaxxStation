import React, {useEffect, useMemo, useState} from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';

import {TopHeader} from '../components/TopHeader';
import {useDialog} from '../context/DialogContext';
import {useAppTheme} from '../context/ThemeContext';
import {AppTheme} from '../theme';
import {
 deleteExpenseRequest,
 fetchExpenseList,
} from '../services/expenseService';
import {useAppSelector} from '../store/hooks';
import {ExpenseEntry} from './ExpensesScreen';

export const ExpenseListScreen = () => {
 const {theme} = useAppTheme();
 const styles = useMemo(() => createStyles(theme), [theme]);
 const navigation = useNavigation<any>();
 const {showDialog} = useDialog();
 const authToken = useAppSelector(state => state.auth.token);

 const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
 const [currentPage, setCurrentPage] = useState(1);
 const [hasMorePages, setHasMorePages] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(
  null,
 );

 const loadExpenses = async (page = 1) => {
  try {
   setIsLoading(true);
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
   setIsLoading(false);
  }
 };

 useEffect(() => {
  loadExpenses(1);
 }, [authToken]);

 const loadMore = () => {
  if (hasMorePages && !isLoading) {
   loadExpenses(currentPage + 1);
  }
 };

 const openExpenseDetail = (expense: ExpenseEntry) => {
  navigation.navigate('ExpenseDetail', {expense});
 };

 const handleEditExpense = (expense: ExpenseEntry) => {
  navigation.navigate('Expenses', {editExpense: expense});
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

 return (
  <SafeAreaView style={styles.safe}>
   <LinearGradient
    colors={theme.gradients.screen}
    start={{x: 0.5, y: 0}}
    end={{x: 0.5, y: 1}}
    style={styles.backgroundGradient}
   />
   <TopHeader title="All Expenses" />

   <View style={styles.container}>
    <FlatList
     data={expenses}
     keyExtractor={item => String(item.id)}
     contentContainerStyle={styles.listContent}
     showsVerticalScrollIndicator={false}
     ListEmptyComponent={
      <Text allowFontScaling={false} style={styles.emptyListText}>
       {isLoading ? 'Loading expenses...' : 'No expenses found.'}
      </Text>
     }
     renderItem={({item: entry}) => (
      <View style={styles.expenseRow}>
       <TouchableOpacity
        style={styles.expenseRowTouchable}
        activeOpacity={0.9}
        onPress={() => openExpenseDetail(entry)}>
        <View style={styles.expenseIcon}>
         <Feather name="credit-card" size={16} color={theme.colors.primary} />
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
        onPress={() => handleEditExpense(entry)}
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
     )}
     onEndReached={loadMore}
     onEndReachedThreshold={0.5}
     ListFooterComponent={
      isLoading && expenses.length > 0 ? (
       <Text allowFontScaling={false} style={styles.loadingFooter}>
        Loading more...
       </Text>
      ) : null
     }
    />
   </View>
  </SafeAreaView>
 );
};

const createStyles = (theme: AppTheme) => {
 const borderColor = theme.colors.border;
 const inputBg = 'rgba(255,255,255,0.02)';
 const muted = theme.colors.muted;

 return StyleSheet.create({
  safe: {
   flex: 1,
   backgroundColor: theme.colors.background,
  },
  backgroundGradient: {
   ...StyleSheet.absoluteFillObject,
   opacity: 0.9,
  },
  container: {
   flex: 1,
   paddingHorizontal: 16,
  },
  listContent: {
   paddingBottom: 40,
   paddingTop: 10,
  },
  expenseRow: {
   flexDirection: 'row',
   alignItems: 'flex-start',
   paddingVertical: 14,
   paddingHorizontal: 14,
   borderWidth: 1,
   borderColor: borderColor,
   borderRadius: 18,
   backgroundColor: theme.colors.card,
   gap: 12,
   marginBottom: 12,
  },
  expenseRowTouchable: {
   flex: 1,
   flexDirection: 'row',
   alignItems: 'flex-start',
   gap: 12,
  },
  expenseIcon: {
   width: 40,
   height: 40,
   borderRadius: 14,
   backgroundColor: theme.colors.blueSoft,
   alignItems: 'center',
   justifyContent: 'center',
  },
  expenseInfo: {
   flex: 1,
  },
  expenseAmount: {
   color: theme.colors.text,
   fontSize: 16,
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
  emptyListText: {
   textAlign: 'center',
   color: muted,
   fontSize: 14,
   marginTop: 40,
  },
  loadingFooter: {
   textAlign: 'center',
   color: muted,
   fontSize: 12,
   marginVertical: 16,
  },
 });
};

export default ExpenseListScreen;
