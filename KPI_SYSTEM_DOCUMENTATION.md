# KPI Performance Tracking System Documentation

## Overview

The KPI (Key Performance Indicator) system provides comprehensive tracking and analysis of operator performance based on completed delivery tasks. The system uses an intensity-based scoring mechanism to fairly evaluate operator contributions and identify workload distribution patterns.

---

## Core Features

### 1. Intensity-Based Scoring

Each delivery task is assigned an intensity level that reflects its complexity and effort:

- **High Intensity**: 3 points per task
- **Medium Intensity**: 2 points per task (default)
- **Low Intensity**: 1 point per task

Operators accumulate points based on the intensity of completed deliveries, creating a fair and balanced performance metric.

### 2. Task Categorization

Tasks are automatically categorized based on their title prefix:

- **INCOMING**: Receiving/Intake tasks
- **OUTGOING**: Delivery/Dispatch tasks
- **OPI**: Operations/Processing tasks
- **DELIVERY**: General delivery tasks
- **PICKUP**: Pickup operations
- **WAREHOUSE**: Warehouse operations
- **SORTING**: Sorting operations
- **OTHER**: Unclassified tasks

This categorization enables:
- Tracking operator specialization
- Identifying skill gaps
- Ensuring balanced workload distribution
- Detecting repetitive task assignment patterns

### 3. Performance Dashboard

The dashboard provides three main views:

#### A. Rankings View
- Real-time operator rankings by total score
- Visual progress bars showing relative performance
- Detailed breakdowns of:
  - Total completed tasks
  - Total score
  - Average score per task
  - High/medium/low intensity task counts
  - Active days count
  - Category-specific performance

#### B. Categories View
- Aggregate statistics across all task categories
- Shows distribution of work across different task types
- Identifies which categories have the most activity
- Tracks operator coverage per category

#### C. Workload Balance View
- Identifies operators who haven't performed certain task categories
- Highlights potential skill gaps
- Helps ensure balanced training and experience
- Promotes equitable task distribution

---

## Database Architecture

### New Database Components

#### 1. Enum Type: `intensity_level`
```sql
CREATE TYPE intensity_level AS ENUM ('low', 'medium', 'high');
```

#### 2. Column: `shipments.intensity`
- Type: `intensity_level`
- Default: `'medium'`
- Purpose: Stores the task intensity for scoring

#### 3. Materialized View: `operator_performance_summary`
Aggregates core performance metrics per operator:
- Total completed tasks
- Total score
- Intensity breakdowns
- Activity dates
- Active days count

Automatically refreshes when deliveries are completed.

#### 4. View: `shipment_operator_assignments`
Helper view that unnests the `assigned_operators` array to create one row per operator-shipment pair. Essential for accurate performance calculations when multiple operators are assigned to a single task.

#### 5. View: `operator_task_distribution`
Shows task distribution by category for each operator:
- Task counts per category
- Category scores
- Average intensity per category
- Date ranges for each category

#### 6. View: `operator_rankings`
Ranks all operators by total score, includes:
- Ranking position
- All performance metrics
- Average score per task

#### 7. View: `operator_performance_detail`
Comprehensive view combining:
- Operator information
- Performance metrics
- Rankings
- Category breakdown (JSON format)

### Database Functions

#### 1. `get_task_category(title TEXT)`
Extracts task category from shipment title prefix.

**Returns**: Category name (e.g., 'INCOMING', 'OUTGOING', 'OPI')

#### 2. `refresh_operator_performance()`
Manually refreshes the materialized view.

**Usage**: Automatically triggered on task completion, can also be called manually.

#### 3. `can_view_kpi_data()`
Permission check function.

**Returns**: `true` if current user is admin or super_admin, `false` otherwise.

**Security**: Enforces access control for KPI data.

#### 4. `get_operator_performance(p_operator_id UUID)`
Returns detailed performance data for one or all operators.

**Parameters**:
- `p_operator_id` (optional): Specific operator ID, or NULL for all operators

**Returns**: Table with complete performance data including category breakdowns

**Access**: Admin/Super Admin only

#### 5. `get_category_statistics()`
Returns aggregate statistics across all task categories.

**Returns**: Table with category-level statistics

**Access**: Admin/Super Admin only

#### 6. `get_operators_missing_categories()`
Identifies operators who haven't completed certain task categories.

**Returns**: Table with operators and their missing/completed categories

**Access**: Admin/Super Admin only

---

## Frontend Components

### 1. KPI Service (`src/services/kpiService.ts`)

TypeScript service providing:
- API calls to database functions
- Type definitions for performance data
- Helper functions for intensity scoring
- Color coding utilities for categories and intensity levels

**Key Methods**:
- `getAllOperatorPerformance()`: Fetch all operator performance data
- `getOperatorPerformance(operatorId)`: Fetch specific operator data
- `getCategoryStatistics()`: Fetch category statistics
- `getOperatorsMissingCategories()`: Fetch workload balance data
- `refreshPerformanceMetrics()`: Manually refresh data

### 2. KPI Dashboard (`src/components/KPIDashboard.tsx`)

