# Google Sheets with AI: 8 Skills You Can Use Today

Production blueprint for an English, AI-first, no-video Coursiv course.

## Course at a Glance

| Item | Decision |
| --- | --- |
| Audience | Busy professionals with basic Google Sheets familiarity |
| Promise | Use natural language to create, clean, complete, calculate, analyze, and report spreadsheet data |
| Format | 2 units, 8 lessons, 18 screens per lesson |
| Duration | Approximately 2 hours |
| AI requirement | Ask Gemini in Google Sheets; an eligible Google Workspace or Google AI plan is required |
| Delivery | Desktop, native Google Sheets files |
| Video | None |
| Lesson result | One independent, immediately useful AI workflow |
| Learning loop | Describe → Preview → Check → Apply → Reuse |

This course is not a formula library or a tour of every Sheets feature. It teaches eight small workplace wins. Manual spreadsheet concepts appear only when learners need them to verify an AI result.

## Course Requirements

Before lesson 1, the learner should:

- Be able to open a Google Sheet and select cells.
- Use a native Google Sheets file. If working in an Excel file, save it as Google Sheets first.
- Have access to **Ask Gemini** through an eligible plan.
- Use the desktop interface shown in the screenshots.
- Use sample data with no personal, client, financial, or confidential information.

Feature availability can vary by account, language, and region. AI columns and prompt-based filling must be labelled when their availability is narrower than the core Ask Gemini side panel.

## Unit Map

| Unit | Lesson | Immediate AI win | Artifact |
| --- | ---: | --- | --- |
| 1. Let AI Build and Organize | 1 | Create a tracker from one prompt | Social media content tracker |
| 1. Let AI Build and Organize | 2 | Clean inconsistent spreadsheet data | Analysis-ready clean table |
| 1. Let AI Build and Organize | 3 | Fill and categorize rows | Classified customer-request table |
| 1. Let AI Build and Organize | 4 | Write and repair formulas | Days Until Due and Overdue columns |
| 2. Let AI Find and Explain Answers | 5 | Make priorities visible | Prioritized project tracker |
| 2. Let AI Find and Explain Answers | 6 | Summarize rows with a pivot table | Sales-by-region pivot table |
| 2. Let AI Find and Explain Answers | 7 | Explain trends and build a chart | Verified insights and trend chart |
| 2. Let AI Find and Explain Answers | 8 | Turn data into an action report | Manager-ready weekly update |

## Shared Lesson Pattern

Every lesson uses the same learning logic without repeating the same surface rhythm:

1. Show the finished result.
2. Explain when the skill saves time.
3. Show a basic prompt.
4. Check prompt quality.
5. Open Ask Gemini.
6. Focus Gemini on the correct data.
7. Run the prompt.
8. Check the review sequence.
9. Inspect the preview or response.
10. Introduce one important warning.
11. Repair a vague prompt or incorrect result.
12. Decide whether to apply, insert, or revise.
13. Add one useful constraint.
14. Apply the skill to a realistic situation.
15. Practise with the learner's own data.
16. Verify explicit success criteria.
17. Show the completed AI win.
18. End with a key principle and copyable prompt.

Screens 4, 8, 12, and 16 are required interactions. Screen 15 is optional guided practice. Each lesson uses 4–6 functional screenshots, with the completed result shown on screen 1.

---

## Unit 1: Let AI Build and Organize

## Lesson 1: Create a Tracker from One Prompt

### Lesson definition

- **Immediate win:** Turn a blank Sheet into a useful tracker.
- **Scenario:** A small marketing team needs a social media content tracker.
- **Artifact:** A table with Content Title, Owner, Channel, Deadline, Status, and Notes.
- **Primary AI skill:** Generate and refine a table with Ask Gemini.
- **Mental model:** A strong table prompt names the purpose, required columns, and useful sample output.
- **Common mistake:** Asking Gemini to “make a tracker” without defining what the tracker must help the user decide.
- **Content boundary:** Do not teach formulas, dashboards, or table automation here.
- **Success criteria:** Six correct columns, five realistic rows, usable status values, and no invented confidential data.

### Copyable prompt

```text
Create a social media content tracker with columns for content title, owner, channel, deadline, status, and notes. Add five realistic example rows.
```

### 18-screen outline

| Screen | Working heading | Type | Purpose |
| ---: | --- | --- | --- |
| 1 | Build It in Seconds | Content + screenshot | Show the finished social media tracker and promise the same result from one prompt. |
| 2 | Start With the Job | Content | Explain that Gemini needs the tracker’s purpose before it can choose a useful structure. |
| 3 | Use Three Ingredients | Content | Introduce purpose + columns + example rows as the minimum prompt structure. |
| 4 | Pick the Better Prompt | Single choice | Choose between a vague request, a feature-heavy request, and the outcome-based prompt. |
| 5 | Open Ask Gemini | Content + screenshot | Point to Ask Gemini in the top-right corner of a blank native Google Sheet. |
| 6 | Paste the Prompt | Content | Enter the copyable prompt and submit it without adding unrelated requirements. |
| 7 | Review Before Inserting | Content + screenshot | Inspect the proposed columns, sample rows, and status wording before touching the sheet. |
| 8 | Put Review in Order | Ordering | Order: check structure → check sample data → refine if needed → insert. |
| 9 | Refine One Thing | Content | Ask Gemini to replace vague statuses with Draft, Review, Scheduled, and Published. |
| 10 | Insert Only When Ready | Callout | Explain that Insert commits the generated table to the spreadsheet; preview first. |
| 11 | Fix a Vague Request | Content | Rewrite “Make it better” as one observable change, such as adding a Campaign column. |
| 12 | Insert or Revise? | Decision quiz | Given a table missing Deadline, choose Revise rather than Insert or Retry without guidance. |
| 13 | Add a Useful Rule | Content | Add one constraint: deadlines should use future dates and status values should be consistent. |
| 14 | Reuse the Pattern | Content | Show how the same prompt structure works for hiring, events, inventory, or project tracking. |
| 15 | Build Your Tracker | Optional practice | Ask the learner to generate a tracker for one real responsibility using non-sensitive data. |
| 16 | Check the Result | Multi-choice | Select all criteria that prove the table is usable: right columns, realistic rows, consistent states. |
| 17 | Your Tracker Is Ready | Content + screenshot | Show the inserted table and name the next behaviour: refine before adding more rows. |
| 18 | Purpose Before Columns | Takeaway + copy prompt | State the principle and provide the reusable prompt for direct copying. |

