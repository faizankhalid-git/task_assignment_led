# Package Search and Details Guide

## Overview

The Package Search feature provides a powerful way to search for any package by its SSCC number and view comprehensive details including storage location, deviation status, shipment information, and complete history.

## Accessing Package Search

### Navigation
1. Log into the admin panel
2. Click **Operations** dropdown in the navigation
3. Select **Package Search**

Or use the quick icon: **🔍 Package Search** in the Operations menu

## How to Search for Packages

### Search Interface

```
┌────────────────────────────────────────────────┐
│ Package Search                                 │
│                                                │
│ 🔍 [Search by SSCC number____________] [Search]│
│                                                │
└────────────────────────────────────────────────┘
```

### Steps to Search

1. **Enter SSCC Number**
   - Type the full or partial SSCC number
   - Example: "HU6827" or just "6827"
   - Search is case-insensitive

2. **Click Search or Press Enter**
   - Click the blue "Search" button
   - Or press Enter key in the search field

3. **View Results**
   - Up to 20 matching packages will be displayed
   - Results are sorted by newest first

### Search Results Display

```
Found 3 packages
┌────────────────────────────────────────────────┐
│ 📦 HU6827  [Has Issue]                         │
│ Testing Shipment                        stored │
│ Location: Warehouse A, Bay 12         04 Mar  │
├────────────────────────────────────────────────┤
│ 📦 HU6828                                      │
│ Testing Shipment                        stored │
│ Location: Warehouse A, Bay 13         04 Mar  │
├────────────────────────────────────────────────┤
│ 📦 HU6829  [Has Issue]                         │
│ Morning Delivery                      pending  │
│ Location: Warehouse B, Bay 5          03 Mar  │
└────────────────────────────────────────────────┘
```

**Each result shows:**
- Package SSCC number
- "Has Issue" badge if deviation flagged
- Associated shipment title
- Current status (stored, pending, etc.)
- Storage location (if recorded)
- Date added to system

## Package Details Modal

### Opening Details

Click on any package in the search results to open the comprehensive details modal.

### Information Displayed

#### 1. Package Information Section
```
┌─────────────────────────────────────┐
│ 📦 Package Information              │
├─────────────────────────────────────┤
│ SSCC Number:        HU6827          │
│ Status:             ✅ Stored       │
│ Has Issues:         Yes             │
│ Created:            04 Mar 15:30    │
│ Last Updated:       04 Mar 16:45    │
└─────────────────────────────────────┘
```

Shows:
- Full SSCC number
- Current status with icon
- Whether package has reported issues
- Creation timestamp
- Last update timestamp

