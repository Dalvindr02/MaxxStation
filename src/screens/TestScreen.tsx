import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'react-native';

export default function TestScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Image
        source={{ uri: 'https://reactnative.dev/img/tiny_logo.png' }}
        style={{ width: 200, height: 200 }}
      />
      <Text style={{ fontSize: 18, marginTop: 20 }}>REACT-NATIVE</Text>
    </View>
  );
}
