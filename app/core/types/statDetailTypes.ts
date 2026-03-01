// app/core/types/statDetailTypes.ts
// =============================================================================
// STAT DETAIL NAVIGATION TYPES
// =============================================================================
//
// Shared types for the stat detail overlay system.
//
// Why a separate file?
// --------------------
// Both MainNavigator (which renders the overlay) and the three detail screens
// (which receive params) need StatDetailParams. If each screen imported from
// MainNavigator, and MainNavigator imported from each screen, we'd have a
// circular dependency. Placing shared types here breaks that cycle cleanly.
//
// Consumers:
//   MainNavigator          — stores statDetailParams state, routes on type
//   StatsScreen            — callback prop type for onStatCardPress
//   PermanentDetailScreen  — reads params.id / params.name / params.color
//   CategoryDetailScreen   — same (Phase 5)
//   OverallDetailScreen    — same + reads params.initialTimeRange (Phase 5)
//
// =============================================================================

import { TimeRange } from '../../components/stats/detail/shared/TimeRangePicker';

/**
 * Parameters passed from StatsScreen → MainNavigator → the appropriate
 * detail screen when the user taps a StatPreviewCard.
 *
 * type:
 *   'template' → opens PermanentDetailScreen
 *   'category' → opens CategoryDetailScreen  (Phase 5)
 *   'all'      → opens OverallDetailScreen   (Phase 5)
 *
 * id:
 *   For 'template' cards: the template id string (e.g. 'tpl_morning').
 *   For 'category' cards: the category id string (e.g. 'cat_work').
 *   For 'all' cards: the overall bucket id (e.g. 'all_time', 'all_week').
 *
 * name:
 *   Human-readable label shown in the DetailHeader title bar.
 *
 * color:
 *   Hex accent color for the detail screen — comes from the StatPreviewCard
 *   so the detail screen uses the same color as the card that opened it.
 *
 * initialTimeRange:
 *   Only meaningful for OverallDetailScreen. Maps the overall card id to
 *   a TimeRange tab ('all_week' → 'week', 'all_month' → 'month', etc.)
 *   so the correct tab is pre-selected when the screen opens.
 *   Undefined for template and category screens.
 */
export interface StatDetailParams {
  type:               'all' | 'template' | 'category';
  id:                 string;
  name:               string;
  color:              string;
  initialTimeRange?:  TimeRange;
}
