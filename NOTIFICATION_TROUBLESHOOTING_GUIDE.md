# Notification Sound Troubleshooting Guide

## Overview

This guide helps diagnose and fix issues with notification sounds not playing when operators are assigned, reassigned, or removed from shipments.

---

## Quick Diagnostics Checklist

### Step 1: Open Browser Console

1. Open your browser's Developer Tools (F12 or right-click → Inspect)
2. Navigate to the "Console" tab
3. Clear any existing logs
4. Perform an action that should trigger a notification (assign/remove operator)

### Step 2: Check Console Logs

Look for these specific log messages:

**Expected Logs When Working:**
```
✅ Playing notification: operator_assigned, sound: tone-descending, volume: 100
✅ Audio Context state: suspended
✅ After resume - Audio Context state: running
✅ Successfully played sound: tone-descending
✅ Notification 'operator_assigned' played successfully
```

**Problem Indicators:**

**A. If you see:**
```
⚠️ Notification setting 'operator_assigned' not found
```
**Solution:** The notification settings are not loaded. Check database.

**B. If you see:**
```
ℹ️ Notification 'operator_assigned' is disabled
```
**Solution:** The notification is disabled in settings. Enable it in Notifications tab.

**C. If you see:**
```
❌ AudioContext not available
```
**Solution:** Your browser doesn't support Web Audio API (very rare).

**D. If you see:**
```
❌ Audio Context state: suspended
❌ After resume - Audio Context state: suspended
```
**Solution:** AudioContext is blocked. Need user interaction to activate.

**E. If you see:**
```
❌ Failed to play notification 'operator_assigned': Error: ...
```
**Solution:** Audio playback failed. See error details.

---

## Common Issues and Solutions

### Issue 1: AudioContext Remains Suspended

**Cause:** Modern browsers block audio until the user interacts with the page.

**Solution:**

**Option A: Click Anywhere First**
1. After loading the page, click ANYWHERE on the page first
2. This activates the AudioContext
3. Then try assigning/removing operators

**Option B: Test Sound Button (Recommended)**
Add a test button to manually trigger audio and activate the context.

Go to **Admin Panel → Notifications** tab and click "Test Sound" for any notification type. This will:
- Activate the AudioContext
- Test if audio is working
- Confirm settings are correct

### Issue 2: No Console Logs at All

**Cause:** Notification service not calling the audio functions.

**Diagnosis Steps:**

1. **Check if notification service is initialized:**
   - Open Console
   - Type: `window.location.reload()` and press Enter
   - Look for initialization logs when page loads

2. **Check if the code is being executed:**
   - When you assign an operator, do you see ANY console logs?
   - If NO logs at all, the function might not be called

3. **Check browser network tab:**
   - Is the database reachable?
   - Are there any failed API calls?

**Solution:**
- Ensure you're on the latest build
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue 3: Settings Not Found

**Cause:** Database notification settings are missing.

**Solution:**

Run this SQL query in Supabase SQL Editor to verify settings exist:

```sql
SELECT setting_key, setting_value, description
FROM notification_settings
WHERE setting_key IN ('operator_assigned', 'operator_reassigned', 'operator_removed');
```

**Expected Result:** Should return 3 rows with these keys:
- `operator_assigned`
- `operator_reassigned`
- `operator_removed`

If no results, the settings are missing from the database. This should not happen as they're created by migration.

**To recreate settings manually:**

```sql
INSERT INTO notification_settings (setting_key, setting_value, description, category)
VALUES
  (
    'operator_assigned',
    '{"enabled": true, "soundType": "tone-descending", "volume": 100}',
    'Sound when operator is assigned',
    'operator'
  ),
  (
    'operator_reassigned',
    '{"enabled": true, "soundType": "beep-double", "volume": 100}',
    'Sound when operator is reassigned',
    'operator'
  ),
  (
    'operator_removed',
    '{"enabled": true, "soundType": "alert-warning", "volume": 100}',
    'Sound when operator is removed',
    'operator'
  )
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now();
```

### Issue 4: Sounds Play But Volume is Very Low

**Cause:** Master volume or notification volume is too low.

**Solution:**

1. Go to **Admin Panel → Notifications** tab
2. Check "Master Volume" slider - should be at least 50%
3. Check individual notification volume sliders
4. Try setting all to 100% for testing

### Issue 5: StackBlitz/Bolt.new Specific Issues

**Note:** The log file you provided shows many network errors. These are StackBlitz environment issues, NOT your app.

**Common StackBlitz Audio Issues:**

**A. AudioContext Suspended:**
In StackBlitz preview, the AudioContext might be more aggressively suspended.

**Workaround:**
1. Click inside the preview iframe first
2. Then perform actions
3. Or use the "Open in New Tab" option to run the app outside the iframe

**B. Cross-Origin Issues:**
If the app is in an iframe, audio might be blocked by browser security.

**Solution:**
- Click "Open in New Tab" button in StackBlitz
- Test in the standalone window

**C. Service Worker Issues:**
The StackBlitz environment might cache old code.

**Solution:**
1. Open DevTools → Application tab
2. Click "Service Workers"
3. Click "Unregister" for any service workers
4. Hard refresh (Ctrl+Shift+R)

---

## Testing Procedure

### Manual Test (After Implementing Fixes)

1. **Initial Setup:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Clear all logs

2. **Activate Audio Context:**
   - Click anywhere on the page
   - Or click a "Test Sound" button if available