Main dashboard component featuring:
- Three-tab interface (Rankings, Categories, Workload Balance)
- Real-time data loading and refresh
- Expandable operator cards with detailed breakdowns
- Visual progress bars and color-coded indicators
- Summary statistics cards
- Responsive design for all screen sizes

**User Interactions**:
- Click operator card to expand/collapse details
- Switch between different views using tabs
- Refresh data using the refresh button
- View category-specific performance in expanded cards

### 3. Updated Shipments Tab (`src/components/ShipmentsTab.tsx`)

Enhanced with intensity selection:
- **Create Form**: Dropdown to select task intensity (Low/Medium/High)
- **Edit Form**: Ability to update task intensity
- Default intensity: Medium
- Clear labeling with point values shown
- Icon indicator (⚡ Zap icon) for visual identification

---

## Usage Guide

### For Administrators

#### Creating a Delivery with Intensity
1. Navigate to **Shipments** tab
2. Click **New Delivery**
3. Fill in delivery details
4. Select **Task Intensity** from dropdown:
   - Low (1 point) - Simple, routine tasks
   - Medium (2 points) - Standard deliveries (default)
   - High (3 points) - Complex, urgent, or challenging tasks
5. Assign operators
6. Create delivery

#### Viewing Performance Data
1. Navigate to **Performance KPIs** tab
2. View operator rankings in default **Rankings** view
3. Click any operator card to expand and see:
   - Intensity breakdown
   - Category-specific performance
   - Date ranges
4. Switch to **Categories** view to see task distribution
5. Switch to **Workload Balance** view to identify operators needing training

#### Interpreting Rankings
- **Rank #1**: Top performer (gold badge)
- **Ranks #2-3**: High performers (silver badge)
- **Lower ranks**: Opportunities for improvement or training

**Important**: Rankings should be used constructively to:
- Identify training needs
- Ensure fair task distribution
- Recognize top performers
- Balance workloads across the team

### For Operators

Operators can view their own performance (if permissions allow) to:
- Track personal progress
- See task category experience
- Identify areas for skill development
- Understand scoring methodology

---

## Scoring Methodology

### Points Calculation

Total Score = Σ (Task Intensity Points for all completed deliveries)

**Example**:
- Operator completes 5 high-intensity tasks: 5 × 3 = 15 points
- Operator completes 10 medium-intensity tasks: 10 × 2 = 20 points
- Operator completes 3 low-intensity tasks: 3 × 1 = 3 points
- **Total Score**: 15 + 20 + 3 = 38 points

### Average Score Per Task

Avg = Total Score / Total Completed Tasks

This metric helps normalize performance across operators with different task counts.

### Ranking Algorithm

Operators are ranked by:
1. **Primary**: Total Score (descending)
2. **Tiebreaker**: Total Completed Tasks (descending)

This ensures that:
- Quality (high-intensity tasks) is rewarded
- Quantity (task completion) is also valued
- Ties are broken fairly

---

## Best Practices

### Task Intensity Guidelines

**High Intensity (3 points)** - Use for:
- Urgent deliveries with tight deadlines
- Complex multi-package shipments
- Tasks requiring special handling or certifications
- High-value or fragile items
- Tasks involving difficult access or long distances

**Medium Intensity (2 points)** - Use for:
- Standard deliveries (default choice)
- Routine warehouse operations
- Regular sorting tasks
- Normal-complexity pickups

**Low Intensity (1 point)** - Use for:
- Simple, quick tasks
- Local deliveries with easy access
- Single-package movements
- Routine administrative tasks

### Fair Distribution Strategies

1. **Rotate Task Categories**: Ensure all operators experience different task types
2. **Balance Intensity**: Avoid assigning only high-intensity tasks to certain operators
3. **Monitor Missing Categories**: Use Workload Balance view to identify training opportunities
4. **Regular Reviews**: Check rankings monthly to identify trends
5. **Recognize Performance**: Use data to acknowledge top performers fairly

### Data Integrity

1. **Consistent Intensity Assignment**: Develop clear criteria for intensity levels
2. **Regular Audits**: Review intensity assignments for consistency
3. **Team Training**: Ensure all admins understand scoring methodology
4. **Document Special Cases**: Note reasons for unusual intensity selections

---

## Security & Permissions

### Access Control

- **KPI Data Access**: Admin and Super Admin roles only
- **Permission Required**: `shipments` permission
- **Database Enforcement**: RLS policies + function-level checks
- **Frontend Enforcement**: Tab visibility based on permissions

### Data Privacy

- Only aggregated, performance-related data is displayed
- Personal information is limited to names and IDs
- No sensitive operator data is exposed
- Audit trail maintained for all changes

---

## Technical Details

### Performance Optimizations

1. **Materialized View**: `operator_performance_summary` is materialized for fast queries
2. **Automatic Refresh**: Triggers update on task completion
3. **Concurrent Refresh**: Uses `CONCURRENTLY` to avoid locking
4. **Indexed Columns**: Performance metrics are indexed for fast sorting
5. **Efficient Joins**: Views use optimal join strategies

### Data Refresh Timing

