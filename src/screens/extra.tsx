const LogItem = React.memo(
  ({
    log,
    index,
    isLast,
    isExpanded,
    toggleExpand,
    handleEdit,
    handleDelete,
    theme,
    styles,
    getCategoryIcon,
    getDurationText,
    formatDisplayDate,
    parseDateKey,
  }: any) => {
    return (
      <View style={styles.logRow}>
        <View style={styles.timelineColumn}>
          <View style={styles.timelineNode} />
          {!isLast && <View style={styles.timelineLine} />}
        </View>

        <AnimatedCard style={styles.logCard}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => toggleExpand(log.id)}
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
                <Text style={styles.logTime}>
                  {log?.startTime} → {log?.endTime}
                </Text>

                <View style={styles.durationChip}>
                  <Feather
                    name="clock"
                    size={12}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.durationText}>
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
                <Text style={styles.dateText}>
                  {formatDisplayDate(parseDateKey(log?.date))}
                </Text>
              </View>

              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{log?.category}</Text>
              </View>

              <View style={styles.projectBadge}>
                <Feather
                  name="briefcase"
                  size={12}
                  color={theme.colors.primary}
                />
                <Text style={styles.projectBadgeText}>{log?.projectName}</Text>
              </View>

              {log?.taskName && (
                <View style={styles.taskBadge}>
                  <Feather
                    name="check-square"
                    size={12}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.taskBadgeText}>{log?.taskName}</Text>
                </View>
              )}

              {log?.billable && (
                <View style={styles.billableBadge}>
                  <Feather
                    name="dollar-sign"
                    size={12}
                    color={theme.colors.success}
                  />
                  <Text style={styles.billableBadgeText}>Billable</Text>
                </View>
              )}
            </View>

            {log?.notes && <Text style={styles.logNotes}>{log?.notes}</Text>}
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.logActionRail}>
              <TouchableOpacity
                style={[styles.logActionButton, styles.logEditButton]}
                onPress={() => handleEdit(log)}
              >
                <Feather name="edit-3" size={16} color="#FFF" />
                <Text style={styles.logActionText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.logActionButton, styles.logDeleteButton]}
                onPress={() => handleDelete(log.id)}
              >
                <Feather name="trash-2" size={16} color="#FFF" />
                <Text style={styles.logActionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </AnimatedCard>
      </View>
    );
  },
);

<FlatList
  data={previewLogs}
  keyExtractor={item => item.id}
  scrollEnabled={false} // important because inside ScrollView
  renderItem={({ item, index }) => (
    <LogItem
      log={item}
      index={index}
      isLast={index === previewLogs.length - 1}
      isExpanded={expandedLogId === item.id}
      toggleExpand={toggleExpand}
      handleEdit={handleEdit}
      handleDelete={handleDelete}
      theme={theme}
      styles={styles}
      getCategoryIcon={getCategoryIcon}
      getDurationText={getDurationText}
      formatDisplayDate={formatDisplayDate}
      parseDateKey={parseDateKey}
    />
  )}
  initialNumToRender={3}
  maxToRenderPerBatch={3}
  windowSize={3}
  removeClippedSubviews={true}
/>;
