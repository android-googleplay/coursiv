# Coursiv Bite-Size Course Design Playbook

Content-only authoring guide for staff creating practical, no-video courses.

## Contents

- [How to Use This Playbook](#how-to-use-this-playbook)
- [What the Local Corpus Shows](#what-the-local-corpus-shows)
- [The Coursiv Learning DNA](#the-coursiv-learning-dna)
- [Recommended Notion Course Architecture](#recommended-notion-course-architecture)
- [The 18-Screen Lesson Recipe](#the-18-screen-lesson-recipe)
- [Writing Standards](#writing-standards)
- [Interaction Standards](#interaction-standards)
- [No-Video Visual Strategy](#no-video-visual-strategy)
- [Anti-Patterns](#anti-patterns)
- [Copyable Lesson Planning Worksheet](#copyable-lesson-planning-worksheet)
- [Worked Example: Long Lesson to 18 Screens](#worked-example-long-lesson-to-18-screens)
- [Existing Notion Draft Audit](#existing-notion-draft-audit)
- [Editorial Checklist](#editorial-checklist)
- [Definition of Done](#definition-of-done)

## How to Use This Playbook

Use this sequence for every new course:

1. Write one course promise and name the learner's final artifact.
2. Map the minimum lesson sequence needed to produce that artifact.
3. Give each lesson one visible outcome and one real artifact.
4. Build each lesson with the 18-screen recipe.
5. Plan interactions and screenshots before writing final copy.
6. Run the editorial checklist and a cold-start review.

> **Key distinction:** Bite-size does not mean a three-step lesson. It means a complete lesson divided into short, sequential screens. Each screen teaches one idea, asks for one decision, or advances one action.

This is a content-design guide. It does not cover CMS entry, JSON, APIs, Firebase, migration, deployment, or learner data.

## What the Local Corpus Shows

### Research scope

This playbook is based only on the current local Coursiv corpus, not on external course-design theory.

| Corpus group | Courses | Lessons | Screens | How it is used |
| --- | ---: | ---: | ---: | --- |
| Existing formal Coursiv courses | 37 | 343 | 8,925 | Primary pattern benchmark |
| Custom Google Sheet, Google Slide, and Notion courses | 3 | 16 | 190 | Comparison and audit only |
| Full local corpus | 40 | 359 | 9,115 | Coverage check |

The 37-course benchmark contains 17 tool-focused courses with 168 lessons and 4,211 screens. These are the closest comparison for a Notion course.

### Tool-course benchmark

| Measure | Local result | Authoring implication |
| --- | ---: | --- |
| Typical course length | Median 10 lessons | Aim for 8–10 focused lessons |
| Typical lesson length | Median 25 screens | Use 18–24 for a tighter staff standard |
| Observed lesson range | 13–36 screens | Do not force every subject into the same length |
| Content-screen word count | Median 43 words | Target 20–45 words; use 60 as a hard ceiling |
| Heading length | Median 4 words | Keep headings at 3–6 words |
| Interaction frequency | Median lesson rate: one interaction per 3.8 screens | Place a meaningful interaction every 3–4 screens |
| First-screen visual | 168 of 168 lessons | Always show an outcome visual on screen 1 |
| Images per lesson | Average 7.1 | Use 4–7 purposeful screenshots in a no-video course |
| No-video courses | 13 of 17 tool courses | Video is not required for an effective tool course |

The observed content-screen distribution is approximately 31 words at the 25th percentile, 43 at the median, and 57 at the 75th percentile. The 60-word limit in this playbook is a deliberate editorial rule, not a claim that every legacy screen follows it.

These statistics describe the local snapshot reviewed for this playbook. They are a design baseline, not a universal law. A screen should be shorter whenever the idea remains clear.

## The Coursiv Learning DNA

### 1. Promise an artifact, not information

Start with what the learner will have made, fixed, or decided. “Build a task database with five real tasks” is stronger than “Learn about databases.” The artifact gives every screen a reason to exist.

### 2. One screen, one job

A screen should do only one of these jobs:

- Explain one mental model.
- Demonstrate one action.
- Ask one decision.
- Warn about one mistake.
- Confirm one visible result.

If a screen contains two actions joined by “and then,” split it unless the second action is trivial.

### 3. Reveal complexity progressively

Teach the smallest useful version first. Let the learner create a page before introducing organization, build one database before creating views, and establish a manual workflow before offering AI assistance.

### 4. Repeat an act–check–reflect loop

Do not lecture for ten screens and quiz at the end. Alternate short explanation, action, feedback, and application. The learner should regularly predict, order, match, choose, or build.

### 5. Show proof instead of motion

A no-video lesson works when screenshots prove where to act and what success looks like. Use visuals for a location, state change, confusing control, or finished result—not as decoration.

### 6. End with a visible win

The learner should be able to point to a useful artifact at the end of every lesson. The takeaway names both the principle learned and the next behavior to repeat.

## Recommended Notion Course Architecture

### Course promise

> Build a simple personal Notion system that captures ideas, organizes tasks and notes, supports a weekly reset, and can be shared safely—without relying on advanced features or paid Notion AI.

### Recommended scale

- **3 units** with a clear progression.
- **8 core lessons** that work without Notion AI.
- **1 optional AI bonus** isolated from the core learning path.
- **18–24 screens per lesson**.
- **One concrete artifact per lesson**.
- **4–7 key screenshots per lesson**.
- **No required video**.

### Recommended learning route

| Unit | Lesson outcome | Artifact |
| --- | --- | --- |
| 1. Notion Without the Overwhelm | Capture quickly | Quick Capture page |
| 1. Notion Without the Overwhelm | Create a simple home | My Life Hub shell |
| 1. Notion Without the Overwhelm | Track real work | Tasks database with five tasks |
| 1. Notion Without the Overwhelm | See work by context | Today, This Week, and Done views |
| 2. Make Notion Work for Your Life | Reuse useful notes | Notes database and meeting template |
| 2. Make Notion Work for Your Life | Review consistently | Daily dashboard and weekly reset |
| 2. Make Notion Work for Your Life | Share safely | One correctly shared meeting note |
| 2. Make Notion Work for Your Life | Combine the system | Complete, tested My Life Hub |
| 3. Optional Bonus | Use AI with verification | Checked summary and action list |

Each lesson must depend only on skills already taught. Keep advanced databases, formulas, relations, rollups, automations, and paid AI features outside the core path unless the course promise specifically requires them.

## The 18-Screen Lesson Recipe

Use this as the default lesson spine. Limited variation is encouraged when it improves the learning flow, but keep the same outcome-driven logic.

| Screen | Purpose | What to write or show |
| ---: | --- | --- |
| 1 | Outcome hook + first visual | Name the visible win and show the finished artifact. |
| 2 | Basic mental model | Explain one simple principle the learner needs before acting. |
| 3 | First action | Give one concrete action that produces an immediate change. |
| 4 | Quick knowledge check | Test the principle or next best action, not a label or definition. |
| 5 | Small step 1 | Demonstrate the first part of the main workflow. |
| 6 | Small step 2 | Add the next essential action. |
| 7 | Small step 3 | Complete the minimum useful workflow. |
| 8 | Ordering or matching interaction | Check sequence, function, or cause-and-effect. |
| 9 | Real situation | Apply the workflow to a believable learner scenario. |
| 10 | Rule or warning | Surface one boundary, permission risk, or quality rule. |
| 11 | Common mistake and fix | Show a realistic error and the smallest correction. |
| 12 | Decision-based quiz | Ask the learner to choose what they would do next and why. |
| 13 | Refinement | Improve clarity, speed, reuse, or organization. |
| 14 | Real-life use | Connect the artifact to a recurring behavior or workflow. |
| 15 | Optional guided practice | Ask the learner to build or adapt a real artifact. |
| 16 | Final check | Confirm the artifact meets the lesson's success criteria. |
| 17 | Visible win + next behavior | Show what is now complete and the habit to repeat. |
| 18 | Key takeaway | State the principle in one sentence and point to the next lesson. |

### Cadence rule

The default required interactions are screens 4, 8, 12, and 16. Screen 15 is guided practice and may be optional. Writers may move one interaction by one screen when needed, but no long explanation block should leave the learner passive for more than four screens.

### Variation rule

The recipe is a learning sequence, not a visual template. Avoid using the exact same interaction type, callout position, sentence pattern, and screenshot position in every lesson. Vary the surface rhythm while preserving the instructional purpose.

## Writing Standards

### Screen-level limits

| Element | Standard |
| --- | --- |
| Heading | 3–6 words; concrete and outcome-oriented |
| Body copy | Target 20–45 words |
| Hard limit | 60 visible words per screen |
| Paragraphs | Usually one short paragraph or two very short paragraphs |
| Action | One primary action per screen |
| Image | Maximum one image per screen |

### Voice

- Use direct verbs: create, open, choose, rename, drag, check, share.
- Write to “you.”
- Prefer plain language over platform jargon.
- Explain a term at the moment it becomes necessary.
- Use realistic names and examples, not placeholders such as “Item 1.”
- State why a choice matters when the learner could reasonably choose incorrectly.

### Avoid

- Long introductions before the first action.
- Feature inventories.
- Abstract claims such as “Notion is a powerful all-in-one workspace.”
- Multiple exceptions on one screen.
- Instructions that depend on unexplained prior knowledge.
- Vague verbs such as “optimize,” “leverage,” or “manage” without a visible action.

### Before and after

**Too broad:**

> Notion databases offer many properties, filters, sorting methods, views, relations, rollups, formulas, and templates that can help you organize different types of information efficiently.

**Coursiv version:**

> Add a **Status** property to your task database. Use only three options: Not started, In progress, and Done. This gives every task one clear state without adding a complicated workflow.

## Interaction Standards

### What interactions should test

Test judgment, sequence, and application—not memory of interface labels.

| Interaction | Best use | Example |
| --- | --- | --- |
| Single choice | Choose the safest or most useful next action | Which view should show only overdue work? |
| Ordering | Rehearse a workflow | Put the database-creation steps in order. |
| Matching | Connect controls to outcomes | Match Table, Board, and Calendar to their best use. |
| True/false | Challenge a meaningful misconception | Sharing one page always shares its parent page. |
| Guided practice | Produce a real artifact | Add five tasks from your actual week. |

### Required quality rules

- Place one meaningful interaction every 3–4 screens.
- Use 3–4 required interactions per 18-screen lesson.
- Use one optional practice when it helps the learner create a personal artifact.
- A single-choice quiz should usually have three credible options.
- Wrong options must reflect realistic misunderstandings, not jokes or obvious nonsense.
- Feedback must explain the governing principle, not merely say “Correct” or “Try again.”
- A practice task must change or create something in the learner's real Notion workspace.
- Never use interaction only to increase activity count.

### Feedback formula

Use this short structure:

> **Result:** State whether the decision works. **Principle:** Explain why. **Next move:** Tell the learner what to do or notice next.

## No-Video Visual Strategy

### Minimum visual plan

Use 4–7 screenshots per lesson. Screen 1 must include the outcome visual. Use at most one image on any screen.

Prioritize these visual jobs:

1. **Outcome:** What the completed artifact looks like.
2. **Location:** Where a control or menu appears.
3. **Action:** The exact state before an important click or choice.
4. **Change:** Before-and-after proof that the action worked.
5. **Confusion:** A control, permission, or view learners commonly misread.

### Screenshot standards

- Crop tightly around the relevant area.
- Keep enough interface context for orientation.
- Use one subtle annotation only when the target is not obvious.
- Use consistent browser zoom and interface theme within a lesson.
- Remove personal, client, and confidential information.
- Use realistic sample content that matches the lesson copy.
- Add descriptive alt text based on the learning purpose.
- Compress images and use appropriately sized derivatives so lesson loading remains fast.

### Do not add an image when

- It repeats the text without adding location or proof.
- It is a generic stock image or decorative illustration.
- The interface state is already obvious from the previous screen.
- It contains many unrelated controls that increase cognitive load.

## Anti-Patterns

| Anti-pattern | Why it fails | Replace it with |
| --- | --- | --- |
| Long lecture screens | Learners cannot act or verify progress | One idea or action per screen |
| Several features taught together | The learner cannot form a stable mental model | Minimum useful workflow first |
| All quizzes at the end | Misunderstandings survive too long | Checks every 3–4 screens |
| Decorative images | Adds load without explaining anything | Screenshots that show location, change, or result |
| No real artifact | Completion feels abstract | One visible output per lesson |
| Feature dump | Breadth replaces useful competence | Features selected by the promised outcome |
| Identical rhythm in every lesson | Course feels automated and predictable | Limited variation in checks, callouts, and visuals |
| Core lessons require paid Notion AI | Blocks learners and weakens fundamentals | Manual core workflow; AI as optional bonus |
| Advanced databases too early | Adds concepts before they solve a real need | Pages, simple databases, views, and habits first |
| Video used by default | Slows production and makes scanning harder | Short copy plus purposeful screenshots |

## Copyable Lesson Planning Worksheet

Copy the block below for every lesson and complete it before drafting screens.

```markdown
# Lesson Planning Worksheet

## Course context
- Course promise:
- Target learner:
- Learner's starting state:
- Final course artifact:

## Lesson definition
- Unit:
- Lesson title (3–6 words):
- One-sentence lesson outcome:
- Tangible artifact at the end:
- Required prior lesson or skill:
- One mental model:
- One common misconception:
- One boundary or warning:
- Next behavior after completion:

## 18-screen outline
1. Outcome hook + first visual:
2. Basic mental model:
3. First action:
4. Quick knowledge check:
5. Small step 1:
6. Small step 2:
7. Small step 3:
8. Ordering or matching interaction:
9. Real situation:
10. Rule or warning:
11. Common mistake and fix:
12. Decision-based quiz:
13. Refinement:
14. Real-life use:
15. Optional guided practice:
16. Final check:
17. Visible win + next behavior:
18. Key takeaway:

## Interaction plan
- Screen 4 — skill tested / type / three credible options / feedback principle:
- Screen 8 — skill tested / type / correct order or matches / feedback principle:
- Screen 12 — decision tested / type / three credible options / feedback principle:
- Screen 15 — real artifact practice / optional or required / success evidence:
- Screen 16 — final criteria / type / feedback principle:
- Maximum passive gap between required interactions:

## Screenshot brief
- Screen 1 — final outcome visual / crop / sample data / alt text:
- Screenshot 2 — location or control:
- Screenshot 3 — important action:
- Screenshot 4 — state change:
- Screenshot 5 — common confusion:
- Screenshot 6 — optional refinement:
- Screenshot 7 — optional final proof:

## Editorial checks
- [ ] One idea or action per screen
- [ ] Headings are 3–6 words
- [ ] Body copy targets 20–45 words
- [ ] No screen exceeds 60 visible words
- [ ] Every interaction tests judgment, sequence, or application
- [ ] Wrong-answer feedback explains a principle
- [ ] Practice creates or changes a real artifact
- [ ] Screenshots teach rather than decorate
- [ ] Core outcome does not require paid Notion AI
- [ ] Final screen states the principle and next behavior
```

## Worked Example: Long Lesson to 18 Screens

### Conventional source lesson

**Topic:** Create a Notion task database  
**Typical format:** A 10-minute explanation covering database creation, properties, views, filters, sorting, templates, formulas, relations, and productivity tips.  
**Problem:** It introduces more features than the learner needs and delays the first useful result.

### Coursiv conversion

**Lesson outcome:** Build one Tasks database containing five real tasks with Status, Priority, and Due properties.

| Screen | Draft content |
| ---: | --- |
| 1 | **See Your Tasks Clearly** — Show the finished five-task database and promise the same result by the end. |
| 2 | **One List, Clear States** — A database is one source of truth where each task has the same useful fields. |
| 3 | **Create the Database** — On a blank page, insert a table database and name it Tasks. |
| 4 | **Choose the Best Start** — Ask whether the learner should add properties, views, or formulas next. Correct principle: define essential information first. |
| 5 | **Add Status** — Create Not started, In progress, and Done. |
| 6 | **Add Priority** — Create High, Medium, and Low. |
| 7 | **Add Due** — Add a date property and enter the first real deadline. |
| 8 | **Put It in Order** — Order: create database, add properties, enter tasks, review missing fields. |
| 9 | **Use Real Work** — Replace sample rows with five tasks from the learner's current week. |
| 10 | **Keep It Simple** — Warn against adding properties with no immediate decision-making value. |
| 11 | **Fix Vague Tasks** — Change “Website” to a clear action such as “Review homepage copy.” |
| 12 | **What Comes Next?** — Ask how to handle a task with no owner or deadline. Test whether the learner checks essential information before adding features. |
| 13 | **Set Useful Defaults** — Make new tasks start as Not started and Medium priority where appropriate. |
| 14 | **Make Capture Routine** — Add new work to this database instead of starting a second list. |
| 15 | **Add Five Real Tasks** — Guided practice: complete five rows with Status, Priority, and Due where relevant. |
| 16 | **Check Your Database** — Confirm one database, five actionable tasks, and no unexplained properties. |
| 17 | **Your Source of Truth** — Show the finished result and ask the learner to capture the next task here. |
| 18 | **Keep One Trusted List** — A simple database works when every real task returns to the same trusted place. Next: create views for different moments. |

### Visual brief for the example

- Screen 1: Completed five-task database.
- Screen 3: Database creation menu.
- Screen 5: Status property setup.
- Screen 7: Due date property and date picker.
- Screen 11: Vague task beside its actionable rewrite.
- Screen 17: Final database with all five tasks.

The conversion intentionally excludes formulas, relations, rollups, and complex templates. Those features are not required by the lesson outcome.

## Existing Notion Draft Audit

Audit source: the current local [`notion.json`](../content/coursiv/courses/notion.json). This is a read-only content audit; the source course is not changed or published by this playbook.

### Overall audit

| Area | Status | Evidence | Recommendation |
| --- | --- | --- | --- |
| Course route | Pass | Quick Capture → Hub → Tasks → Views → Notes → Weekly Review → Sharing → Final Challenge → AI Bonus | Preserve the progression. |
| Unit structure | Pass | 3 units, 8 core lessons, 1 optional AI lesson | Preserve the architecture. |
| Lesson length | Pass | All 9 lessons contain exactly 18 screens | Keep 18 screens unless content evidence requires more. |
| Copy length | Pass | Maximum visible text per screen is 27–40 words by lesson | Keep the current concise style. |
| Interaction cadence | Pass | 4 required interactions and 1 optional practice per lesson; maximum gap is 4 screens | Preserve the active cadence. |
| Final takeaway | Pass | Every lesson ends with a takeaway callout | Keep the principle + next-behavior close. |
| Visual teaching | Gap | 0 images across all 9 lessons | Add 4–7 purposeful screenshots per lesson, beginning on screen 1. |
| Rhythm variety | Gap | Every lesson uses the same screen-type sequence | Vary selected check types, callout timing, and screenshot positions without breaking the learning spine. |
| Video | Pass | No lesson depends on video | Keep the course no-video. |
| AI dependency | Pass | Notion AI is isolated in the optional bonus | Keep all core outcomes possible without paid AI. |

### Lesson-by-lesson matrix

| # | Lesson and artifact | Pass | Gap | Recommended adjustment and screenshot brief |
| ---: | --- | --- | --- | --- |
| 1 | **Your First Page in 10 Minutes** — working Quick Capture page | 18 screens; 4 varied checks; optional practice; max 40 words | No visual proof; fixed rhythm | Add the finished Quick Capture page on screen 1, then show the slash command, six-dot block handle, and transformed block. Let one check follow the transformation screenshot. |
| 2 | **Turn Chaos Into a Simple Home** — My Life Hub shell | Clear outcome; 4 checks; optional practice; max 33 words | Page hierarchy is hard to learn without orientation | Show the finished hub, sidebar location, linked existing page, and Favorites/search. Use the sidebar visual before testing where a page belongs. |
| 3 | **Build One Task Database** — database with five real tasks | Strong real artifact; 4 checks; max 36 words | Property setup lacks visible states | Show database creation, Status/Priority/Due properties, an opened task page, and the finished five-task database. Keep advanced properties out. |
| 4 | **See Your Work Your Way** — Today, This Week, and Done views | Useful progression from the database; 4 checks; max 31 words | View differences need side-by-side visual evidence | Show Table, Board, Calendar, filters/sorts, and the final Today view. Use matching to connect each view with its best purpose. |
| 5 | **Notes You’ll Actually Reuse** — Notes database and meeting template | Reuse-focused artifact; 4 checks; max 30 words | Retrieval benefit is described but not demonstrated | Show the Notes database, meeting template, opened note page, and a search/retrieval result. End with proof that a past note can be found quickly. |
| 6 | **Plan Your Week in 5 Minutes** — daily dashboard and weekly reset | Behavior-based outcome; 4 checks; max 31 words | Reset lacks before-and-after proof | Show the Today dashboard, This Week view, weekly reset before/after, and clean backlog. Move one interaction to follow the before state. |
| 7 | **Share Without Oversharing** — safely shared meeting note | Strong decision and risk content; 4 checks; max 32 words | Permissions are unsafe to teach without interface context | Show Share, permission levels, parent-page access, and recipient view. Use a decision quiz after the permission screenshot and explain the access principle in feedback. |
| 8 | **Finish Your My Life Hub** — complete tested hub | Good final challenge; 4 checks; max 27 words | Completion criteria need visual proof and may feel like the same rhythm again | Show the complete hub, duplicate cleanup, mobile Favorite, and final 30-second dashboard. Use a checklist-style final check before the takeaway. |
| 9 | **Let Notion AI Help, Not Take Over** — checked summary and actions | Optional placement is correct; 4 checks; max 33 words | Verification needs direct source/result comparison | Show the AI command, three-bullet summary, extracted actions, source comparison, and corrected saved result. Make the final check test verification, not prompt wording. |

### Draft decision

Keep the existing 3-unit, 9-lesson route and its concise copy. Do not rewrite it into a longer course. The highest-value revision is to add key screenshots and introduce limited rhythm variation. Do not add video or advanced database features to solve a visual-design gap.

## Editorial Checklist

### Course promise and map

- [ ] The promise names a visible learner outcome.
- [ ] The course contains only lessons required for that promise.
- [ ] Units represent meaningful stages, not arbitrary groups.
- [ ] Every lesson produces one artifact or tested behavior.
- [ ] Each lesson uses only concepts already taught.
- [ ] Optional or paid features are clearly separated from the core route.

### Lesson outline

- [ ] Screen 1 shows the finished outcome.
- [ ] The first real action happens by screen 3.
- [ ] Each screen has one instructional job.
- [ ] A meaningful interaction appears every 3–4 screens.
- [ ] A real scenario appears before the final check.
- [ ] The lesson includes one realistic mistake and correction.
- [ ] Practice changes or creates the learner's real artifact.
- [ ] Screen 16 verifies explicit success criteria.
- [ ] Screen 17 names the visible win and next behavior.
- [ ] Screen 18 states one memorable principle.

### Copy

- [ ] Headings are 3–6 words.
- [ ] Body copy usually contains 20–45 words.
- [ ] No screen exceeds 60 visible words.
- [ ] Instructions use concrete verbs.
- [ ] Jargon is removed or explained at first use.
- [ ] There is no long introduction or feature dump.
- [ ] Examples use realistic content.

### Interactions

- [ ] Every check tests judgment, sequence, or application.
- [ ] Single-choice questions usually have three credible options.
- [ ] Wrong answers represent plausible mistakes.
- [ ] Feedback explains the underlying principle.
- [ ] Interaction types fit the skill being tested.
- [ ] Required interactions are distributed through the lesson.

### Visuals

- [ ] The lesson contains 4–7 purposeful screenshots.
- [ ] Screen 1 contains an outcome visual.
- [ ] No screen contains more than one image.
- [ ] Every screenshot shows a location, action, change, confusion, or result.
- [ ] Images are tightly cropped, readable, and consistent.
- [ ] Personal or confidential data is absent.
- [ ] Alt text describes the learning purpose.
- [ ] Assets are compressed and appropriately sized.

### Cold-start review

Give the completed worksheet to a staff member who did not design the lesson. They must be able to state, without additional explanation:

- The course promise.
- The unit map.
- The lesson outcome and artifact.
- The purpose of all 18 screens.
- What each interaction tests.
- Which screenshots must be captured.
- How completion will be judged.

If they cannot, the plan is not ready for drafting.

## Definition of Done

A course plan is ready for production only when it includes:

1. One measurable course promise.
2. A dependency-aware unit and lesson map.
3. One tangible outcome for every lesson.
4. A complete 18-screen outline for every core lesson.
5. An interaction plan with feedback principles.
6. A 4–7-image screenshot brief for every lesson.
7. Copy that passes the word-count and one-job-per-screen rules.
8. A completed editorial checklist.
9. A successful cold-start review by another staff member.

The simplest reliable test is this: **Can a learner finish each lesson with something useful on screen and know exactly what to do next?**
