# Stats Screen UI Guide

**Created:** 2026-02-18
**Covers:** Everything currently built in `app/screens/stats/` and `app/components/stats/`

---

## Screen Overview

`StatsScreen` is a vertically scrolling screen with this top-to-bottom layout:

```
┌──────────────────────────────┐
│  Header (orange bar)         │  "Stats" + subtitle
├──────────────────────────────┤
│  TodayCard                   │  Today's live snapshot
├──────────────────────────────┤
│  CollapsibleSection: Overall │  4 time-range preview cards
├──────────────────────────────┤
│  CollapsibleSection:         │  One card per category (dynamic)
│    Categories                │
├──────────────────────────────┤
│  CollapsibleSection:         │  One card per template (dynamic)
│    Permanent Tasks           │
└──────────────────────────────┘
```

All sections except the header are scrollable. The three collapsible sections start **collapsed** (except Overall which starts open).

---

## Component Reference

### 1. TodayCard

**File:** `app/components/stats/TodayCard.tsx`
**Used in:** `StatsScreen` (top, always visible)

Displays a full snapshot of today's productivity. Not collapsible.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│ TODAY                              Tuesday, Feb 18  │  ← header row
│                                                     │
│  [Ring 108px]  8 done                🔥 5-day       │  ← hero row
│     67%        4 left                              │
│                of 12 tasks today                   │
│                                                     │
│  ████████████░░░░░░  67%                            │  ← LinearBar
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                 │  ← TypeMiniCard ×2
│  │ 🔁 Permanent │  │ 📝 One-off   │                 │
│  │  75%  3/4    │  │  63%  5/8    │                 │
│  └──────────────┘  └──────────────┘                 │
│                                                     │
│  BY CATEGORY                                        │  ← CategoryRow list
│  ● Work     ████████░░  4/5  80%                    │
│  ● Health   ████░░░░░░  2/4  50%                    │
└─────────────────────────────────────────────────────┘
```

#### Props

```ts
interface TodayStats {
  totalTasks: number;       // total tasks assigned today
  completedTasks: number;   // how many are done
  permanentTotal: number;   // permanent task instances today
  permanentDone: number;
  oneOffTotal: number;      // one-off tasks today
  oneOffDone: number;
  categories: Array<{
    name: string;
    color: string;          // hex, e.g. '#007AFF'
    total: number;
    done: number;
  }>;
  streak: number;           // current consecutive-day streak (0 hides the pill)
}
```

#### Usage

```tsx
<TodayCard data={todayStats} />
```

#### When backend is ready

Replace `getMockTodayStats()` in `StatsScreen.tsx` with:
```ts
const todayStats = useStats().getTodayStats();
```

---

### 2. CollapsibleSection

**File:** `app/screens/stats/StatsScreen.tsx` (inline component)
**Used in:** `StatsScreen` — three instances

Animated accordion box. Tap header to expand or collapse. Content animates with height + opacity simultaneously.

#### Layout

```
┌──────────────────────────────────────────────────┐
│  [badge]  Title                              ›   │  ← TouchableOpacity header
├──────────────────────────────────────────────────┤
│  (content — any React children)                  │  ← Animated.View (maxHeight)
└──────────────────────────────────────────────────┘
```

The `›` chevron rotates 0°→90° when opened.

#### Props

```ts
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;       // default: false

  // Icon
  renderIcon: () => React.ReactNode;

  // Badge appearance
  badgeColor: string;          // hex color
  badgeOpacity?: number;       // bg opacity 0–1    default: 0.12
  badgeSize?: number;          // square px          default: 52
  badgeBorderRadius?: number;  // corner radius px   default: 14
  badgeBorderWidth?: number;   // 0 = no border      default: 0
  badgeBorderColor?: string;   // defaults to badgeColor

  // Empty state
  emptyMessage?: string;       // shown when children list is empty
}
```

#### How to add a new section

```tsx
<CollapsibleSection
  title="My New Section"
  renderIcon={() => <Text style={{ fontSize: 26 }}>🎯</Text>}
  badgeColor="#AF52DE"
  emptyMessage="Nothing here yet"
>
  {myItems.map((item, i) => (
    <StatPreviewCard
      key={item.id}
      data={item}
      onPress={handleCardPress}
      style={i === 0 ? innerCardFirst : innerCard}
    />
  ))}
</CollapsibleSection>
```

#### How to swap the icon

The `renderIcon` prop accepts any React element — no icon library required.

```tsx
// Option A — Emoji (current default, zero dependencies)
renderIcon={() => <Text style={{ fontSize: 26 }}>📊</Text>}

// Option B — Local PNG/image asset
import { Image } from 'react-native';
renderIcon={() => (
  <Image
    source={require('../../assets/icons/overall.png')}
    style={{ width: 28, height: 28 }}
  />
)}

// Option C — Vector icon library (install @expo/vector-icons first)
import { Ionicons } from '@expo/vector-icons';
renderIcon={() => <Ionicons name="analytics" size={26} color="#FF9500" />}
```

#### How to adjust badge appearance

```tsx
// Subtle tint (current default)
badgeOpacity={0.12}

// More opaque background
badgeOpacity={0.2}

// Add a visible border
badgeBorderWidth={1.5}
badgeBorderColor="#FF950060"

// Pill shape (fully rounded)
badgeBorderRadius={26}

// Larger badge
badgeSize={60}
```

#### Animation details

- **Opening:** `Easing.out(Easing.cubic)`, 320ms
- **Closing:** `Easing.in(Easing.cubic)`, 240ms
- Height animates via `maxHeight` interpolation (0 → 2000)
- Opacity fades in at 70% of open duration, out at 50% of close duration
- To change speed: edit `ANIM_DURATION_OPEN` / `ANIM_DURATION_CLOSE` constants

---

### 3. StatPreviewCard

**File:** `app/components/stats/StatPreviewCard.tsx`
**Used in:** All three `CollapsibleSection` instances

Tappable card combining a circular progress ring, name/count text, streak badge, and weekly mini chart.

#### Layout

```
┌────────────────────────────────────────────┐
│  [Ring]  Name                     🔥  12  │
│   78%    156 completed                     │
│  ─────────────────────────────────────── │
│  [M][T][W][T][F][S][S]  ← mini bar chart  │
└────────────────────────────────────────────┘
```

#### Props

```ts
interface StatPreviewData {
  type: 'all' | 'template' | 'category';
  id: string;
  name: string;
  totalCompleted: number;
  completionPercent: number; // 0–100
  currentStreak: number;
  weeklyData: DayData[];     // exactly 7 items
  color: string;             // accent color
}

// Component props:
interface StatPreviewCardProps {
  data: StatPreviewData;
  onPress: (data: StatPreviewData) => void;
  style?: StyleProp<ViewStyle>; // override card container style
}
```

#### Embedding inside CollapsibleSection (flat style)

Cards inside a section box use `innerCard` / `innerCardFirst` styles (defined in `StatsScreen.tsx`) which strip the card's own shadow, border-radius, and margins so it sits flush inside the section:

```ts
// Defined in StatsScreen.tsx
const innerCard = {
  marginHorizontal: 0,
  marginBottom: 0,
  borderRadius: 0,
  shadowOpacity: 0,
  elevation: 0,
  borderTopWidth: 1,
  borderTopColor: '#f2f2f2',
};
const innerCardFirst = { ...innerCard, borderTopWidth: 0 };
```

Use `innerCardFirst` for the first card in a list (avoids double border with section divider), `innerCard` for all others.

#### Standalone (with own card chrome)

```tsx
// Don't pass a style prop — uses full card styling by default
<StatPreviewCard data={myData} onPress={handlePress} />
```

---

### 4. CircularProgress

**File:** `app/components/stats/CircularProgress.tsx`
**Used in:** `StatPreviewCard` (size 64), `TodayCard` (size 108)

Pure React Native ring (no SVG). Grey track, accent arc fills clockwise from 12 o'clock.

#### Props

```ts
interface CircularProgressProps {
  percent: number;       // 0–100
  size?: number;         // outer diameter px   default: 64
  color?: string;        // accent color        default: '#FF9500'
  trackWidth?: number;   // ring stroke width   default: 7
}
```

#### Usage

```tsx
<CircularProgress percent={67} size={108} color="#FF9500" trackWidth={10} />
```

#### How it works (technical)

Two half-ring clip boxes. Each contains a full bordered circle with only two colored border sides. The clip box restricts rendering to its half (left or right). Rotating the inner circle sweeps the arc into view. A white inner disc creates the hole and displays the % label.

---

### 5. WeeklyMiniChart

**File:** `app/components/stats/WeeklyMiniChart.tsx`
**Used in:** `StatPreviewCard`

7 vertical bars (Mon–Sun). Bar height is relative to the week's **max count** — the busiest day always fills the full height; zero-count days show a 3px grey stub.

#### Props

```ts
interface WeeklyMiniChartProps {
  data: DayData[];       // exactly 7 items
  color?: string;        // bar fill color   default: '#FF9500'
  maxHeight?: number;    // max bar height   default: 28
  barWidth?: number;     // bar width px     default: 13
}

interface DayData {
  day: string;   // label: 'M' | 'T' | 'W' | 'T' | 'F' | 'S' | 'S'
  count: number; // raw completions that day (not a percentage)
}
```

#### Usage

```tsx
<WeeklyMiniChart
  data={[
    { day: 'M', count: 4 },
    { day: 'T', count: 6 },
    { day: 'W', count: 2 },
    { day: 'T', count: 5 },
    { day: 'F', count: 1 },
    { day: 'S', count: 0 },
    { day: 'S', count: 0 },
  ]}
  color="#007AFF"
/>
```

---

## Connecting Real Data (Phase 3)

All data currently comes from mock functions in `StatsScreen.tsx`. When the storage layer (Phase 1) is ready, replace each function call:

| Mock function | Replace with |
|---------------|-------------|
| `getMockTodayStats()` | `useStats().getTodayStats()` |
| `getMockOverallStats()` | `useStats().getOverallStatsList()` |
| `getMockTemplateStats()` | `useStats().getTemplateStatsList()` |
| `getMockCategoryStats()` | `useStats().getCategoryStatsList()` |

No component changes are needed — the data shapes are already defined by the exported TypeScript interfaces.

---

## Adding a New Stats Section

1. Define your data type (or reuse `StatPreviewData`)
2. Add a mock function in `StatsScreen.tsx` (e.g. `getMockMyStats()`)
3. Call it in the component body
4. Add a `<CollapsibleSection>` block in the render with your `renderIcon`, `badgeColor`, and mapped cards
5. When backend is ready, swap the mock function for a real hook call

---

## Common Gotchas

| Issue | Fix |
|-------|-----|
| Section opens to blank box | Pass `emptyMessage` prop to `CollapsibleSection` |
| Cards look double-indented inside section | Use `innerCard` / `innerCardFirst` style override on `StatPreviewCard` |
| `@expo/vector-icons` not found | Not installed — use emoji or local Image in `renderIcon` for now |
| Progress ring doesn't start at 12 o'clock | Ensure `percent` is 0–100; the rotation formula handles this correctly |
| Weekly bars all look the same height | Check that `count` values differ; bars scale relative to the week's max |
