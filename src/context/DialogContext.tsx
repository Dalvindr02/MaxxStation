import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert, InteractionManager, Platform } from 'react-native';
import AppDialog, {
  DialogVariant,
  DialogAction,
} from '../components/AppDialog';

type DialogConfig = {
  title?: string;
  message: string;
  variant?: DialogVariant;
  primaryAction?: DialogAction;
  secondaryAction?: DialogAction;
  dismissOnBackdrop?: boolean;
};

type DialogContextValue = {
  showDialog: (config: DialogConfig) => void;
  hideDialog: () => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isMounted = React.useRef(true);
  const iosAlertVisible = React.useRef(false);
  const iosAlertTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (iosAlertTimer.current) {
        clearTimeout(iosAlertTimer.current);
      }
    };
  }, []);

  const [dialogConfig, setDialogConfig] = useState<DialogConfig & { visible: boolean }>(
    {
      visible: false,
      title: undefined,
      message: '',
      variant: 'info',
      primaryAction: undefined,
      secondaryAction: undefined,
      dismissOnBackdrop: true,
    },
  );

  const hideDialog = useCallback(() => {
    if (!isMounted.current) return;
    if (iosAlertTimer.current) {
      clearTimeout(iosAlertTimer.current);
      iosAlertTimer.current = null;
    }
    iosAlertVisible.current = false;
    setDialogConfig(prev => ({ ...prev, visible: false }));
  }, []);

  const runDialogAction = useCallback((action?: DialogAction) => {
    if (!action?.onPress) return;

    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        if (isMounted.current) {
          action.onPress?.();
        }
      }, Platform.OS === 'ios' ? 250 : 0);
    });
  }, []);

  const showDialog = useCallback((config: DialogConfig) => {
    if (!isMounted.current) return;

    if (Platform.OS === 'ios') {
      if (iosAlertTimer.current) {
        clearTimeout(iosAlertTimer.current);
      }

      const buttons = [
        ...(config.secondaryAction
          ? [
              {
                text: config.secondaryAction.label,
                style: 'cancel' as const,
                onPress: () => {
                  iosAlertVisible.current = false;
                  runDialogAction(config.secondaryAction);
                },
              },
            ]
          : []),
        {
          text: config.primaryAction?.label ?? 'OK',
          style: config.variant === 'warning' ? ('destructive' as const) : ('default' as const),
          onPress: () => {
            iosAlertVisible.current = false;
            runDialogAction(config.primaryAction);
          },
        },
      ];

      iosAlertTimer.current = setTimeout(() => {
        if (!isMounted.current || iosAlertVisible.current) return;
        iosAlertVisible.current = true;
        Alert.alert(config.title ?? '', config.message, buttons, {
          cancelable: config.dismissOnBackdrop ?? true,
          onDismiss: () => {
            iosAlertVisible.current = false;
          },
        });
      }, 80);
      return;
    }

    setDialogConfig({
      visible: true,
      ...config,
      variant: config.variant ?? 'info',
      dismissOnBackdrop: config.dismissOnBackdrop ?? true,
    });
  }, [runDialogAction]);

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog }}>
      {children}
      <AppDialog
        visible={dialogConfig.visible}
        title={dialogConfig.title}
        message={dialogConfig.message}
        variant={dialogConfig.variant}
        primaryAction={dialogConfig.primaryAction}
        secondaryAction={dialogConfig.secondaryAction}
        dismissOnBackdrop={dialogConfig.dismissOnBackdrop}
        onClose={hideDialog}
      />
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return context;
};
