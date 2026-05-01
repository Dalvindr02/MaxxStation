declare module 'react-native-google-places-autocomplete' {
 import React from 'react';

 export interface GooglePlacesAutocompleteProps {
  placeholder?: string;
  placeholderTextColor?: string;
  fetchDetails?: boolean;
  onPress?: (data: any, details?: any) => void;
  query?: {
   key: string;
   language?: string;
   components?: string;
  };
  styles?: {
   textInput?: any;
   textInputContainer?: any;
   listView?: any;
   row?: any;
   description?: any;
  };
  enablePoweredByContainer?: boolean;
  nearbyPlacesAPI?: string;
  debounce?: number;
  textInputProps?: {
   placeholderTextColor?: string;
   value?: string;
   onChangeText?: (text: string) => void;
  };
 }

 export class GooglePlacesAutocomplete extends React.Component<GooglePlacesAutocompleteProps> {}
 export default GooglePlacesAutocomplete;
}
