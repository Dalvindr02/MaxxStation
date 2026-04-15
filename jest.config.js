module.exports = {
  preset: 'react-native',
  testPathIgnorePatterns: ['/node_modules/', '/src/test.ts$'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-redux|@reduxjs/toolkit|redux|redux-thunk|immer|reselect)/)',
  ],
};
