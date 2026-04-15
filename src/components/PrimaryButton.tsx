import React from 'react';
import { ActionButton } from './ui';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
};

export const PrimaryButton: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
}) => {
  return (
    <ActionButton
      label={label}
      onPress={onPress}
      variant={variant}
      trailingIcon={null}
    />
  );
};
