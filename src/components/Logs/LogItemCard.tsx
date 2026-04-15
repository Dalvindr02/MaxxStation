import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { AnimatedCard } from '../ui';
import { LogEntry } from '../../context/LogsContext';
import { AppTheme } from '../../theme';

interface LogItemCardProps {
  log: LogEntry;
  isLast: boolean;
  isExpanded: boolean;
  toggleExpand: (id: string) => void;
  handleEdit: (log: LogEntry) => void;
  handleDelete: (id: string) => void;
  theme: AppTheme;
  getCategoryIcon: (key: string) => string;
  getDurationText: (start: string, end: string) => string;
  formatDisplayDate: (date: Date) => string;
  parseDateKey: (key: string) => Date;
}

export const LogItemCard: React.FC<LogItemCardProps> = React.memo(
  ({
    log,
    isLast,
    isExpanded,
    toggleExpand,
    handleEdit,
    handleDelete,
    theme,
    getCategoryIcon,
    getDurationText,
    formatDisplayDate,
    parseDateKey,
  }) => {
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
      <View style={styles.logRow}>
        <View style={styles.timelineColumn}>
          <View style={styles.timelineNode} />
          {!isLast && <View style={styles.timelineLine} />}
        </View>

        <AnimatedCard style={styles.logCard}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => toggleExpand(log?.id)}
            style={styles.logPressable}
          >
            <View style={styles.logHeader}>
              <View style={styles.logIconBadge}>
                <Feather
                  name={getCategoryIcon(log?.category)}
                  size={16}
                  color="#FFFFFF"
                />
              </View>

              <View style={styles.logTimeWrap}>
                <Text allowFontScaling={false} style={styles.logTime}>
                  {log?.startTime} → {log?.endTime}
                </Text>

                <View style={styles.durationChip}>
                  <Feather
                    name="clock"
                    size={12}
                    color={theme.colors.primary}
                  />
                  <Text allowFontScaling={false} style={styles.durationText}>
                    {getDurationText(log?.startTime, log?.endTime)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.logMetaRow}>
              <View style={styles.dateBadge}>
                <Feather
                  name="calendar"
                  size={12}
                  color={theme.colors.primary}
                />
                <Text allowFontScaling={false} style={styles.dateText}>
                  {formatDisplayDate(parseDateKey(log?.date))}
                </Text>
              </View>

              <View style={styles.categoryBadge}>
                <Text allowFontScaling={false} style={styles.categoryText}>
                  {log?.category}
                </Text>
              </View>

              <View style={styles.projectBadge}>
                <Feather
                  name="briefcase"
                  size={12}
                  color={theme.colors.primary}
                />
                <Text allowFontScaling={false} style={styles.projectBadgeText}>
                  {log?.projectName}
                </Text>
              </View>

              {log?.taskName ? (
                <View style={styles.taskBadge}>
                  <Feather
                    name="check-square"
                    size={12}
                    color={theme.colors.primary}
                  />
                  <Text allowFontScaling={false} style={styles.taskBadgeText}>
                    {log?.taskName}
                  </Text>
                </View>
              ) : null}

              {log?.billable ? (
                <View style={styles.billableBadge}>
                  <Feather
                    name="dollar-sign"
                    size={12}
                    color={theme.colors.success}
                  />
                  <Text allowFontScaling={false} style={styles.billableBadgeText}>
                    Billable
                  </Text>
                </View>
              ) : null}
            </View>

            {log?.notes ? (
              <Text allowFontScaling={false} style={styles.logNotes}>
                {log?.notes}
              </Text>
            ) : null}
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.logActionRail}>
              <TouchableOpacity
                style={[styles.logActionButton, styles.logEditButton]}
                onPress={() => handleEdit(log)}
              >
                <Feather name="edit-3" size={16} color="#FFF" />
                <Text allowFontScaling={false} style={styles.logActionText}>
                  Edit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.logActionButton, styles.logDeleteButton]}
                onPress={() => handleDelete(log.id)}
              >
                <Feather name="trash-2" size={16} color="#FFF" />
                <Text allowFontScaling={false} style={styles.logActionText}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </AnimatedCard>
      </View>
    );
  },
);

const createStyles = (theme: AppTheme) => {
  const borderColor = theme.colors.border;
  const glassSurface = theme.colors.surface;
  const inputBg = 'rgba(255,255,255,0.02)';
  const muted = theme.colors.muted;

  return StyleSheet.create({
    logRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    timelineColumn: {
      width: 24,
      alignItems: 'center',
    },
    timelineNode: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor,
      marginTop: 6,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: borderColor,
      marginTop: 4,
    },
    logCard: {
      flex: 1,
      paddingVertical: 18,
      paddingHorizontal: 16,
      borderRadius: 22,
      borderWidth: 1,
      borderColor,
      backgroundColor: glassSurface,
      shadowColor: theme.colors.glowStrong || '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    logPressable: {
      flex: 1,
    },
    logHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 10,
    },
    logIconBadge: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 4,
    },
    logTimeWrap: {
      flex: 1,
    },
    logTime: {
      fontWeight: '700',
      color: theme.colors.text,
      fontSize: 15,
    },
    durationChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: borderColor,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    durationText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    logMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
      gap: 8,
    },
    dateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    dateText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '600',
    },
    categoryBadge: {
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    categoryText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '600',
    },
    projectBadge: {
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    projectBadgeText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '600',
    },
    taskBadge: {
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    taskBadgeText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '600',
    },
    billableBadge: {
      backgroundColor: theme.colors.greenSoft || 'rgba(93,255,169,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(93,255,169,0.2)',
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    billableBadgeText: {
      color: theme.colors.success,
      fontSize: 11,
      fontWeight: '600',
    },
    logNotes: {
      marginTop: 8,
      color: muted,
      fontSize: 12,
      lineHeight: 18,
    },
    logActionRail: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      justifyContent: 'flex-end',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: borderColor,
    },
    logActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      minWidth: 92,
      justifyContent: 'center',
    },
    logEditButton: {
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    logDeleteButton: {
      backgroundColor: theme.colors.danger,
      shadowColor: theme.colors.danger,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    logActionText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 12,
    },
  });
};
