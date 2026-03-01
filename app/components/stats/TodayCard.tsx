// app/components/stats/TodayCard.tsx
// =============================================================================
// TODAY CARD
// =============================================================================
//
// Standalone card displayed at the top of StatsScreen showing a snapshot of
// today's productivity:
//
//   ┌─────────────────────────────────────────────────────┐
//   │ TODAY                              Tuesday, Feb 18  │
//   │                                                     │
//   │  [Ring]   8 done · 4 remaining       🔥 5-day      │
//   │   67%     of 12 tasks today                        │
//   │                                                     │
//   │  ████████████░░░░░░  67%  (progress bar)           │
//   │                                                     │
//   │  ┌──────────────┐  ┌──────────────┐                │
//   │  │ 🔁 Permanent │  │ 📝 One-off   │                │
//   │  │  75%  3 / 4  │  │  63%  5 / 8  │                │
//   │  └──────────────┘  └──────────────┘                │
//   │                                                     │
//   │  BY CATEGORY                                        │
//   │  ● Work     ████████░░  4/5  80%                    │
//   │  ● Health   ████░░░░░░  2/4  50%                    │
//   │  ● Lifestyle ███░░░░░░  2/3  67%                    │
//   └─────────────────────────────────────────────────────┘
//
// Replace getMockTodayStats() in StatsScreen with real data when backend ready.
//
// =============================================================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CircularProgress } from './CircularProgress';
import { safePct } from '../../core/utils/statUtils';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// =============================================================================
// TYPES  (exported — StatsScreen uses these)
// =============================================================================

export interface CategoryStat {
  name: string;
  color: string;   // hex accent color matching the category
  total: number;
  done: number;
}

export interface TodayStats {
  totalTasks: number;
  completedTasks: number;
  permanentTotal: number;
  permanentDone: number;
  oneOffTotal: number;
  oneOffDone: number;
  categories: CategoryStat[];
  streak: number;              // current consecutive-day streak
}

// =============================================================================
// HELPERS
// =============================================================================

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function formatDate(d: Date): string {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// =============================================================================
// LINEAR PROGRESS BAR
// =============================================================================

interface LinearBarProps {
  done: number;
  total: number;
  color: string;
  height?: number;
  borderRadius?: number;
}

const LinearBar: React.FC<LinearBarProps> = ({
  done,
  total,
  color,
  height = 8,
  borderRadius,
}) => {
  const { theme } = useTheme();
  const pct  = total > 0 ? Math.min(done / total, 1) : 0;
  const r    = borderRadius ?? height / 2;
  return (
    <View style={{ height, backgroundColor: theme.separator, borderRadius: r, overflow: 'hidden' }}>
      <View
        style={{
          width:           `${pct * 100}%`,
          height,
          backgroundColor: color,
          borderRadius:    r,
        }}
      />
    </View>
  );
};

// =============================================================================
// TYPE MINI CARD  (Permanent / One-off breakdown)
// =============================================================================

interface TypeMiniCardProps {
  emoji:  string;
  label:  string;
  done:   number;
  total:  number;
  color:  string;
}

const TypeMiniCard: React.FC<TypeMiniCardProps> = ({ emoji, label, done, total, color }) => {
  const { theme } = useTheme();
  const miniCard = useMemo(() => makeMiniCardStyles(theme), [theme]);
  const pct = safePct(done, total);

  return (
    <View style={[miniCard.box, { borderColor: color + '33' }]}>

      {/* Top row: emoji + % */}
      <View style={miniCard.topRow}>
        <Text style={miniCard.emoji}>{emoji}</Text>
        <Text style={[miniCard.pct, { color }]}>{pct}%</Text>
      </View>

      {/* Fraction */}
      <Text style={miniCard.fraction}>
        {done}
        <Text style={miniCard.fractionDenom}>/{total}</Text>
      </Text>
      <Text style={miniCard.label}>{label}</Text>

      {/* Mini bar */}
      <View style={{ marginTop: 10 }}>
        <LinearBar done={done} total={total} color={color} height={6} />
      </View>

    </View>
  );
};

// =============================================================================
// CATEGORY ROW
// =============================================================================

const CategoryRow: React.FC<{ cat: CategoryStat; isFirst: boolean }> = ({ cat, isFirst }) => {
  const { theme } = useTheme();
  const catRow = useMemo(() => makeCatRowStyles(theme), [theme]);
  const pct = safePct(cat.done, cat.total);

  return (
    <View style={[catRow.row, !isFirst && { marginTop: 13 }]}>
      {/* Colored dot */}
      <View style={[catRow.dot, { backgroundColor: cat.color }]} />

      {/* Name */}
      <Text style={catRow.name} numberOfLines={1}>{cat.name}</Text>

      {/* Progress bar */}
      <View style={catRow.barWrap}>
        <LinearBar done={cat.done} total={cat.total} color={cat.color} height={7} />
      </View>

      {/* Count */}
      <Text style={catRow.count}>{cat.done}/{cat.total}</Text>

      {/* % */}
      <Text style={[catRow.pct, { color: cat.color }]}>{pct}%</Text>
    </View>
  );
};

// =============================================================================
// TODAY CARD  (main export)
// =============================================================================

interface TodayCardProps {
  data: TodayStats;
}

const ACCENT = '#FF9500';

export const TodayCard: React.FC<TodayCardProps> = ({ data }) => {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const overallPct  = safePct(data.completedTasks, data.totalTasks);
  const remaining   = data.totalTasks - data.completedTasks;
  const today       = new Date();

  return (
    <View style={styles.card}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>TODAY</Text>
        <Text style={styles.headerDate}>{formatDate(today)}</Text>
      </View>

      {/* ── Hero: ring + summary text ────────────────────────────────────── */}
      <View style={styles.heroRow}>

        <CircularProgress
          percent={overallPct}
          size={108}
          color={ACCENT}
          trackWidth={10}
        />

        <View style={styles.heroInfo}>
          {/* Done */}
          <View style={styles.statLine}>
            <Text style={[styles.bigNum, { color: ACCENT }]}>{data.completedTasks}</Text>
            <Text style={styles.statSuffix}> done</Text>
          </View>

          {/* Remaining */}
          <View style={styles.statLine}>
            <Text style={styles.bigNum2}>{remaining}</Text>
            <Text style={styles.statSuffix}> left</Text>
          </View>

          {/* Total */}
          <Text style={styles.totalLabel}>of {data.totalTasks} tasks today</Text>

          {/* Streak pill */}
          {data.streak > 0 && (
            <View style={[styles.streakPill, { backgroundColor: isDark ? 'rgba(255,149,0,0.18)' : '#FFF3E0' }]}>
              <Text style={styles.streakText}>🔥 {data.streak}-day streak</Text>
            </View>
          )}
        </View>

      </View>

      {/* ── Main progress bar ────────────────────────────────────────────── */}
      <View style={styles.barRow}>
        <View style={{ flex: 1 }}>
          <LinearBar done={data.completedTasks} total={data.totalTasks} color={ACCENT} height={11} />
        </View>
        <Text style={[styles.barPct, { color: ACCENT }]}>{overallPct}%</Text>
      </View>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── Task type breakdown ──────────────────────────────────────────── */}
      <View style={styles.typeRow}>
        <TypeMiniCard
          emoji="🔁"
          label="Permanent"
          done={data.permanentDone}
          total={data.permanentTotal}
          color="#34C759"
        />
        <View style={{ width: 12 }} />
        <TypeMiniCard
          emoji="📝"
          label="One-off"
          done={data.oneOffDone}
          total={data.oneOffTotal}
          color="#007AFF"
        />
      </View>

      {/* ── Category breakdown ───────────────────────────────────────────── */}
      {data.categories.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>BY CATEGORY</Text>
          {data.categories.map((cat, i) => (
            <CategoryRow key={cat.name} cat={cat} isFirst={i === 0} />
          ))}
        </>
      )}

    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeMiniCardStyles(theme: AppTheme) {
  return StyleSheet.create({
    box: {
      flex:            1,
      backgroundColor: theme.bgSection,
      borderRadius:    14,
      borderWidth:     1,
      padding:         14,
    },
    topRow: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'center',
      marginBottom:   6,
    },
    emoji:    { fontSize: 20 },
    pct:      { fontSize: 13, fontWeight: '700' },
    fraction: { fontSize: 26, fontWeight: '800', color: theme.textPrimary, lineHeight: 30 },
    fractionDenom: { fontSize: 16, fontWeight: '500', color: theme.textDisabled },
    label:    { fontSize: 12, color: theme.textTertiary, fontWeight: '500', marginTop: 1 },
  });
}

function makeCatRowStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           8,
    },
    dot: {
      width:        9,
      height:       9,
      borderRadius: 5,
    },
    name: {
      width:      76,
      fontSize:   14,
      fontWeight: '600',
      color:      theme.textPrimary,
    },
    barWrap: { flex: 1 },
    count: {
      width:      34,
      fontSize:   13,
      color:      theme.textTertiary,
      fontWeight: '500',
      textAlign:  'right',
    },
    pct: {
      width:      38,
      fontSize:   13,
      fontWeight: '700',
      textAlign:  'right',
    },
  });
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.bgCard,
      borderRadius:    20,
      marginHorizontal: 16,
      marginBottom:    16,
      padding:         20,
      shadowColor:     '#000',
      shadowOffset:    { width: 0, height: 4 },
      shadowOpacity:   0.1,
      shadowRadius:    12,
      elevation:       5,
    },

    // Header
    headerRow: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'center',
      marginBottom:   20,
    },
    headerLabel: {
      fontSize:    13,
      fontWeight:  '800',
      color:       ACCENT,
      letterSpacing: 1.4,
    },
    headerDate: {
      fontSize:   13,
      color:      theme.textDisabled,
      fontWeight: '500',
    },

    // Hero
    heroRow: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           20,
      marginBottom:  18,
    },
    heroInfo: {
      flex: 1,
      gap:  3,
    },
    statLine: {
      flexDirection: 'row',
      alignItems:    'baseline',
    },
    bigNum: {
      fontSize:   28,
      fontWeight: '800',
      lineHeight: 32,
    },
    bigNum2: {
      fontSize:   28,
      fontWeight: '800',
      color:      theme.textPrimary,
      lineHeight: 32,
    },
    statSuffix: {
      fontSize:   15,
      color:      theme.textTertiary,
      fontWeight: '500',
    },
    totalLabel: {
      fontSize:   13,
      color:      theme.textDisabled,
      marginTop:  2,
    },
    streakPill: {
      marginTop:         10,
      alignSelf:         'flex-start',
      paddingHorizontal: 10,
      paddingVertical:   5,
      borderRadius:      20,
    },
    streakText: {
      fontSize:   12,
      color:      ACCENT,
      fontWeight: '600',
    },

    // Progress bar
    barRow: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           10,
    },
    barPct: {
      fontSize:   13,
      fontWeight: '700',
      width:      36,
      textAlign:  'right',
    },

    // Divider
    divider: {
      height:          1,
      backgroundColor: theme.separator,
      marginVertical:  18,
    },

    // Type breakdown
    typeRow: {
      flexDirection: 'row',
    },

    // Category section
    sectionLabel: {
      fontSize:     11,
      fontWeight:   '800',
      color:        theme.textDisabled,
      letterSpacing: 1.1,
      marginBottom: 14,
    },
  });
}
