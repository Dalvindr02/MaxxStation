import React, { createContext, useCallback, useContext, useState } from 'react';
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

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
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
    setDialogConfig(prev => ({ ...prev, visible: false }));
  }, []);

  const showDialog = useCallback((config: DialogConfig) => {
    if (!isMounted.current) return;
    setDialogConfig({
      visible: true,
      ...config,
      variant: config.variant ?? 'info',
      dismissOnBackdrop: config.dismissOnBackdrop ?? true,
    });
  }, []);

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
