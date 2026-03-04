# Deviation Button Usage Guide

## Where to Find Deviation Buttons

### 1. **In the Completion Modal**

When you click "Complete" on a shipment, you'll see deviation buttons in TWO places:

#### A. Adding New Packages Section
At the top of the modal, when you add new packages:

```
Add/Remove Packages
┌─────────────────────────────────────┐
│ Enter SSCC...          [+ Add]      │
│                                     │
│ 2 packages added    1 with deviation│
│ ┌─────────────────────────────┐    │
│ │ [⚠️ Has Issue] Package 1  [X]│    │
│ │ [    OK     ] Package 2  [X]│    │
│ └─────────────────────────────┘    │
│                                     │
│ [Save 2 New Packages]              │
└─────────────────────────────────────┘
```

**Features:**
- Click "OK" button to toggle to "Has Issue"
- Click "Has Issue" to toggle back to "OK"
- Orange highlighting when package has issue
- Counter shows how many packages flagged
- Save packages before completing

#### B. Existing Packages Storage Locations Section
Below the new packages section, for packages already in the system:

```
Packages Storage Locations *
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ 📦 Package 1  [⚠️ Has Issue]  [X]  │ │
│ │ [Warehouse A, Bay 12__________]     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📦 Package 2  [    OK     ]  [X]   │ │
│ │ [e.g., Warehouse A, Bay 12____]    │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Features:**
- Each package has a deviation toggle button
- Button appears next to package name
- Click to toggle between "OK" and "Has Issue"
- Entire package box turns orange when flagged
- Must still enter storage location for all packages

## How Deviation Buttons Work

### Visual States

**Normal Package (OK):**
- Button: Gray background `[OK]`
- Icon: Gray warning triangle (⚠️)
- Package background: White
- Package border: Gray

**Package with Issue (Has Deviation):**
- Button: Orange background `[Has Issue]`
- Icon: Orange warning triangle (⚠️)
- Package background: Light orange
- Package border: Orange
- Package text: Dark orange

### What Happens When You Flag a Package

1. **Click the button** next to any package
2. **Visual feedback:**
   - Button changes from "OK" to "Has Issue"
   - Colors change to orange
   - Counter updates (if in new packages section)

3. **When you complete the shipment:**
   - Package gets marked with `has_deviation = true` in database
   - Deviation record automatically created
   - Deviation appears in "Deviations" tab
   - Status: "open"
   - Priority: "medium"
   - Type: "missing_from_booking" (default)

4. **Deviation record includes:**
   - Package SSCC number
   - Shipment it came with
   - All other packages in that shipment
   - Storage location
   - Who reported it
   - Timestamp

## Step-by-Step Usage

### Scenario: Completing a Shipment with a Missing Package

**Step 1:** Click "Complete" on shipment
```
[Complete Shipment] button clicked
```

**Step 2:** Add all packages (including missing one)
```
Add/Remove Packages section:
1. Type: "Package1" → Click "Add"
2. Type: "Package2" → Click "Add"
3. Type: "Package3" → Click "Add"
4. Type: "Package4" → Click "Add"
5. Type: "Package5" → Click "Add" ← This one is missing from booking
```

**Step 3:** Flag Package 5 as having an issue
```
Click the [OK] button next to Package5
→ Button changes to [Has Issue]
→ Package5 box turns orange
→ Counter shows "1 with deviation"
```

**Step 4:** Save new packages
```
Click [Save 5 New Packages]
→ Packages move to "Storage Locations" section
→ Package5 still shows orange with [Has Issue] button
```

**Step 5:** Enter storage locations for all packages
```
Package1: "Warehouse A, Bay 1"
Package2: "Warehouse A, Bay 2"
Package3: "Warehouse A, Bay 3"
Package4: "Warehouse A, Bay 4"
Package5: "Warehouse A, Bay 5" ← Still flagged with issue
```

**Step 6:** Select operators and complete
```
Select operators
Click [Complete Shipment]
```

**Step 7:** Check Deviations tab
```
Navigate to: Operations → Deviations
See: New deviation for Package5
Status: Open
Priority: Medium
Description: "Package Package5 flagged with issue during completion. Location: Warehouse A, Bay 5"
```

## Viewing and Managing Deviations

### Deviations Dashboard

Navigate to: **Operations → Deviations**

```
Package Deviations
Track and resolve package discrepancies

┌─────────┬─────────┬──────────┬───────────┬──────────┐
│  Total  │  Open   │In Progress│ Escalated │ Resolved │
│   15    │    5    │     3     │     2     │    5     │
└─────────┴─────────┴──────────┴───────────┴──────────┘

Filters:
Status: [All Statuses ▼]
Priority: [All Priorities ▼]

