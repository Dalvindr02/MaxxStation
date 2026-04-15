import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { ProjectOption } from '../../services/projectService';
import { AppTheme } from '../../theme';

interface ProjectPickerModalProps {
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
  projects: ProjectOption[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
}

export const ProjectPickerModal: React.FC<ProjectPickerModalProps> = ({
  visible,
  onClose,
  theme,
  projects,
  selectedProjectId,
  onSelectProject,
}) => {
  const [search, setSearch] = useState('');
  const styles = useMemo(() => createStyles(theme), [theme]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter(project =>
      project.name.toLowerCase().includes(query),
    );
  }, [search, projects]);

  const handleSelect = (id: string) => {
    onSelectProject(id);
    setSearch('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.projectModalRoot}>
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        >
          <View style={styles.projectModalBackdrop} />
        </TouchableOpacity>
        
        <View style={styles.projectModalSheet}>
          <View style={styles.projectModalHandle} />
          
          <View style={styles.projectModalHeader}>
            <View>
              <Text allowFontScaling={false} style={styles.projectModalTitle}>
                Select Project
              </Text>
              <Text allowFontScaling={false} style={styles.projectModalSubtitle}>
                Pick a project to load its tasks
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.projectModalClose}
              onPress={onClose}
            >
              <Feather name="x" size={16} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.projectSearchWrap}>
            <Feather
              name="search"
              size={15}
              color={theme.colors.primary}
              style={styles.projectSearchIcon}
            />
            <TextInput
              allowFontScaling={false}
              value={search}
              onChangeText={setSearch}
              placeholder="Search project"
              placeholderTextColor={theme.colors.muted}
              style={styles.projectSearchInput}
            />
            {search ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.projectSearchClear}
                onPress={() => setSearch('')}
              >
                <Feather name="x" size={14} color={theme.colors.text} />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <FlatList
            data={filteredProjects}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.projectModalList}
            renderItem={({ item: project }) => {
              const isSelected = project.id === selectedProjectId;
              return (
                <TouchableOpacity
                  key={project.id}
                  activeOpacity={0.88}
                  style={[
                    styles.projectOptionCard,
                    isSelected && styles.projectOptionCardSelected,
                  ]}
                  onPress={() => handleSelect(project.id)}
                >
                  <View style={styles.projectOptionIcon}>
                    <Feather
                      name="briefcase"
                      size={15}
                      color={isSelected ? '#FFFFFF' : theme.colors.primary}
                    />
                  </View>
                  <View style={styles.projectOptionContent}>
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.projectOptionTitle,
                        isSelected && styles.projectOptionTitleSelected,
                      ]}
                    >
                      {project.name}
                    </Text>
                    <Text allowFontScaling={false} style={styles.projectOptionMeta}>
                      {project.tasks.length}{' '}
                      {project.tasks.length === 1 ? 'task' : 'tasks'}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View style={styles.projectOptionCheck}>
                      <Feather name="check" size={14} color="#FFFFFF" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.projectEmptyState}>
                <Text allowFontScaling={false} style={styles.projectEmptyTitle}>
                  No project found
                </Text>
                <Text allowFontScaling={false} style={styles.projectEmptyText}>
                  Try a different search term.
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => {
  const borderColor = theme.colors.border;
  const glassSurface = theme.colors.surface;

  return StyleSheet.create({
    projectModalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    projectModalBackdrop: {
      flex: 1,
      backgroundColor: theme.isDark
        ? 'rgba(2,6,23,0.76)'
        : 'rgba(15,23,42,0.44)',
    },
    projectModalSheet: {
      maxHeight: '70%',
      minHeight: '40%',
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      backgroundColor: theme.isDark
        ? 'rgba(8,15,28,0.98)'
        : 'rgba(255,255,255,0.98)',
      borderWidth: 1,
      borderColor: borderColor,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 20,
    },
    projectModalHandle: {
      alignSelf: 'center',
      width: 54,
      height: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(150,150,150,0.3)',
      marginBottom: 14,
    },
    projectModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    projectModalTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    projectModalSubtitle: {
      marginTop: 2,
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    projectModalClose: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(150,150,150,0.1)',
      borderWidth: 1,
      borderColor: borderColor,
    },
    projectModalList: {
      paddingBottom: 28,
      gap: 10,
    },
    projectSearchWrap: {
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: borderColor,
      backgroundColor: glassSurface,
      marginBottom: 14,
      paddingLeft: 40,
      paddingRight: 38,
      justifyContent: 'center',
    },
    projectSearchIcon: {
      position: 'absolute',
      left: 14,
      top: 15,
    },
    projectSearchInput: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
      paddingVertical: 0,
      height: '100%',
    },
    projectSearchClear: {
      position: 'absolute',
      right: 10,
      top: 10,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(150,150,150,0.2)',
    },
    projectOptionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 18,
      padding: 14,
      backgroundColor: glassSurface,
      borderWidth: 1,
      borderColor: borderColor,
    },
    projectOptionCardSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    projectOptionIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(150,150,150,0.1)',
      marginRight: 12,
    },
    projectOptionContent: {
      flex: 1,
    },
    projectOptionTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    projectOptionTitleSelected: {
      color: '#FFFFFF',
    },
    projectOptionMeta: {
      marginTop: 3,
      color: theme.colors.muted,
      fontSize: 11,
      fontWeight: '600',
    },
    projectOptionCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      marginLeft: 10,
    },
    projectEmptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 28,
    },
    projectEmptyTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    projectEmptyText: {
      marginTop: 4,
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
  });
};
