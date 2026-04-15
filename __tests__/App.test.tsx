/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-device-info', () => ({
  getUniqueId: jest.fn(() => Promise.resolve('test-device-token')),
}));

jest.mock('react-native-vector-icons/Feather', () => 'Feather');

jest.mock('../src/services/notificationService', () => ({
  initializeNotificationPipeline: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/navigation/AppNavigator', () => ({
  AppNavigator: () => {
    const ReactNative = require('react-native');
    return <ReactNative.Text>App Navigator</ReactNative.Text>;
  },
}));

jest.mock('../src/components/LiveTrackingSplash', () => ({
  LiveTrackingSplash: () => {
    const ReactNative = require('react-native');
    return <ReactNative.Text>Loading...</ReactNative.Text>;
  },
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
