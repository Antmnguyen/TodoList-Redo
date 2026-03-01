// app/theme/tokens.ts
// =============================================================================
// COLOUR PALETTES
// =============================================================================
//
// Two palettes — same keys, different values.
// Components import AppTheme and access colours by token name, never by
// hardcoded hex. Swapping the active palette is a single context change.
//
// NOTE: header brand colours (headerTasks, headerToday, etc.) are intentionally
// identical in both palettes — they are identity colours, not semantic surfaces.
// =============================================================================

export const lightTheme = {
  // ── Backgrounds ────────────────────────────────────────────────────────────
  bgScreen:   '#f5f5f5',   // page background (between cards)
  bgCard:     '#ffffff',   // white card / list row
  bgModal:    '#f5f5f5',   // modal sheet background
  bgInput:    '#f0f0f0',   // input field background
  bgSection:  '#ffffff',   // form section card

  // ── Brand header colours (same in light + dark — identity, not surface) ────
  headerTasks:  '#007AFF',
  headerToday:  '#34C759',
  headerStats:  '#FF9500',
  headerBrowse: '#5856D6',

  // ── Text ───────────────────────────────────────────────────────────────────
  textPrimary:   '#000000',
  textSecondary: '#666666',
  textTertiary:  '#888888',
  textDisabled:  '#bbbbbb',
  textOnHeader:  '#ffffff',
  textOnAccent:  '#ffffff',

  // ── Interactive ─────────────────────────────────────────────────────────────
  accent:          '#007AFF',
  accentPermanent: '#5856D6',
  danger:          '#FF3B30',

  // ── Borders / Separators ────────────────────────────────────────────────────
  border:     '#dddddd',
  separator:  '#f0f0f0',
  hairline:   '#cccccc',

  // ── Task Card ───────────────────────────────────────────────────────────────
  checkboxBorderOneOff:    '#007AFF',
  checkboxFillOneOff:      '#007AFF',
  checkboxBorderPermanent: '#5856D6',
  checkboxFillPermanent:   '#5856D6',
  completedText:           '#999999',

  // ── Misc ────────────────────────────────────────────────────────────────────
  categoryStripNone: '#e0e0e0',   // colour strip when task has no category
  tabBarBg:          '#ffffff',
  tabBarBorder:      '#e0e0e0',
  tabBarActive:      '#007AFF',
  tabBarInactive:    '#8e8e93',
  tabBarActiveBg:    'rgba(0,122,255,0.08)',
};

export const darkTheme: typeof lightTheme = {
  bgScreen:   '#1c1c1e',
  bgCard:     '#2c2c2e',
  bgModal:    '#1c1c1e',
  bgInput:    '#3a3a3c',
  bgSection:  '#2c2c2e',

  headerTasks:  '#007AFF',
  headerToday:  '#34C759',
  headerStats:  '#FF9500',
  headerBrowse: '#5856D6',

  textPrimary:   '#ffffff',
  textSecondary: '#ababab',
  textTertiary:  '#888888',
  textDisabled:  '#555555',
  textOnHeader:  '#ffffff',
  textOnAccent:  '#ffffff',

  accent:          '#0a84ff',
  accentPermanent: '#6e6cd8',
  danger:          '#ff453a',

  border:     '#3a3a3c',
  separator:  '#3a3a3c',
  hairline:   '#444446',

  checkboxBorderOneOff:    '#0a84ff',
  checkboxFillOneOff:      '#0a84ff',
  checkboxBorderPermanent: '#6e6cd8',
  checkboxFillPermanent:   '#6e6cd8',
  completedText:           '#555555',

  categoryStripNone: '#444446',
  tabBarBg:          '#1c1c1e',
  tabBarBorder:      '#3a3a3c',
  tabBarActive:      '#0a84ff',
  tabBarInactive:    '#636366',
  tabBarActiveBg:    'rgba(10,132,255,0.12)',
};

export type AppTheme = typeof lightTheme;