┌────────────────────────────────────────────────────┐
│ [▼] 🔴 OPEN  🟡 MEDIUM  Missing from Booking      │
│                                                    │
│     📦 Package5 • Testing Shipment                │
│     Package Package5 flagged with issue during... │
│                                                    │
│     👤 Reported by: John Doe                      │
│     📅 04 Mar 2026, 15:30                         │
│     📦 5 packages in shipment                     │
│                                                    │
│                          [View Details]           │
└────────────────────────────────────────────────────┘
```

### Deviation Details Modal

Click **[View Details]** on any deviation:

```
Deviation Details                                [X]
├─ Package SSCC: Package5
├─ Shipment: Testing Shipment
├─ Status: OPEN
├─ Priority: MEDIUM
└─ Description: Package Package5 flagged with issue...

📦 All Packages in This Delivery (5)
┌──────────────────────────────────────────┐
│ Package1    │ Warehouse A, Bay 1  │ ✅  │
│ Package2    │ Warehouse A, Bay 2  │ ✅  │
│ Package3    │ Warehouse A, Bay 3  │ ✅  │
│ Package4    │ Warehouse A, Bay 4  │ ✅  │
│ ⚠️ Package5  │ Warehouse A, Bay 5  │ ⚠️  │
└──────────────────────────────────────────┘

Resolve Deviation
┌────────────────────────────────────────┐
│ Enter resolution notes...              │
│                                        │
│                                        │
│ [Mark as Resolved]                     │
└────────────────────────────────────────┘

📝 History
├─ 04 Mar 2026, 15:30  Created  Deviation reported
└─ [Add Comment field and Send button]
```

## Troubleshooting

### "I don't see the deviation button"

**Check:**
1. Are you in the **Complete Shipment** modal?
2. Look for buttons next to each package name
3. Should say "[OK]" or "[Has Issue]"
4. Located between package name and [X] remove button

**If still not visible:**
- Refresh the page
- Try adding a new package
- Check browser console for errors

### "Button is there but doesn't toggle"

**Try:**
1. Click directly on the button text
2. Wait 1 second and try again
3. Check if you have internet connection
4. Refresh the page

### "Deviation not appearing in Deviations tab"

**Verify:**
1. Did you complete the shipment? (not just flag the package)
2. Check "All Statuses" filter is selected
3. Try refreshing the Deviations tab
4. Check if deviation was actually saved (check database)

### "Can't enter storage location for flagged package"

**Solution:**
- You CAN and MUST still enter storage locations
- Flagging a package as having an issue doesn't prevent you from entering location
- The storage location field is still required
- Orange highlighting is just visual feedback

## Best Practices

### When to Flag a Package

✅ **DO flag packages when:**
- Package is missing from booking system
- Package arrives damaged
- Wrong quantity of items in package
- Package in incorrect storage location
- Any discrepancy during delivery processing

❌ **DON'T flag packages when:**
- Everything is normal
- Minor cosmetic issues
- Already documented elsewhere
- Testing (unless intentional test data)

### After Flagging

1. **Still enter the storage location** - Required for all packages
2. **Complete the shipment normally** - Flagging doesn't block completion
3. **Check Deviations tab** - Verify deviation was created
4. **Follow up** - Assign to appropriate person or escalate if urgent

### Resolution Workflow

1. **Open deviation** in Deviations tab
2. **Review context** - See all packages in delivery
3. **Investigate** - Add comments as you investigate
4. **Update status** - Change to "In Progress" while working
5. **Resolve** - Enter resolution notes and mark as resolved
6. **Document** - Notes are saved for future reference

## Technical Details

### What Gets Stored

**When you flag a package:**

Database: `packages` table
```sql
has_deviation = true
deviation_notes = 'Package flagged during completion'
```

Database: `package_deviations` table
```sql
id = <generated uuid>
package_id = <package uuid>
shipment_id = <shipment uuid>
deviation_type = 'missing_from_booking'
description = 'Package X flagged with issue during completion...'
status = 'open'
priority = 'medium'
reported_by = <current user id>
created_at = <timestamp>
```

Database: `deviation_history` table
```sql
deviation_id = <deviation uuid>
action_type = 'created'
action_by = <current user id>
new_value = {"deviation_type": "missing_from_booking", "priority": "medium"}
comment = 'Deviation reported'
created_at = <timestamp>
```

### Button Implementation

The button is rendered by `PackageManager` component with `enableDeviationTracking={true}`:

```tsx
<button
  type="button"
  onClick={() => toggleDeviation(pkg)}
  className={hasDeviation
    ? 'bg-orange-100 text-orange-700'
    : 'bg-slate-100 text-slate-600'
  }
>
  <AlertTriangle className={hasDeviation ? 'text-orange-600' : 'text-slate-400'} />
  {hasDeviation ? 'Has Issue' : 'OK'}
</button>
```

## Summary

**Location:** Complete Shipment Modal
**Sections:**
- New packages (when adding)
- Existing packages (storage locations)

**Button:** `[OK]` / `[Has Issue]`
**Position:** Next to package name
**Action:** Click to toggle deviation status
**Visual:** Orange highlighting when flagged
**Result:** Deviation created when shipment completed

**Access deviations:** Operations → Deviations tab

**For support:** See DEVIATION_TRACKING_SYSTEM.md for complete technical documentation
