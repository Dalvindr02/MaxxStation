# Implementation & Testing Guide - Google APIs Integration

## Quick Start

### Prerequisites

- ✅ Google Maps API key enabled with:
  - Places API
  - Directions API
  - Geocoding API
  - Maps SDK (Android/iOS)
- ✅ `.env` file updated with API key
- ✅ React Native project built and running

## Step-by-Step Implementation

### 1. Verify Google Maps API Key

Check your `.env` file contains your API key:

```env
GOOGLE_MAPS_WEB_API_KEY=AIzaSyBYcgSlW_VgS7ol7rbDjFtIkt-QucujDcY
```

**If missing or incorrect:**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Enable these APIs:
   - Places API
   - Directions API
   - Geocoding API
   - Maps SDK for Android
   - Maps SDK for iOS
4. Create/copy your API key
5. Update `.env` file
6. Rebuild app: `react-native run-android` or `react-native run-ios`

### 2. Verify Dependencies

Check `package.json` has these packages:

```json
{
 "react-native-google-places-autocomplete": "^2.6.4",
 "react-native-maps": "^1.27.1",
 "react-native-maps-directions": "^1.9.0",
 "react-native-geocoding": "^0.3.0",
 "react-native-geolocation-service": "^5.3.1"
}
```

If missing, install:

```bash
npm install react-native-google-places-autocomplete@^2.6.4 \
           react-native-maps@^1.27.1 \
           react-native-maps-directions@^1.9.0 \
           react-native-geocoding@^0.3.0
```

### 3. Rebuild Native Code

After installing dependencies, rebuild:

**Android:**

```bash
cd android
./gradlew clean
./gradlew assembleDebug
cd ..
react-native run-android
```

**iOS:**

```bash
cd ios
pod install --repo-update
cd ..
react-native run-ios
```

## Testing the Integration

### Test 1: Manual Log Modal Opens

**Steps:**

1. Navigate to Attendance screen
2. Scroll to "Travel" section
3. Click "Manual Log Form" button
4. Verify modal appears with all sections:
   - From Location input
   - To Location input
   - Map preview
   - Route selection area
   - Travel details form

**Expected Result:** ✅ Modal displays correctly

### Test 2: Place Autocomplete Works

**Steps:**

1. Open Manual Log Modal
2. Click "From Location" input
3. Type "Starbucks" (or local place name)
4. Wait 1-2 seconds for suggestions
5. Verify dropdown shows suggestions with:
   - Place name (primary text)
   - Address (secondary text)

**Expected Result:** ✅ Suggestions appear while typing

### Test 3: Location Selection and Geocoding

**Steps:**

1. In "From Location" input, type "Times Square"
2. Select first suggestion
3. Observe:
   - Input field updates with full address
   - "✓ Location selected" message appears
   - Loading indicator briefly shows

**Expected Result:** ✅ Location coordinates extracted

### Test 4: Route Fetching and Display

**Steps:**

1. Select "From Location": "Central Park, New York"
2. Select "To Location": "Empire State Building, New York"
3. Wait 3-5 seconds for routes to load
4. Verify:
   - Map shows route with both markers
   - Route options appear below map
   - Each route shows distance and duration

**Expected Result:** ✅ Multiple routes displayed with correct distance/duration

### Test 5: Route Selection

**Steps:**

1. Have two or more routes loaded
2. Click on a different route
3. Verify:
   - Route becomes highlighted (blue border)
   - Route radio button shows selected state
   - Map updates if applicable

**Expected Result:** ✅ Route selection works smoothly

### Test 6: Form Validation

**Steps:**

1. Try clicking "Save Travel Log" with empty fields
2. Verify button remains disabled (grayed out)
3. Fill in fields one by one:
   - From Location
   - To Location
   - Topic
   - Description
   - Select Route
4. Verify button becomes enabled after all fields filled

**Expected Result:** ✅ Form prevents incomplete submissions

### Test 7: Travel Log Submission

**Steps:**

1. Complete all fields:
   - From: "Your Office"
   - To: "Client Location"
   - Topic: "Client Meeting"
   - Description: "Q1 Planning Discussion"
   - Billable: Toggle ON
2. Click "Save Travel Log"
3. Observe:
   - Loading indicator shows "Saving..."
   - Network request sent to backend
   - Success dialog appears after completion
   - Modal closes automatically

**Expected Result:** ✅ Log saved and confirmation shown

### Test 8: Error Handling

**Steps:**

**Scenario A - No API Key:**

1. Comment out API key in .env
2. Try using autocomplete
3. Verify error message displays

**Scenario B - Invalid Location:**

1. Enter obviously invalid location
2. Verify graceful handling or error message