#### 2. Storage Location Section
```
┌─────────────────────────────────────┐
│ 📍 Storage Location                 │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Warehouse A, Bay 12             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

Shows:
- Exact storage location
- Highlighted in blue box
- Shows "No storage location recorded" if not set

#### 3. Shipment Details Section
```
┌─────────────────────────────────────────────┐
│ 🚚 Shipment Details                         │
├─────────────────────────────────────────────┤
│ Shipment Title:      Testing Shipment       │
│ Vehicle Reg:         ABC123                 │
│ Shipment Status:     [completed]            │
│ Delivery Date:       📅 04 Mar 2026         │
│                                             │
│ 👥 Assigned Operators                       │
│ [John Doe] [Jane Smith] [Bob Wilson]       │
│                                             │
│ Completed At:        🕐 04 Mar 2026, 16:45  │
└─────────────────────────────────────────────┘
```

Shows:
- Shipment title
- Vehicle registration number
- Shipment status (completed, in progress, pending)
- Delivery date
- All assigned operators
- Completion timestamp (if completed)

#### 4. Deviation Details (If Package Has Issues)
```
┌──────────────────────────────────────────────┐
│ ⚠️ Deviation Reported                        │
├──────────────────────────────────────────────┤
│ [OPEN] [MEDIUM PRIORITY] [Missing Items]    │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Description                              │ │
│ │ Box damaged on left side, contents       │ │
│ │ intact                                   │ │
│ │                                          │ │
│ │ Details: Package HU6827 flagged with     │ │
│ │ issue during completion. Location:       │ │
│ │ Warehouse A, Bay 12                      │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Reported:  04 Mar 2026, 15:30               │
│ Resolved:  05 Mar 2026, 09:15               │
└──────────────────────────────────────────────┘
```

Shows (if package has deviation):
- Status badge (OPEN, IN PROGRESS, ESCALATED, RESOLVED)
- Priority badge (HIGH, MEDIUM, LOW)
- Deviation type (Missing Items, Damaged, Wrong Location, etc.)
- **Full user-provided description** from when issue was reported
- System-generated details
- When issue was reported
- When issue was resolved (if applicable)

#### 5. All Packages in Shipment Section
```
┌─────────────────────────────────────────────┐
│ 🕐 All Packages in This Shipment (5)       │
├─────────────────────────────────────────────┤
│ 📦 HU6827 (Current) ⚠️   Warehouse A, Bay 12│
│ 📦 HU6828              Warehouse A, Bay 13  │
│ 📦 HU6829 ⚠️           Warehouse B, Bay 5   │
│ 📦 HU6830              Warehouse B, Bay 6   │
│ 📦 HU6831              No location          │
└─────────────────────────────────────────────┘
```

Shows:
- All packages that arrived in same shipment
- Current package highlighted in blue
- Warning icon for packages with issues
- Storage location for each package
- Quick overview of entire delivery

## Search Tips

### Exact Match
```
Search: HU6827
Results: Only packages with "HU6827" in SSCC number
```

### Partial Match
```
Search: 6827
Results: HU6827, ABC6827, XYZ6827, etc.
```

### Case Insensitive
```
Search: hu6827  (lowercase)
Results: HU6827, Hu6827, HU6827 (all variants)
```

### Multiple Results
- System shows up to 20 most recent matches
- Results sorted by creation date (newest first)
- If you get too many results, be more specific

## Use Cases

### 1. Quick Location Lookup
**Scenario:** Need to find where a package is stored

**Steps:**
1. Navigate to Package Search
2. Enter SSCC number
3. See location in search results or click for details
4. Location displayed prominently

### 2. Deviation Investigation
**Scenario:** Customer reports an issue with their package

**Steps:**
1. Search for package by SSCC
2. Click package to view details
3. Check "Deviation Details" section
4. Read user-provided description of the issue
5. See current status (resolved/open/in progress)
6. Review all other packages in same shipment for patterns

### 3. Shipment Verification
**Scenario:** Verify all packages in a shipment were processed correctly

**Steps:**
1. Search for any package from the shipment
2. Click to view details
3. Scroll to "All Packages in This Shipment"
4. See complete list with locations and issue flags
5. Verify all have storage locations
6. Check for any deviation markers

### 4. Operator Performance
**Scenario:** Check which operators handled a specific package

**Steps:**
1. Search for package
2. View details
3. Check "Assigned Operators" section
4. See all operators who worked on the shipment
5. Cross-reference with completion time

### 5. Historical Tracking
**Scenario:** Track when package entered and moved through system

**Steps:**
1. Search for package
2. View details
3. Check creation timestamp
4. Check last updated timestamp
5. Review shipment completion time
6. Full timeline of package journey

## Status Indicators

### Package Status
- ✅ **Stored** - Package successfully stored in warehouse
- ⭕ **Pending** - Package received but not yet stored
- ❌ **Other** - Custom status

### Shipment Status
- 🟢 **Completed** - Shipment fully processed
- 🔵 **In Progress** - Currently being processed
- 🟡 **Pending** - Scheduled but not started

### Deviation Status
- 🟠 **OPEN** - Issue reported, needs attention
- 🔵 **IN PROGRESS** - Being investigated/resolved
- 🔴 **ESCALATED** - Requires urgent attention
- 🟢 **RESOLVED** - Issue has been resolved

### Priority Levels
- 🔴 **HIGH** - Critical issues requiring immediate action
- 🟠 **MEDIUM** - Standard issues requiring attention
- 🟡 **LOW** - Minor issues, low urgency

## What Information You Can Find

### About the Package
- Unique SSCC identifier
- Current location in warehouse
- Storage status
- When it arrived
- Last time it was updated
- Whether it has any issues

### About Issues/Deviations
- What issue was reported
- **Operator's description** of the problem (e.g., "Box damaged", "Missing items")
- When issue was discovered
- Current resolution status
- Priority level
- Type of deviation

### About the Delivery
- Which shipment it arrived with
- Vehicle that delivered it
- Delivery date
- All operators who handled it
- When processing was completed

### About Related Packages
- All other packages in same delivery
- Their locations
- Whether they have issues too
- Complete shipment overview

## Benefits

### For Warehouse Staff
- Instantly find any package location
- No need to remember or search through spreadsheets
- Quick access to all package details
- See related packages at a glance

### For Supervisors
- Track package movement through system
- Monitor deviation status
- Verify operator assignments
- Audit shipment completeness

### For Customer Service
- Answer customer inquiries immediately
- Provide accurate location information
- Explain any issues with the package
- Show resolution status

### For Quality Control
- Identify patterns in deviations
- Check if related packages have same issues
- Verify proper storage procedures
- Track resolution times

## Keyboard Shortcuts

- **Enter** - Execute search from search field
- **Esc** - Close package details modal (when focused)
- **Click outside** - Close package details modal

## Performance

- Search is optimized for speed
- Results appear in under 1 second
- Shows up to 20 most relevant results
- Full details load on demand

## Data Accuracy

All information is pulled directly from the database in real-time:
- No cached or stale data
- Always shows current status
- Reflects latest updates immediately
- Changes are visible instantly

## Mobile Friendly

The package search interface is fully responsive:
- Works on tablets and smartphones
- Touch-friendly buttons and interactions
- Scrollable results and details
- Optimized for smaller screens

## Troubleshooting

### No Results Found
**Possible causes:**
- SSCC number doesn't exist
- Typo in search term
- Package not yet added to system

**Solutions:**
- Double-check SSCC number
- Try partial search (fewer characters)
- Verify package was received and entered

### Can't See Details
**Possible causes:**
- Modal blocked by browser
- JavaScript error
- Network issue

**Solutions:**
- Refresh the page
- Check browser console for errors
- Verify internet connection

### Missing Information
**Possible causes:**
- Package not fully processed
- Storage location not entered
- Shipment not completed

**Solutions:**
- Check package status (may be "pending")
- Verify completion process was finished
- Contact admin if data is missing

## Privacy and Security

- Only users with "shipments" permission can search packages
- All searches are logged in audit trail
- Personal data is protected
- Access controlled by role

## Future Enhancements

Potential upcoming features:
- Export search results to CSV
- Advanced filtering (by date, status, location)
- Barcode scanner integration
- Package history timeline
- Related shipments view
- Performance metrics per package

## Summary

The Package Search feature provides comprehensive package information in seconds:

1. **Quick Search** - Enter SSCC, get results instantly
2. **Detailed View** - Click any result for full information
3. **Complete Context** - See package, shipment, location, issues, and related packages
4. **Real-Time Data** - Always current and accurate
5. **User Descriptions** - Read operator notes about issues
6. **Full History** - Track package journey through system

Access it anytime from **Operations → Package Search** in the admin panel.
