Context

 When a permanent task instance is completed, logCompletion() receives
 taskKind: 'one_off' and templateId: null — even though the task IS a
 permanent instance. This corrupts stats: the TodayCard correctly shows pending
 permanent tasks (via getTodayRaw() which JOINs template_instances), but
 after completion the log row carries the wrong kind, breaking all
 permanent-task stats (streaks, template detail screen, category breakdowns).

 Root cause chain:

 1. tasks table has 7 columns: id, title, completed, created_at, due_date, category_id, completed_at — no kind, no metadata.
 2. saveTask() only writes those 7 columns — task.kind and task.metadata
 are silently dropped at save time.
 3. getAllTasks() selects only those 7 columns — returns tasks with no kind
 or metadata.
 4. completeTask() checks task.kind === 'permanent' → undefined →
 falls to one_off branch.
 5. logCompletion() gets taskKind: 'one_off' and templateId: null.
 6. autoFailOverdueTasks() has the same bug — task.kind is undefined so
 overdue permanent tasks are also auto-failed as 'one_off'.

 The template_instances junction table already holds the authoritative
 instance → template link. permanentTaskStorage.ts already has
 getInstanceById(id) which queries that table and fetches template metadata.
 The fix adds a batch sync variant of that lookup and calls it from
 getAllTasks().

 ---
 Files to modify

 ┌───────────────────────────────────────────────────┬───────────────────────────────────────────────────────────┐
 │                       File                        │                          Change                           │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ app/core/services/storage/permanentTaskStorage.ts │ Add getAllInstanceMetaSync() — batch sync lookup          │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ app/core/services/storage/taskStorage.ts          │ Import and call getAllInstanceMetaSync() in getAllTasks() │
 └───────────────────────────────────────────────────┴───────────────────────────────────────────────────────────┘

 ---
 Change 1 — permanentTaskStorage.ts

 Add a new synchronous batch function (sync because getAllTasks() uses
 the synchronous SQLite API). The SQL is the same join that getInstanceById()
 performs, but batched for all instances in one query instead of one query per
 task ID.

 /**
  * Returns a map from instanceId → template metadata for every row in
  * template_instances. Used by getAllTasks() to reconstruct `kind` and
  * `metadata` on tasks loaded from the DB, without N+1 queries.
  *
  * Mirrors the logic inside getInstanceById() but batched and synchronous.
  */
 export function getAllInstanceMetaSync(): Map<string, {
   templateId:    string;
   templateTitle: string;
   autoRepeat:    any;           // parsed from JSON, or undefined
 }> {
   const rows = db.getAllSync<{
     instanceId:    string;
     templateId:    string;
     templateTitle: string;
     autoRepeat:    string | null;
   }>(
     `SELECT ti.instanceId, ti.templateId, tmpl.templateTitle, tmpl.autoRepeat
      FROM template_instances ti
      JOIN templates tmpl ON tmpl.permanentId = ti.templateId`
   );

   return new Map(rows.map(r => [
     r.instanceId,
     {
       templateId:    r.templateId,
       templateTitle: r.templateTitle,
       autoRepeat:    r.autoRepeat ? JSON.parse(r.autoRepeat) : undefined,
     },
   ]));
 }

 ---
 Change 2 — taskStorage.ts

 Import getAllInstanceMetaSync and call it at the top of getAllTasks().
 The rest of the function (SQL query, row type) stays the same; the only
 addition is reconstructing kind and metadata from the map lookup.

 import { getAllInstanceMetaSync } from './permanentTaskStorage';

 export async function getAllTasks(): Promise<Task[]> {
   // One sync query for all permanent instance metadata — no N+1.
   // Mirrors getInstanceById() in permanentTaskStorage but batched.
   const instanceMeta = getAllInstanceMetaSync();

   const rows = db.getAllSync<{
     id: string;
     title: string;
     completed: number;
     created_at: number;
     due_date: number | null;
     category_id: string | null;
     completed_at: number | null;
   }>('SELECT * FROM tasks ORDER BY created_at DESC');

   return rows.map(row => {
     const perm = instanceMeta.get(row.id);
     return {
       id:          row.id,
       title:       row.title,
       completed:   row.completed === 1,
       createdAt:   new Date(row.created_at),
       dueDate:     row.due_date     ? new Date(row.due_date)     : undefined,
       categoryId:  row.category_id  ?? undefined,
       completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
       // Reconstructed via template_instances + templates join
       kind:     perm ? 'permanent' : undefined,
       metadata: perm ? {
         permanentId:   perm.templateId,
         templateTitle: perm.templateTitle,
         isTemplate:    false,          // instances are never templates
         autoRepeat:    perm.autoRepeat,
       } : undefined,
     };
   });
 }

 ---
 Why nothing else needs to change

 Once getAllTasks() returns tasks with the correct kind and metadata:

 ┌────────────────────────────────────────────────────┬─────────────────────────┬────────────────────────────┐
 │                  Downstream code                   │    Currently broken     │         After fix          │
 ├────────────────────────────────────────────────────┼─────────────────────────┼────────────────────────────┤
 │ completeTask() switch on task.kind                 │ falls to one_off branch │ hits 'permanent' branch ✅ │
 ├────────────────────────────────────────────────────┼─────────────────────────┼────────────────────────────┤
 │ logCompletion() — taskKind                         │ 'one_off'               │ 'permanent' ✅             │
 ├────────────────────────────────────────────────────┼─────────────────────────┼────────────────────────────┤
 │ logCompletion() — templateId                       │ null                    │ real template ID ✅        │
 ├────────────────────────────────────────────────────┼─────────────────────────┼────────────────────────────┤
 │ handlePermanentCompletion() — metadata.permanentId │ undefined               │ real template ID ✅        │
 ├────────────────────────────────────────────────────┼─────────────────────────┼────────────────────────────┤
 │ handlePermanentCompletion() — metadata.autoRepeat  │ undefined               │ correct config ✅          │
 ├────────────────────────────────────────────────────┼─────────────────────────┼────────────────────────────┤
 │ autoFailOverdueTasks() — taskKind                  │ 'one_off'               │ 'permanent' ✅             │
 ├────────────────────────────────────────────────────┼─────────────────────────┼────────────────────────────┤
 │ autoFailOverdueTasks() — templateId                │ null                    │ real template ID ✅        │
 └────────────────────────────────────────────────────┴─────────────────────────┴────────────────────────────┘

 ---
 Edge cases confirmed safe

 - Templates are not in the tasks table — they live only in templates.
 The JOIN only matches rows where instanceId is present in
 template_instances, which templates never are.
 - One instanceId maps to exactly one templateId — the template_instances
 PK is (instanceId, templateId); one instance belongs to one template, so
 no fan-out.
 - autoRepeat nullable — guarded with JSON.parse only when non-null.
 - Non-permanent tasks — instanceMeta.get(row.id) returns undefined;
 kind and metadata are left undefined, identical to current behaviour.
 - No circular import — taskStorage.ts currently does NOT import from
 permanentTaskStorage.ts, and permanentTaskStorage.ts does not import
 from taskStorage.ts, so adding this import is safe.

 ---
 Verification

 1. Create a permanent task template and spawn an instance with today as due date.
 2. Without restarting the app: complete the instance. Check
 completion_log — task_kind must be 'permanent' and template_id
 must equal the template's permanentId.
 3. After restarting the app (forces reload from DB): complete another
 instance of the same template. Verify again — this is the previously-broken
 case.
 4. Check the Permanent Tasks section in StatsScreen — template detail screen
 should show completions incrementing.
 5. Check TodayCard — completed permanent tasks should appear in
 permanentDone, not oneOffDone.
 6. Let a permanent task go overdue and restart the app. Confirm the
 auto_failed row in completion_log has task_kind = 'permanent' and
 a valid template_id.

 ---
 Doc update

 After implementing, update docs/sprint-4/2026-02-22/CHANGES.md — mark
 "Step 4 runtime verification" as done (or add a new entry for this fix) and
 remove it from the open issues list.
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