3. **Test Operator Assignment:**
   - Create a new shipment and assign an operator
   - **Expected:** Hear a descending tone sound
   - **Check Console:** Should show success logs

4. **Test Operator Removal:**
   - Edit an existing shipment and remove an operator
   - **Expected:** Hear a warning alert sound
   - **Check Console:** Should show success logs

5. **Test Operator Reassignment:**
   - Edit a shipment, keep operators the same, but change the title
   - **Expected:** Hear a double beep sound
   - **Check Console:** Should show success logs

---

## Advanced Debugging

### Check AudioContext State Manually

Open Console and run:

```javascript
// Check if AudioContext exists
console.log('AudioContext available:', 'AudioContext' in window);

// Create a test context
const testContext = new AudioContext();
console.log('Test AudioContext state:', testContext.state);

// Try to resume it
testContext.resume().then(() => {
  console.log('Test AudioContext resumed:', testContext.state);
});
```

**Expected Output:**
```
AudioContext available: true
Test AudioContext state: suspended
Test AudioContext resumed: running
```

### Test Audio Service Directly

Open Console and run:

```javascript
// Import audio service (in browser console, you need to access it from window)
// Create a test sound
const audioCtx = new AudioContext();
await audioCtx.resume();

const oscillator = audioCtx.createOscillator();
const gainNode = audioCtx.createGain();

oscillator.connect(gainNode);
gainNode.connect(audioCtx.destination);

oscillator.frequency.value = 440; // A4 note
oscillator.type = 'sine';

gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);

oscillator.start();
oscillator.stop(audioCtx.currentTime + 0.5);

// You should hear a beep
```

If this test works, the browser audio is functioning, and the issue is in the service integration.

---

## Browser Compatibility

### Supported Browsers

✅ **Chrome/Edge:** Full support
✅ **Firefox:** Full support
✅ **Safari:** Full support (requires user interaction)
✅ **Opera:** Full support

### Known Browser Issues

**Safari on iOS:**
- AudioContext is more strictly suspended
- MUST have user interaction first
- Some older iOS versions have limitations

**Firefox:**
- Usually works well
- Check "Autoplay" settings in browser preferences

**Chrome:**
- Autoplay policy may block audio
- Check chrome://settings/content/sound

---

## Code Flow for Notifications

Understanding the flow helps debug:

```
User Action (Assign Operator)
    ↓
ShipmentsTab.tsx → updateShipment() / createShipment()
    ↓
notificationService.notifyOperatorAssigned()
    ↓
notificationService.playNotification('operator_assigned')
    ↓
Check if setting exists and is enabled
    ↓
audioService.playSound(soundType, volume)
    ↓
Resume AudioContext if suspended
    ↓
Create oscillators and play sound
    ↓
Sound plays! 🎵
```

**Each step logs to console. Check which step fails.**

---

## Recent Changes Made

### Enhanced Logging

Added comprehensive console logging at each step:

**File:** `src/services/notificationService.ts`
- Line 79: Warning if setting not found
- Line 84: Info if notification disabled
- Line 89: Log when playing notification
- Line 93: Success confirmation
- Line 95: Error details if failed

**File:** `src/services/audioNotifications.ts`
- Line 142: Error if AudioContext unavailable
- Line 146: Log AudioContext state before resume
- Line 150: Log AudioContext state after resume
- Line 165: Success confirmation
- Line 167: Error details if failed

### Testing in Production

Once you deploy to production:

1. Notifications should work more reliably
2. No iframe restrictions
3. Better audio context management
4. Clearer error messages

---

## Quick Fixes to Try Right Now

### Fix 1: Click Test (Simplest)

1. Load the app
2. Click ANYWHERE on the page first
3. Then try assigning/removing operators

**Why this works:** Activates the AudioContext.

### Fix 2: Check Settings

1. Go to Admin Panel → Notifications
2. Verify all operator notifications are enabled
3. Set volume to 100%
4. Test each sound using the test buttons

### Fix 3: Clear Cache

1. Press Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
2. Select "Cached images and files"
3. Click "Clear data"
4. Reload page

### Fix 4: Try Different Browser

1. Open in Chrome (if you were using Firefox)
2. Or vice versa
3. Test if sounds work in a different browser

---

## Still Not Working?

If after all these steps sounds still don't play:

### Collect Debug Information

1. **Browser:** What browser and version?
2. **Console Logs:** Copy all console logs when trying to play sound
3. **Network Tab:** Any failed requests?
4. **Settings Check:** Run the SQL query to verify settings exist
5. **AudioContext Test:** Run the manual AudioContext test above

### Workaround: Use Browser Notifications

If audio absolutely won't work, you could implement browser notifications instead:

```javascript
// Request permission
Notification.requestPermission();

// Show notification
new Notification('Operator Assigned', {
  body: 'John Doe has been assigned to Delivery #123',
  icon: '/icon.png'
});
```

---

## Summary

**Most likely causes:**
1. ✅ AudioContext suspended (need user click)
2. ✅ StackBlitz iframe blocking audio
3. ✅ Browser cache showing old code

**Quick solutions:**
1. Click anywhere on page before testing
2. Open in new tab (outside iframe)
3. Clear cache and hard refresh

**With the new logging:**
Check browser console for detailed messages about what's happening at each step.

---

## Next Steps

1. **Try the Quick Fixes** above
2. **Check the Console Logs** to see which step fails
3. **Report back** with:
   - Which browser you're using
   - What console logs you see
   - Whether clicking first helps

The enhanced logging will tell us exactly where the issue is!