### Interaction plan

| Screen | Interaction | Correct-answer principle |
| ---: | --- | --- |
| 4 | Choose the strongest prompt | A useful prompt states the job, required structure, and expected output. |
| 8 | Order the review workflow | Review and refine generated content before inserting it. |
| 12 | Decide whether to insert | Missing required structure is a reason to revise, not accept the first output. |
| 16 | Verify the artifact | Success is based on usability and consistency, not visual polish alone. |

Wrong-answer feedback must identify the missing prompt ingredient or skipped review step, then direct the learner to the smallest correction.

### Screenshot brief

| Screen | Screenshot | Capture instruction |
| ---: | --- | --- |
| 1 | Finished tracker | Show six columns and five realistic rows; keep all data fictional. |
| 5 | Ask Gemini entry point | Include enough of the Sheets toolbar to orient the learner. |
| 7 | Generated table preview | Show the preview and Insert/Retry/refinement controls. |
| 9 | Refined status values | Focus on the changed Status column. |
| 17 | Inserted tracker | Show the final table inside the sheet, tightly cropped. |

### Official sources

- [Collaborate with Gemini in Google Sheets](https://support.google.com/docs/answer/14356410?hl=en) — opening Ask Gemini, creating and refining tables, inserting output, and native Sheets requirements.
- [Use tables in Google Sheets](https://support.google.com/docs/answer/14239833?hl=en) — table structure and column types.

---

## Lesson 2: Clean Messy Data Fast

### Lesson definition

- **Immediate win:** Turn inconsistent rows into an analysis-ready table.
- **Scenario:** An expense export contains mixed dates, inconsistent currency, blank rows, and `N/A` placeholders.
- **Artifact:** A clean expense table with consistent date and currency formats.
- **Primary AI skill:** Use a precise multi-action prompt and review the action preview.
- **Mental model:** “Clean” is a set of explicit rules, not a universal result.
- **Common mistake:** Applying a broad cleanup request without naming the target range or checking what Gemini will change.
- **Content boundary:** Do not teach advanced deduplication judgment, scripts, or data pipelines.
- **Success criteria:** Dates use DD/MM/YYYY, Amount is currency, blank rows are removed, `N/A` is cleared, and unrelated cells remain unchanged.

### Copyable prompt

```text
Clean this table. Standardize all dates as DD/MM/YYYY, format Amount as currency, replace “N/A” with blank cells, remove empty rows, and format the range as a table. Show me the planned changes before applying them.
```

### 18-screen outline

| Screen | Working heading | Type | Purpose |
| ---: | --- | --- | --- |
| 1 | Clean Data, Clear Answers | Content + screenshot | Show messy and cleaned versions of the expense table, with the clean result dominant. |
| 2 | Define What Clean Means | Content | Explain that consistent formats and explicit missing-value rules make later analysis reliable. |
| 3 | Name Every Change | Content | Break the prompt into target data, cleanup rules, and a preview request. |
| 4 | Which Prompt Is Safer? | Single choice | Choose the prompt that identifies exact changes and asks for a preview. |
| 5 | Focus the Right Tab | Content + screenshot | Open Ask Gemini and select only the Expense Export tab as the source. |
| 6 | Run the Cleanup Prompt | Content | Submit the prompt and wait for Gemini’s proposed actions. |
| 7 | Read the Action Preview | Content + screenshot | Inspect formatting, replacement, deletion, and table-format actions before applying. |
| 8 | Review in the Right Order | Ordering | Order: confirm range → inspect rules → spot-check examples → apply. |
| 9 | Apply and Spot-Check | Content | Apply the actions, then compare one date, one amount, one blank row, and one `N/A` cell. |
| 10 | Undo Has a Window | Callout | Explain that Undo is available after an action but should be used before making further changes. |
| 11 | Repair “Clean This” | Content | Replace the vague request with measurable formatting and replacement rules. |
| 12 | Apply or Revise? | Decision quiz | If Gemini proposes deleting rows with partial data, choose revise and narrow “empty rows.” |
| 13 | Protect Important Values | Content | Add a constraint: do not change descriptions, vendor names, or non-empty amounts. |
| 14 | Use It on Exports | Content | Apply the method to CRM, survey, payment, or event-registration exports. |
| 15 | Clean a Safe Copy | Optional practice | Duplicate a non-sensitive tab and define three cleanup rules before prompting Gemini. |
| 16 | Verify Five Changes | Matching | Match each cleanup rule to the cell or row that proves it worked. |
| 17 | Ready for Analysis | Content + screenshot | Show the clean table and explain that predictable data supports reliable formulas and charts. |
| 18 | Rules Beat “Clean” | Takeaway + copy prompt | State the principle and provide the full cleanup prompt for copying. |

### Interaction plan

| Screen | Interaction | Correct-answer principle |
| ---: | --- | --- |
| 4 | Select the safer cleanup prompt | Explicit rules reduce unintended edits and make review possible. |
| 8 | Order the action review | Confirm scope and rules before applying changes. |
| 12 | Decide whether to apply | A risky interpretation must be narrowed before approval. |
| 16 | Match rules to evidence | Every requested change needs a visible verification point. |

Wrong-answer feedback must explain the difference between a vague quality label and a testable cleanup rule.

### Screenshot brief

| Screen | Screenshot | Capture instruction |
| ---: | --- | --- |
| 1 | Messy versus clean table | Use a simple split composition with the clean result larger. |
| 5 | Source-tab selector | Show only the Expense Export tab selected for Gemini. |
| 7 | Action preview | Include the affected range and proposed action list. |
| 9 | Four spot checks | Annotate one date, amount, cleared placeholder, and removed blank row. |
| 17 | Final clean table | Show consistent date and currency columns with no personal data. |

### Official sources

- [Collaborate with Gemini in Google Sheets](https://support.google.com/docs/answer/14356410?hl=en) — action previews, find and replace, number formats, row deletion, table formatting, Apply, and Undo.
- [Edit and format a spreadsheet](https://support.google.com/docs/answer/46973?hl=en) — standard Sheets formatting behaviour.

---

## Lesson 3: Fill and Categorize Rows

### Lesson definition

- **Immediate win:** Categorize customer requests and flag genuinely urgent cases.
- **Scenario:** A customer-support table contains request text but no Category or Priority values.
- **Artifact:** A completed request table using Billing, Technical, Account, or Other, with rule-based High priority flags.
- **Primary AI skill:** Fill structured columns from row context using fixed categories and decision rules.
- **Mental model:** AI classification becomes more consistent when labels are limited and each label has a clear rule.
- **Common mistake:** Asking Gemini to judge “importance” without defining what High priority means.
- **Content boundary:** Do not teach sentiment analysis, model evaluation, or automated customer decisions.
- **Success criteria:** Every non-empty request has one allowed category, High priority follows the stated triggers, and at least five sample rows are manually checked.

### Copyable prompt

```text
Categorize each request as Billing, Technical, Account, or Other based on the request text. Add High priority only when the request mentions a blocked account, payment failure, or urgent deadline.
```

### 18-screen outline

| Screen | Working heading | Type | Purpose |
| ---: | --- | --- | --- |
| 1 | Classify Rows in Seconds | Content + screenshot | Show completed Category and Priority columns beside realistic request text. |
| 2 | Labels Need Boundaries | Content | Explain that fixed categories prevent near-duplicate labels such as Payment, Billing Issue, and Invoice. |
| 3 | Define the Decision Rules | Content | Identify the source text, allowed labels, and exact High-priority triggers. |
| 4 | Choose Clear Categories | Matching | Match sample requests to the four allowed categories using the written rules. |
| 5 | Add Two Output Columns | Content + screenshot | Add Category and Priority to a native Sheets table before asking AI to fill them. |
| 6 | Focus on Request Text | Content | Select the relevant table or tab so Gemini uses the request text rather than unrelated notes. |
| 7 | Run the Classification | Content + screenshot | Submit the prompt and inspect the proposed or generated column values. |
| 8 | Check Before Filling Down | Ordering | Order: confirm labels → test sample rows → inspect edge cases → fill remaining rows. |
| 9 | Sample Five Different Rows | Content | Check one Billing, Technical, Account, Other, and High-priority result against the source text. |
| 10 | Availability Can Differ | Callout | Note that AI columns and prompt-based filling may vary by plan, language, or region. |
| 11 | Fix a Subjective Rule | Content | Replace “mark important requests High” with explicit triggers that another person could apply. |
| 12 | Which Result Needs Review? | Decision quiz | Choose an ambiguous “I need help today” request rather than a clear payment failure or password question. |
| 13 | Add an Unknown Rule | Content | Tell Gemini to leave Priority blank when no listed trigger is present instead of guessing. |
| 14 | Reuse Fixed Labels | Content | Show the same pattern for lead type, expense category, content theme, or feedback topic. |
| 15 | Classify Your Rows | Optional practice | Use a safe sample or real non-sensitive table and define no more than five labels. |
| 16 | Audit the Output | Multi-choice | Select the checks required before accepting the completed columns. |
| 17 | Consistent Labels, Faster Work | Content + screenshot | Show the final table and connect consistent labels to faster filtering and routing. |
| 18 | Rules Create Consistency | Takeaway + copy prompt | State the principle and provide the classification prompt for direct copying. |

### Interaction plan

| Screen | Interaction | Correct-answer principle |
| ---: | --- | --- |
| 4 | Match requests to labels | Categories must be mutually understandable and applied from the row evidence. |
| 8 | Order the fill workflow | Test labels and edge cases before generating a full column. |
| 12 | Identify the ambiguous row | AI should not infer urgency when the stated trigger is absent. |
| 16 | Select audit checks | Verify allowed labels, rule adherence, blanks, and representative samples. |

Wrong-answer feedback must quote the applicable classification rule in paraphrase and show which evidence is missing or present.

### Screenshot brief

| Screen | Screenshot | Capture instruction |
| ---: | --- | --- |
| 1 | Completed classified table | Show Request, Category, and Priority with fictional customer text. |
| 5 | Empty output columns | Focus on the new Category and Priority headers. |
| 7 | AI-generated values | Show the first results and the relevant Gemini control. |
| 9 | Five-row audit | Use subtle annotations to connect each output to source wording. |
| 17 | Final table | Show consistent labels ready for filtering. |

### Official sources

- [Use the AI function in Google Sheets](https://support.google.com/docs/answer/15877199?hl=en) — generating, summarizing, categorizing, AI columns, and fill-column availability.
- [Collaborate with Gemini in Google Sheets](https://support.google.com/docs/answer/14356410?hl=en) — filling ranges and focusing Gemini on specific tables or tabs.

---

## Lesson 4: Write and Fix Formulas

### Lesson definition

- **Immediate win:** Generate two useful formulas without memorizing syntax.
- **Scenario:** A task tracker needs Days Until Due and Overdue columns.
- **Artifact:** Working formulas that handle completed tasks and missing due dates correctly.
- **Primary AI skill:** Describe formula behaviour in plain English, insert the result, and test edge cases.
- **Mental model:** A formula prompt should define inputs, expected output, and exceptions.
- **Common mistake:** Testing only the first normal row and ignoring blank dates or completed tasks.
- **Content boundary:** Do not teach a formula catalogue, array formulas, `QUERY`, or advanced references.
- **Success criteria:** Normal future dates return a day count, blank dates remain blank, overdue incomplete tasks return Yes, and completed tasks never return Yes.

### Copyable prompt

```text
Create a formula for Days Until Due using the Due Date in column D. Leave the cell blank when there is no due date. Then create an Overdue formula that returns “Yes” only when the due date has passed and Status is not Done.
```

### 18-screen outline

| Screen | Working heading | Type | Purpose |
| ---: | --- | --- | --- |
| 1 | Describe, Don’t Memorize | Content + screenshot | Show the two working calculated columns with future, overdue, blank, and completed examples. |
| 2 | Formulas Are Rules | Content | Explain that the learner supplies the business rule while Gemini translates it into syntax. |
| 3 | Name Inputs and Exceptions | Content | Break the prompt into source columns, desired output, and blank/completed edge cases. |
| 4 | Which Prompt Can Be Tested? | Single choice | Choose the prompt that defines Due Date, Status, output, and exceptions. |
| 5 | Start From the Target Cell | Content + screenshot | Select the first Days Until Due cell and open formula help through Ask Gemini. |
| 6 | Generate the First Formula | Content | Request the Days Until Due formula and read Gemini’s explanation before inserting. |
| 7 | Insert, Then Test | Content + screenshot | Insert the formula and test a future date and a blank date. |
| 8 | Order the Formula Check | Ordering | Order: read formula → insert one cell → test normal case → test edge case → fill down. |
| 9 | Add the Overdue Rule | Content | Generate the second formula using both Due Date and Status. |
| 10 | Correct Syntax Can Be Wrong | Callout | A formula can calculate successfully but still violate the intended business rule. |
| 11 | Fix the Missing Exception | Content | Add “Status is not Done” when completed tasks are incorrectly marked overdue. |
| 12 | Insert or Revise? | Decision quiz | If blank dates show a number or error, revise the formula before filling the column. |
| 13 | Use Fix Carefully | Content | When Sheets shows an error, use Fix, then re-test behaviour instead of trusting syntax repair alone. |
| 14 | Reuse the Method | Content | Apply input + output + exceptions to commissions, budgets, service levels, or inventory alerts. |
| 15 | Describe One Formula | Optional practice | Ask the learner to describe a real calculation without naming any formula function. |
| 16 | Test Four Cases | Matching | Match future, overdue, blank, and completed rows to the expected outputs. |
| 17 | Two Columns That Work | Content + screenshot | Show the filled calculated columns and the four passing test cases. |
| 18 | Behaviour Before Syntax | Takeaway + copy prompt | State the principle and provide the complete formula prompt for copying. |

### Interaction plan

| Screen | Interaction | Correct-answer principle |
| ---: | --- | --- |
| 4 | Select the testable formula prompt | Inputs, outputs, and exceptions make formula behaviour verifiable. |
| 8 | Order formula validation | Validate one cell and edge cases before filling the full column. |
| 12 | Decide whether to insert or revise | An incorrect edge case is a logic failure even if the formula has no syntax error. |
| 16 | Match cases to expected output | A formula is complete only when normal and exceptional cases behave correctly. |

Wrong-answer feedback must distinguish syntax correctness from business-rule correctness.

### Screenshot brief

| Screen | Screenshot | Capture instruction |
| ---: | --- | --- |
| 1 | Completed calculated columns | Include four rows covering all required test cases. |
| 5 | Selected target cell | Show the cell and formula-generation entry point. |
| 7 | Formula and first tests | Keep the formula bar readable and show one blank row. |
| 13 | Fix formula action | Capture the error state and Fix control without unrelated UI. |
| 17 | Final verified columns | Annotate future, overdue, blank, and completed outputs. |

### Official sources

- [Collaborate with Gemini in Google Sheets](https://support.google.com/docs/answer/14356410?hl=en) — generating, inserting, retrying, and fixing formulas with Gemini.
- [Google Sheets function list](https://support.google.com/docs/table/25273?hl=en) — authoritative syntax reference used during editorial fact-checking.

---

## Unit 2: Let AI Find and Explain Answers

## Lesson 5: Highlight What Needs Attention

### Lesson definition

- **Immediate win:** Make urgent and blocked work visible without manually formatting rows.
- **Scenario:** A project deadline tracker contains mixed status values and no visual priority system.
- **Artifact:** A tracker with a controlled Status dropdown, useful highlighting, and Blocked work shown first.
- **Primary AI skill:** Ask Gemini to perform several related sheet actions through one reviewable prompt.
- **Mental model:** Every colour or sort rule should support a specific decision.
- **Common mistake:** Adding colour for decoration or applying a sort before checking whether headers and the full table are included.
- **Content boundary:** Do not teach custom conditional-format formulas or complex project-management workflows.
- **Success criteria:** Status values are controlled, overdue and near-due rules do not conflict, Blocked tasks appear first, and completed tasks are not falsely highlighted.

### Copyable prompt

```text
Add a Status dropdown with Not Started, In Progress, Blocked, and Done. Highlight overdue rows in red, tasks due within seven days in yellow, and sort the table with Blocked tasks first.
```

### 18-screen outline

| Screen | Working heading | Type | Purpose |
| ---: | --- | --- | --- |
| 1 | See Priorities Instantly | Content + screenshot | Show the completed tracker with blocked and time-sensitive work clearly visible. |
| 2 | Colour Must Drive Action | Content | Explain that red, yellow, and status order should answer “What needs attention now?” |
| 3 | Combine Related Actions | Content | Break the prompt into controlled status, time rules, and sort order. |
| 4 | Which Rule Is Clear? | Single choice | Choose the rule that defines exact statuses, date conditions, and desired ordering. |
| 5 | Confirm the Table Range | Content + screenshot | Focus Gemini on the project tracker and confirm headers are included. |
| 6 | Run the Action Prompt | Content | Submit the prompt and wait for the action preview rather than editing manually. |
| 7 | Inspect Every Action | Content + screenshot | Review dropdown, conditional-format, and sort actions separately. |
| 8 | Order the Safety Check | Ordering | Order: confirm range → inspect status options → compare colour rules → inspect sort. |
| 9 | Apply the Actions | Content | Apply, then test one Blocked, overdue, near-due, and Done row. |
| 10 | Rules Can Overlap | Callout | Explain that an overdue task is also within seven days; precedence must make red remain meaningful. |
| 11 | Fix Conflicting Colours | Content | Refine the rules so overdue rows are red and only future tasks due within seven days are yellow. |
| 12 | Apply or Revise? | Decision quiz | If Done tasks are red because their due date passed, choose revise and exclude Done. |
| 13 | Add One Decision Rule | Content | Add “do not highlight completed tasks” instead of adding more colours. |
| 14 | Reuse the Workflow | Content | Apply the pattern to approvals, stock levels, hiring stages, or invoice follow-up. |
| 15 | Highlight Real Priorities | Optional practice | Use a safe tracker and define one status list plus two non-overlapping attention rules. |
| 16 | Verify the Visual Logic | True/false set | Judge four rows against the intended dropdown, colour, and sort behaviour. |
| 17 | Attention Without Hunting | Content + screenshot | Show the final ordered tracker and reinforce the one-glance decision benefit. |
| 18 | Format for Decisions | Takeaway + copy prompt | State the principle and provide the complete action prompt for copying. |

### Interaction plan

| Screen | Interaction | Correct-answer principle |
| ---: | --- | --- |
| 4 | Choose the clearest action rule | Statuses, date conditions, and output order must be explicit. |
| 8 | Order the action review | Each proposed action needs independent review before the combined change is applied. |
| 12 | Decide whether to apply | Completed rows must be excluded when the colour is meant to signal active risk. |
| 16 | Judge sample rows | Visual logic is correct only when every representative state behaves as intended. |

Wrong-answer feedback must explain which decision the formatting is supposed to support and why the selected rule weakens it.

### Screenshot brief

| Screen | Screenshot | Capture instruction |
| ---: | --- | --- |
| 1 | Final prioritized tracker | Show controlled statuses plus red and yellow rows. |
| 5 | Selected source table | Include headers and the full task range. |
| 7 | Multi-action preview | Show dropdown, formatting, and sort actions in the preview. |
| 11 | Corrected rule logic | Focus on the difference between overdue and due-soon conditions. |
| 17 | Final sorted result | Show Blocked work first and Done work unhighlighted. |

### Official sources

- [Collaborate with Gemini in Google Sheets](https://support.google.com/docs/answer/14356410?hl=en) — dropdowns, conditional formatting, sorting, filters, combined actions, action preview, Apply, and Undo.
- [Use conditional formatting rules](https://support.google.com/docs/answer/78413?hl=en) — condition behaviour and rule ordering used for verification.
- [Insert smart chips and dropdowns](https://support.google.com/docs/answer/12319513?hl=en) — dropdown behaviour and editing.

---

## Lesson 6: Summarize with a Pivot Table

### Lesson definition

- **Immediate win:** Summarize many sales rows by region and month using one prompt.
- **Scenario:** A sales table is too long to answer which region sold the most in each month.
- **Artifact:** A pivot table with Region as rows, Month as columns, and summed Amount as values.
- **Primary AI skill:** Describe grouping and calculation clearly enough for Gemini to build a pivot table.
- **Mental model:** A pivot request needs a row group, optional column group, value, and aggregation.
- **Common mistake:** Asking for “sales by region” without saying whether to count rows or sum Amount.
- **Content boundary:** Do not teach calculated fields, multiple value layers, or advanced pivot customization.
- **Success criteria:** The source range includes headers, groups are correct, Amount uses SUM, blanks are excluded, and one pivot total matches a manual source-data check.

### Copyable prompt

```text
Create a pivot table on a new tab showing total sales by region. Use Region as rows, Month as columns, and sum Amount as values. Exclude blank rows.
```

### 18-screen outline

| Screen | Working heading | Type | Purpose |
| ---: | --- | --- | --- |
| 1 | Summarize Hundreds of Rows | Content + screenshot | Show the finished regional sales pivot next to a small slice of the raw data. |
| 2 | Group, Then Calculate | Content | Explain that a pivot groups repeated labels and calculates one measure for each group. |
| 3 | Name Four Ingredients | Content | Introduce Rows, Columns, Values, and SUM as the complete request. |
| 4 | Count or Sum? | Single choice | For revenue analysis, choose SUM of Amount rather than COUNT of transactions or AVERAGE without context. |
| 5 | Check the Source Table | Content + screenshot | Confirm every source column has a header and Amount contains numbers. |
| 6 | Ask for the Pivot | Content | Submit the copyable prompt with the sales table selected. |
| 7 | Inspect the Preview | Content + screenshot | Check source range, destination tab, Rows, Columns, Values, and aggregation. |
| 8 | Build the Request in Order | Ordering | Order: choose question → choose groups → choose value → choose calculation. |
| 9 | Apply and Read One Cell | Content | Create the pivot and explain one intersection, such as East region in March. |
| 10 | Labels Are Not Numbers | Callout | If Amount is stored as text, SUM may be missing or wrong; clean the source first. |
| 11 | Fix the Wrong Calculation | Content | Change COUNT of Amount to SUM of Amount when the goal is total sales. |
| 12 | Trust or Verify? | Decision quiz | Given a plausible total, choose to compare one pivot cell with filtered source rows. |
| 13 | Exclude Blank Groups | Content | Refine the pivot to remove blank regions or months from the summary. |
| 14 | Reuse the Pattern | Content | Map Region/Month/Amount to Owner/Status/Tasks or Category/Month/Expense. |
| 15 | Ask One Grouped Question | Optional practice | Choose a real table and define one grouping, one value, and one aggregation. |
| 16 | Verify the Pivot | Matching | Match each success criterion to the pivot setting or source-data evidence. |
| 17 | One Table, Clear Answer | Content + screenshot | Show the final pivot and name the highest regional total only after verification. |
| 18 | Grouping Needs a Calculation | Takeaway + copy prompt | State the principle and provide the reusable pivot prompt. |

### Interaction plan

| Screen | Interaction | Correct-answer principle |
| ---: | --- | --- |
| 4 | Select the aggregation | Total revenue requires summing numeric amounts. |
| 8 | Order pivot planning | Start from the business question, then define grouping and calculation. |
| 12 | Decide whether to trust the result | Plausible output still needs a source-data spot check. |
| 16 | Match settings to evidence | Structure and totals must both be verified. |

Wrong-answer feedback must explain the practical difference between counting records and summing their values.

### Screenshot brief

| Screen | Screenshot | Capture instruction |
| ---: | --- | --- |
| 1 | Final pivot and raw rows | Keep the pivot readable and raw data secondary. |
| 5 | Source headers and Amount | Show Region, Month, and numeric Amount values. |
| 7 | Pivot action preview | Include source range and Rows/Columns/Values settings. |
| 9 | One pivot intersection | Highlight one region-month value for explanation. |
| 17 | Verified final pivot | Show blank groups removed and totals visible. |

### Official sources

- [Collaborate with Gemini in Google Sheets](https://support.google.com/docs/answer/14356410?hl=en) — creating and configuring pivot tables through Gemini actions.
- [Create and use pivot tables](https://support.google.com/docs/answer/1272900?hl=en) — headers, Rows, Columns, Values, aggregation, filters, refresh behaviour, and source-detail checking.

---

## Lesson 7: Find Trends and Build a Chart

### Lesson definition

- **Immediate win:** Turn monthly sales data into three evidence-backed insights and one useful chart.
- **Scenario:** A manager wants to understand month-to-month changes without reading every row.
- **Artifact:** Three verified insights and a line chart with Month on the x-axis and Total Sales on the y-axis.
- **Primary AI skill:** Ask Gemini to analyze a table, inspect its reasoning steps, and visualize the result.
- **Mental model:** An insight is a claim tied to evidence; a chart is useful only when its axes answer the same question.
- **Common mistake:** Accepting a polished explanation or chart without checking source values and axes.
- **Content boundary:** Do not teach regression, forecasting, statistical significance, or advanced chart design.
- **Success criteria:** Each insight cites visible data, axes are correct, the chart type fits a time trend, and the learner understands the inserted chart’s data-link limitation.

### Copyable prompt

```text
Identify the three most important month-to-month trends in this table. Then create a line chart with Month on the x-axis and Total Sales on the y-axis. Explain any unusual change using only the data in this sheet.
```

### 18-screen outline

| Screen | Working heading | Type | Purpose |
| ---: | --- | --- | --- |
| 1 | See the Trend Clearly | Content + screenshot | Show the completed line chart and three short insights beside the monthly data. |
| 2 | Claims Need Evidence | Content | Explain that every trend statement must point back to a visible month and value. |
| 3 | Ask for Claim and Chart | Content | Break the prompt into analysis question, evidence boundary, chart type, x-axis, and y-axis. |
| 4 | Pick the Right Chart | Matching | Match time trend to line, category comparison to bar, and proportion to an appropriate whole-part chart. |
| 5 | Focus the Monthly Data | Content + screenshot | Select only the tab containing Month and Total Sales. |
| 6 | Run the Analysis Prompt | Content | Submit the full request and wait for insights and chart proposal. |
| 7 | Open Analysis Steps | Content + screenshot | Inspect which ranges and calculations Gemini used for its conclusions. |
| 8 | Verify in the Right Order | Ordering | Order: check source range → check values → check axes → read interpretation. |
| 9 | Preview the Chart | Content + screenshot | Confirm Month is horizontal, Total Sales is vertical, and the series is complete. |
| 10 | Inserted Charts Use New Data | Callout | Explain that a Gemini-generated chart may be inserted with underlying data on a new tab and may not update with the original dataset. |
| 11 | Fix an Unsupported Claim | Content | Replace a causal claim such as “sales rose because of marketing” with a data-supported observation. |
| 12 | Insert or Revise? | Decision quiz | If axes are reversed or a month is missing, choose revise before inserting. |
| 13 | Add a Data-Only Constraint | Content | Require Gemini to state when the sheet lacks enough evidence to explain a change. |
| 14 | Reuse the Pattern | Content | Apply claim + evidence + chart to expenses, attendance, leads, or response time. |
| 15 | Analyze Your Own Trend | Optional practice | Use a safe time-series table and verify one AI insight manually. |
| 16 | Check Three Claims | Multi-choice | Select only the insights directly supported by the displayed values. |
| 17 | From Rows to a Story | Content + screenshot | Show the verified insights and final chart, with unsupported explanations removed. |
| 18 | Evidence Before Story | Takeaway + copy prompt | State the principle and provide the analysis-and-chart prompt for copying. |

### Interaction plan

| Screen | Interaction | Correct-answer principle |
| ---: | --- | --- |
| 4 | Match questions to chart types | A chart type must reflect the relationship being examined. |
| 8 | Order analysis verification | Validate data selection and values before interpreting the result. |
| 12 | Decide whether to insert | Missing data or incorrect axes makes the chart unfit for use. |
| 16 | Identify supported claims | A trend claim must be traceable to the sheet; causal explanations need evidence not present here. |

Wrong-answer feedback must distinguish observation, comparison, and unsupported causal explanation.

### Screenshot brief

| Screen | Screenshot | Capture instruction |
| ---: | --- | --- |
| 1 | Final chart and insights | Keep the chart dominant and the three insights short. |
| 5 | Focused monthly table | Show Month and Total Sales with no unrelated columns. |
| 7 | Analysis steps | Include the source range and calculation summary. |
| 9 | Chart preview | Make axis labels and all months readable. |
| 17 | Verified final output | Show the chart plus evidence-backed insights only. |

### Official sources

- [Collaborate with Gemini in Google Sheets](https://support.google.com/docs/answer/14356410?hl=en) — data analysis, analysis steps, chart preview, insertion, export, and generated-chart data behaviour.
- [Types of charts and graphs in Google Sheets](https://support.google.com/docs/answer/190718?hl=en) — choosing charts for time trends and category comparisons.

---

## Lesson 8: Turn Data into an Action Report

### Lesson definition

- **Immediate win:** Convert a project tracker into a concise weekly update for a manager.
- **Scenario:** A team tracker contains progress, blockers, owners, and deadlines but no clear summary.
- **Artifact:** A weekly update with Progress, Blocked Work, Deadlines in the Next 14 Days, and Recommended Next Actions.
- **Primary AI skill:** Ask Gemini to summarize a table within strict evidence boundaries and turn findings into actions.
- **Mental model:** AI drafts the report; the learner remains responsible for checking every claim and recommendation.
- **Common mistake:** Letting Gemini fill missing owners, causes, or dates with plausible guesses.
- **Content boundary:** Do not automate message sending, assign work automatically, or make personnel judgments.
- **Success criteria:** Four required sections, no invented facts, named owners only when present, deadlines checked against source rows, and three claims manually verified.

### Copyable prompt

```text
Analyze this project tracker and create a weekly update with four sections: Progress, Blocked Work, Deadlines in the Next 14 Days, and Recommended Next Actions. Mention task owners where available and do not invent missing information.
```

### 18-screen outline

| Screen | Working heading | Type | Purpose |
| ---: | --- | --- | --- |
| 1 | Your Weekly Update, Drafted | Content + screenshot | Show a concise four-section report beside the source project tracker. |
| 2 | Summary Is Not Truth | Content | Explain that Gemini compresses the data, but the learner approves every factual claim. |
| 3 | Define Sections and Limits | Content | Break the prompt into source, four output sections, owner rule, date window, and no-invention constraint. |
| 4 | Which Prompt Is Safer? | Single choice | Choose the prompt that names sections, evidence limits, and missing-information behaviour. |
| 5 | Select the Project Tab | Content + screenshot | Focus Ask Gemini on the current tracker rather than all spreadsheet tabs. |
| 6 | Generate the Update | Content | Submit the prompt and read the response once without editing the source data. |
| 7 | Trace Claims to Rows | Content + screenshot | Check one progress claim, one blocker, and one deadline against the tracker. |
| 8 | Order the Report Review | Ordering | Order: verify claims → check missing facts → assess actions → export or copy. |
| 9 | Inspect Recommended Actions | Content | Confirm that each next action follows from a visible blocker, deadline, or ownership gap. |
| 10 | Missing Means Missing | Callout | If the tracker lacks an owner or reason, the report must say so rather than guess. |
| 11 | Repair an Invented Detail | Content | Add an explicit instruction to label unknown information and remove unsupported explanations. |
| 12 | Export or Revise? | Decision quiz | If one deadline is wrong, choose revise and re-check all date claims before exporting. |
| 13 | Make the Report Scannable | Content | Ask for concise bullets, dates, and owner names only where supported. |
| 14 | Export to Docs | Content + screenshot | Export the verified response to Docs when a shareable update is needed. |
| 15 | Use a Real Safe Sheet | Optional practice | Run the prompt on a non-sensitive tracker and mark three claims for manual verification. |
| 16 | Pass the Trust Check | Multi-choice | Select every condition required before sharing the report. |
| 17 | From Data to Action | Content + screenshot | Show the verified report and identify one next action the manager can take. |
| 18 | AI Drafts, You Decide | Takeaway + copy prompt | State the final course principle and provide the weekly-update prompt. |

### Interaction plan

| Screen | Interaction | Correct-answer principle |
| ---: | --- | --- |
| 4 | Select the safer report prompt | Output structure and evidence boundaries prevent plausible but unsupported detail. |
| 8 | Order report verification | Facts must be checked before recommendations or export. |
| 12 | Decide whether to export | One factual error is a signal to re-check the report, not patch only the visible sentence. |
| 16 | Select sharing criteria | Claims, dates, owners, missing facts, and recommended actions must all be verified. |

Wrong-answer feedback must reinforce that fluent writing is not evidence of factual accuracy.

### Screenshot brief

| Screen | Screenshot | Capture instruction |
| ---: | --- | --- |
| 1 | Tracker and finished report | Show the four report sections with the source table visible in context. |
| 5 | Selected source tab | Show only the Project Tracker tab enabled for Gemini. |
| 7 | Claim-to-row check | Annotate three report claims and their supporting rows. |
| 14 | Export to Docs | Show the export control and destination confirmation. |
| 17 | Verified final report | Display concise bullets with no unsupported details. |

### Official sources

- [Collaborate with Gemini in Google Sheets](https://support.google.com/docs/answer/14356410?hl=en) — sheet summaries, source-tab focus, analysis, source inspection, and Export to Docs.
- [Gemini in Docs, Sheets, Slides, Vids, and Forms](https://support.google.com/docs/answer/15123226?hl=en) — eligible-plan and product-availability context.

---

## Official Source Ledger

Technical claims should be rechecked against these primary sources immediately before final copy or screenshot capture.

| Topic | Primary source | Used in |
| --- | --- | --- |
| Ask Gemini, tables, formulas, analysis, charts, actions, source focus, export | [Collaborate with Gemini in Google Sheets](https://support.google.com/docs/answer/14356410?hl=en) | All lessons |
| AI function, categorization, AI columns, fill availability | [Use the AI function in Google Sheets](https://support.google.com/docs/answer/15877199?hl=en) | Lesson 3 |
| Native Sheets tables and column types | [Use tables in Google Sheets](https://support.google.com/docs/answer/14239833?hl=en) | Lessons 1–3 |
| Pivot creation and verification | [Create and use pivot tables](https://support.google.com/docs/answer/1272900?hl=en) | Lesson 6 |
| Chart selection | [Types of charts and graphs](https://support.google.com/docs/answer/190718?hl=en) | Lesson 7 |
| Conditional-format behaviour | [Use conditional formatting rules](https://support.google.com/docs/answer/78413?hl=en) | Lesson 5 |
| Dropdown behaviour | [Insert smart chips and dropdowns](https://support.google.com/docs/answer/12319513?hl=en) | Lesson 5 |
| Formula syntax reference | [Google Sheets function list](https://support.google.com/docs/table/25273?hl=en) | Lesson 4 |

Do not use creator videos, blogs, or remembered interface behaviour as the technical source of truth. Productivity-creator references may influence pacing, examples, and tone only.

## Global Screenshot Plan

### Capture standards

- Use the same desktop browser, Sheets theme, zoom, and account type throughout.
- Use fictional sample data that exactly matches the lesson copy.
- Capture only the control, source data, preview, or result needed for the screen.
- Use one image per screen and one subtle annotation when the target is not obvious.
- Remove account names, profile photos, email addresses, client names, and Drive paths.
- Save responsive WebP derivatives at the rendered lesson width; do not load full-resolution originals.
- Add alt text that explains the learning purpose, not merely “Google Sheets screenshot.”

### Required visual jobs per lesson

1. Screen 1 — completed artifact.
2. Source selection or entry point.
3. Gemini response, analysis, or action preview.
4. Important review or correction state.
5. Verified final result.
6. Optional confusion or edge-case state.

## Editorial Checklist

### Course-level

- [ ] The course contains exactly 2 units and 8 lessons.
- [ ] Every lesson creates one independent workplace artifact.
- [ ] The first three screens make the immediate win clear.
- [ ] The learning loop remains Describe → Preview → Check → Apply → Reuse.
- [ ] Ask Gemini access and eligible-plan requirements appear before lesson 1.
- [ ] Narrower AI-column, fill, language, or regional availability is labelled where relevant.
- [ ] No lesson teaches Apps Script, macros, BigQuery, advanced formula libraries, or complex dashboards.

### Screen copy

- [ ] Every screen has one instructional job.
- [ ] Working headings are revised to 3–6 words in final copy.
- [ ] Body copy targets 20–45 words and never exceeds 60 visible words.
- [ ] The first learner action occurs by screen 3.
- [ ] Interface labels match the current desktop Google Sheets UI.
- [ ] Manual spreadsheet theory appears only when needed to verify AI output.
- [ ] Tone is direct, practical, lightly playful, and never imitates a named creator’s distinctive wording.

### Prompts and AI safety

- [ ] Every final prompt names the task, data context, rules, and expected output.
- [ ] Every action prompt identifies the target tab, table, or range during final drafting.
- [ ] Prompts explicitly forbid guessing when missing information could change a decision.
- [ ] Generated changes are previewed where the interface provides a preview.
- [ ] Every AI result has two or more visible verification criteria.
- [ ] Formula lessons test normal and edge cases.
- [ ] Analysis lessons separate observation from unsupported explanation.
- [ ] Learners use fictional or non-sensitive data in screenshots and practice.

### Interactions

- [ ] Screens 4, 8, 12, and 16 contain required interactions.
- [ ] Screen 15 contains optional real-data practice.
- [ ] Questions test prompt judgment, review order, evidence, or application—not label recall.
- [ ] Single-choice questions use three credible options.
- [ ] Wrong-answer feedback explains the governing principle and next correction.
- [ ] No passive run exceeds four screens.

### Visuals

- [ ] Every lesson has 4–6 functional screenshots.
- [ ] Screen 1 shows the completed artifact.
- [ ] No screen contains more than one image.
- [ ] Screenshots show an action, location, state change, confusion, or result.
- [ ] All personal and confidential information is removed.
- [ ] Images are cropped, compressed, and supplied with useful alt text.

## Cold-Start Handoff Test

Give this blueprint to a writer who did not design the course. Without additional explanation, the writer must be able to identify:

- What the learner completes in each lesson.
- The primary AI skill and content boundary.
- The purpose of all 18 screens.
- The four required interactions and their answer principles.
- The exact sample data and screenshots required.
- The copyable final prompt.
- The source used to verify each product capability.

If any of these require a new curriculum decision, the lesson is not ready for final copy.

## Definition of Done

The production blueprint is complete when:

1. All 8 lessons contain exactly 18 planned screens.
2. All 8 lessons name one immediate AI win and one visible artifact.
3. All 8 lessons include 4 required interactions and 1 optional practice.
4. All 8 lessons include 4–6 screenshot instructions.
5. All 8 lessons end with a key principle and copyable prompt.
6. Every technical capability is traceable to a current official Google source.
7. Every AI-generated output includes an explicit review and verification step.
8. The cold-start handoff test passes without additional curriculum decisions.

The final course test is simple: **Can the learner use one prompt, verify the result, and save time on a real task before the lesson ends?**

