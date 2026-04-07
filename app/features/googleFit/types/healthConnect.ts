// app/features/googlefit/types/healthConnect.ts

// ---------------------------------------------------------------------------
// Health data categories supported by this integration
// ---------------------------------------------------------------------------

export type HealthDataType = 'steps' | 'sleep' | 'workout';

// ---------------------------------------------------------------------------
// Exercise type integer values (from react-native-health-connect ExerciseType)
// 0 is used as a wildcard meaning "any workout type"
// ---------------------------------------------------------------------------

export type ExerciseTypeValue = number;

export const ExerciseTypeMap: Record<string, ExerciseTypeValue> = {
  'Any Workout': 0,
  'Strength Training': 70,
  'Weightlifting': 81,
  'Running': 56,
  'Treadmill Run': 57,
  'Walking': 79,
  'Swimming (Pool)': 74,
  'Swimming (Open Water)': 73,
  'Yoga': 83,
  'HIIT': 36,
};

// ---------------------------------------------------------------------------
// Threshold → template mapping stored in health_connect_mappings
// ---------------------------------------------------------------------------

export interface HealthConnectMapping {
  id: string;                        // UUID primary key
  permanentId: string;               // references templates.permanentId
  templateTitle?: string;            // populated by getAllMappings() JOIN — display name
  dataType: HealthDataType;
  // Steps threshold: minimum step count
  stepsGoal?: number;
  // Sleep threshold: minimum hours
  sleepHours?: number;
  // Workout threshold: exercise type (0 = any) + minimum duration in minutes
  exerciseType?: ExerciseTypeValue;
  minDurationMinutes?: number;
  // If true, create an instance today if none exists when threshold is met
  autoSchedule: boolean;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// A single workout session read from Health Connect
// ---------------------------------------------------------------------------

export interface WorkoutSession {
  id: string;
  startTime: string;         // ISO 8601
  endTime: string;           // ISO 8601
  exerciseType: number;
  durationMinutes: number;
  title?: string;
}

// ---------------------------------------------------------------------------
// Aggregated summary for today used by the sync engine
// ---------------------------------------------------------------------------

export interface TodaySummary {
  steps: number;
  sleepHours: number;        // 0 if no session found
  workouts: WorkoutSession[];
}

// ---------------------------------------------------------------------------
// Health Connect SDK status values
// ---------------------------------------------------------------------------

export enum HealthConnectStatus {
  NotInstalled = 'not_installed',
  NotSupported = 'not_supported',
  Available = 'available',
  Unknown = 'unknown',
}