**Scenario C - Network Error:**

1. Turn off airplane mode
2. Try fetching routes
3. Verify error message and fallback options

**Expected Result:** ✅ Errors handled gracefully

### Test 9: Dark/Light Theme

**Steps:**

1. Complete manual log in light theme
2. Switch to dark theme (if available)
3. Reopen manual log modal
4. Verify all colors and text are visible in both themes

**Expected Result:** ✅ Works in both themes

### Test 10: Cancel and Close

**Steps:**

1. Open Manual Log Modal
2. Start filling form with some data
3. Click "Cancel" button
4. Verify:
   - Modal closes
   - Data is cleared (form reset)
5. Reopen modal
6. Verify form is empty (data not persisted)

**Expected Result:** ✅ Modal closes and clears data

## Performance Testing

### Test 1: Autocomplete Performance

**Measurement:**

- Time from typing to suggestions appearing
- Number of API calls made
- Results should show suggestions within 1-2 seconds

**Expected Result:** ✅ Instant suggestions with debounce working

### Test 2: Route Fetching Performance

**Measurement:**

- Time from selecting to/from locations to routes appearing
- Should take 2-5 seconds depending on distance
- Network activity should show single Directions API call

**Expected Result:** ✅ Routes load efficiently

### Test 3: Modal Responsiveness

**Measurement:**

- Scrolling through form should be smooth
- Typing in fields should be responsive
- Map interactions should not stutter

**Expected Result:** ✅ 60 FPS performance

## Debugging Tips

### Check Network Requests

**Using Android Studio:**

1. Open Logcat
2. Filter by "google" or "maps"
3. Look for successful API responses:
   ```
   {"status":"OK","predictions":[...]}
   ```

**Using Xcode Console:**

1. Build and run app in debug mode
2. Check console for network activity
3. Look for Places API response logs

### Enable Verbose Logging

Add to ManualLogModal component:

```typescript
// In handleFromSearch
console.log('Searching for:', text);
console.log('Suggestions found:', suggestions.length);

// In handleSelectFromPlace
console.log('Selected place:', place);
console.log('Geocoded coords:', geocoded.coords);
```

### Test with Mock Data

To test without live API calls:

```typescript
// In googleMapsService.ts
const MOCK_MODE = true; // Set to true for testing

if (MOCK_MODE) {
 return [
  {
   placeId: 'mock1',
   label: 'Test Location 1',
   description: 'Test Address 1',
  },
 ];
}
```

## Deployment Checklist

Before going to production:

- [ ] API key is securely stored in .env
- [ ] All APIs are enabled in Google Cloud Console
- [ ] Rate limits are set appropriately
- [ ] Fallback routes work if API fails
- [ ] Error messages are user-friendly
- [ ] Performance meets requirements
- [ ] All themes look correct
- [ ] Form validation works
- [ ] Data persistence/cleanup works
- [ ] Integration tests pass
- [ ] Manual testing complete
- [ ] Documentation updated

## Troubleshooting Common Issues

### Issue: "Google Maps Web API key is not configured"

**Cause:** API key not in .env or not loaded

**Fix:**

```bash
# Make sure .env exists with API key
echo "GOOGLE_MAPS_WEB_API_KEY=YOUR_KEY_HERE" > .env

# Rebuild app
react-native run-android
```

### Issue: "No suggestions appearing"

**Cause:** Places API not enabled or quota exceeded

**Fix:**

1. Check Google Cloud Console
2. Verify Places API is enabled
3. Check API quotas and billing
4. Increase rate limits if needed
5. Restart app and clear cache

### Issue: "Routes not loading"

**Cause:** Directions API issue or invalid coordinates

**Fix:**

1. Verify coordinates are correct
2. Check Directions API is enabled
3. Test with different locations
4. Check API logs in Google Cloud

### Issue: "Map not showing in preview"

**Cause:** Native Android/iOS config issue

**Fix:**

1. Verify API key in AndroidManifest.xml (Android)
2. Check Info.plist has permissions (iOS)
3. Rebuild native code
4. Clear app cache and reinstall

## Support Resources

- Google Maps Platform Support: https://developers.google.com/maps/support
- Billing & Quotas: https://console.cloud.google.com/billing
- Community Forum: https://stackoverflow.com/questions/tagged/google-maps-api
- GitHub Issues: Check react-native-maps repository

## Next Steps

1. ✅ Complete all tests above
2. ✅ Fix any issues found
3. ✅ Review performance metrics
4. ✅ Plan additional features (stops, offline mode, etc.)
5. ✅ Set up monitoring and analytics
6. ✅ Deploy to production with confidence
