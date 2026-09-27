## Progress dashboards
For any task with more than 5 steps, or that should take longer than 30 minutes:
1. Before starting, run `date -Iseconds` and call the `dashboard-builder` subagent in the
   background with the goal, the planned steps and that timestamp. Keep working while it builds.
   If it replies NEED_STYLE, ask me those questions once, then call it again with my answers.
2. After every step, update `.dashboard/state.js` yourself (status, deliverables, blocked items),
   using `date -Iseconds` for every timestamp. Only call dashboard-builder again if the task
   changes shape and needs different panels.
3. When you need a decision from me, add it to `questions` with the default you'll take,
   then keep going with that default. Don't stop and wait.