- **Automatic**: When a delivery is marked as completed
- **Manual**: Via refresh button in dashboard
- **Latency**: Typically <1 second for refresh

### Scalability Considerations

- Materialized view handles thousands of completed tasks efficiently
- View-based architecture allows easy querying without performance impact
- Indexes optimize ranking queries
- JSON aggregation used for category breakdowns to minimize rows returned

---

## Troubleshooting

### Issue: Performance data not updating

**Solution**:
1. Click the **Refresh** button in the KPI dashboard
2. Check that deliveries are marked as **completed** (not just pending or in-progress)
3. Verify that the task has `is_delivery = true`
4. Check that operators are properly assigned

### Issue: Missing operators in rankings

**Possible Causes**:
- Operator has not completed any deliveries yet
- Completed tasks are not marked as deliveries (`is_delivery = false`)
- Tasks are not in completed status

**Solution**: Complete some deliveries assigned to that operator

### Issue: Incorrect scores

**Check**:
1. Verify intensity levels are set correctly on tasks
2. Confirm tasks are marked as completed
3. Check that `completed_at` timestamp is set
4. Manually refresh performance metrics
5. Review audit log for any data changes

### Issue: Permission denied error

**Solution**:
- Ensure user has admin or super_admin role
- Verify user has shipments permission
- Check user_profiles table for correct role assignment

---

## API Reference

### Frontend API (KPI Service)

```typescript
// Get all operator performance
const performance = await kpiService.getAllOperatorPerformance();

// Get specific operator performance
const operatorPerf = await kpiService.getOperatorPerformance(operatorId);

// Get category statistics
const categoryStats = await kpiService.getCategoryStatistics();

// Get operators missing categories
const missingCats = await kpiService.getOperatorsMissingCategories();

// Refresh performance metrics
await kpiService.refreshPerformanceMetrics();

// Helper functions
const points = kpiService.getIntensityPoints('high'); // Returns 3
const label = kpiService.getIntensityLabel('medium'); // Returns 'Medium'
const colorClass = kpiService.getIntensityColor('low'); // Returns CSS classes
```

### Database API (PostgreSQL Functions)

```sql
-- Get operator performance (all or specific)
SELECT * FROM get_operator_performance(NULL); -- All operators
SELECT * FROM get_operator_performance('uuid-here'); -- Specific operator

-- Get category statistics
SELECT * FROM get_category_statistics();

-- Get operators missing categories
SELECT * FROM get_operators_missing_categories();

-- Manually refresh materialized view
SELECT refresh_operator_performance();

-- Get task category from title
SELECT get_task_category('INCOMING SDE-CSP-048'); -- Returns 'INCOMING'
```

---

## Future Enhancements

Potential improvements for future versions:

1. **Time-Based Metrics**:
   - Weekly/monthly performance trends
   - Peak performance periods
   - Historical comparison charts

2. **Team Performance**:
   - Team-based rankings
   - Collaborative task scoring
   - Team goal tracking

3. **Advanced Analytics**:
   - Predictive performance modeling
   - Workload optimization suggestions
   - Efficiency metrics (time per task)

4. **Gamification**:
   - Achievement badges
   - Streak tracking
   - Milestone celebrations

5. **Reporting**:
   - Exportable performance reports
   - PDF/Excel generation
   - Email summaries

6. **Mobile Support**:
   - Mobile-optimized dashboard
   - Push notifications for rankings changes
   - Quick intensity selection

---

## Maintenance

### Regular Maintenance Tasks

1. **Monthly**: Review intensity assignment consistency
2. **Quarterly**: Analyze category distribution patterns
3. **Annually**: Audit scoring methodology effectiveness
4. **As Needed**: Adjust intensity criteria based on feedback

### Data Cleanup

The system automatically handles:
- Archived task exclusion
- Inactive operator filtering
- Historical data retention

No manual cleanup required for normal operations.

---

## Support & Feedback

For questions, issues, or suggestions regarding the KPI system:

1. Check this documentation first
2. Review the troubleshooting section
3. Check the audit log for recent changes
4. Test with the refresh button
5. Review console logs for errors

---

## Version History

### Version 1.0.0 (Current)
- Initial KPI system implementation
- Intensity-based scoring
- Task categorization
- Performance dashboard with three views
- Database architecture with materialized views
- Automatic performance updates
- Permission-based access control

---

## Summary

The KPI Performance Tracking System provides a comprehensive, fair, and automated way to track operator performance. By combining intensity-based scoring with task categorization and visual dashboards, it helps management:

- **Make informed decisions** about workload distribution
- **Identify training opportunities** through category analysis
- **Recognize top performers** with objective data
- **Ensure fair evaluation** with transparent scoring
- **Balance workloads** across the team
- **Track progress** over time

The system is designed to be:
- **Automated**: Updates in real-time without manual intervention
- **Fair**: Balanced scoring that rewards both quality and quantity
- **Transparent**: Clear methodology visible to all stakeholders
- **Secure**: Permission-based access with audit trails
- **Scalable**: Efficient architecture that grows with your team

Use this system constructively to build a high-performing, well-balanced team!
