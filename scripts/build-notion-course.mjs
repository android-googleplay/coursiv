import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const outputFile = join(root, "content", "coursiv", "courses", "notion.json");
const courseId = "notion";
const courseSourceId = "coursiv-original-notion-life-hub";
const officialSources = [
  "https://www.notion.com/help/what-is-a-block",
  "https://www.notion.com/help/intro-to-databases",
  "https://www.notion.com/help/views-filters-and-sorts",
  "https://www.notion.com/help/sharing-and-permissions",
  "https://www.notion.com/help/notion-ai-faqs",
];

const content = (title, text) => ({ kind: "content", title, text });
const callout = (title, text, tone = "tip") => ({ kind: "callout", title, text, tone });
const practice = (title, prompt) => ({ kind: "practice", title, prompt });
const quiz = (question, correct, wrong, feedback) => ({ kind: "quiz", question, options: [correct, ...wrong], feedback });
const truth = (question, answer, feedback) => ({ kind: "truth", question, answer, feedback });
const order = (title, prompt, items) => ({ kind: "order", title, prompt, items });
const match = (title, prompt, pairs) => ({ kind: "match", title, prompt, pairs });

const units = [
  {
    sourceId: "notion-unit-foundations",
    title: "Notion Without the Overwhelm",
    lessons: [
      {
        slug: "your-first-page-in-10-minutes",
        title: "Your First Page in 10 Minutes",
        outcome: "A working Quick Capture page",
        screens: [
          content("Start With One Useful Page", "Notion can build huge systems, but your first win is smaller: one page that catches loose thoughts before they disappear. You will build Quick Capture, then learn only the controls needed to keep it useful."),
          content("Pages Hold Your Work", "A Notion page is a flexible space for text, tasks, images, links, and even other pages. Think of it as a document that can grow with your work instead of a blank canvas you must perfect."),
          content("Blocks Are the Building Pieces", "Every paragraph, heading, checklist item, and callout is a block. Click a block to edit it. Use the six-dot handle beside it to move, duplicate, transform, or delete it."),
          quiz("You want to move one checklist item above another. What should you use?", "The six-dot block handle", ["Workspace settings", "The Share menu"], "The handle controls one block without changing the rest of the page."),
          content("Meet the Slash Command", "Type <b>/</b> on an empty line to open the block menu. Continue typing a block name, such as <b>/todo</b> or <b>/callout</b>, to reach it faster."),
          content("Give Information a Job", "Use a heading to label a section, a to-do for an action, and a callout for something worth noticing. Plain text is best for everything that does not need special treatment."),
          content("Transform Instead of Retyping", "Made a paragraph that should be a task? Open its block menu and choose <b>Turn into</b>. The words stay in place while the block changes its job."),
          order("Build a Clean Section", "Put these actions in the simplest order.", ["Type the section name", "Turn it into a heading", "Add the related blocks underneath"]),
          content("Create a Tiny Capture Structure", "Your Quick Capture page needs only three sections: <b>Tasks</b>, <b>Notes</b>, and <b>Links</b>. This is temporary storage, not a forever filing system."),
          callout("Keep It Frictionless", "If capturing an idea requires choosing five tags, you will stop capturing. Write first. Organize during your weekly reset."),
          content("Fix Mistakes Fast", "Use <b>Cmd/Ctrl + Z</b> when a block moves or changes unexpectedly. For a block you no longer need, open its handle menu and choose <b>Delete</b>."),
          match("Choose the Right Block", "Match each need with the simplest block.", [["A section label", "Heading"], ["An action to finish", "To-do"], ["An important reminder", "Callout"]]),
          content("Formatting Is a Signal", "Bold one phrase that matters. Highlight only true warnings. Too many colors and styles make everything compete, so nothing feels important."),
          content("Name It for the Moment of Use", "Call the page <b>Quick Capture</b>, not Ideas 2026 Final or Personal Knowledge Inbox. A clear name helps you find it when you are rushed."),
          practice("Build Your Quick Capture Page", "Create a page named Quick Capture. Add Tasks, Notes, and Links headings, one to-do, one note, and one useful link."),
          truth("A Quick Capture page should fully organize every item the moment you add it.", false, "Capture should be fast. Organizing belongs in a later review."),
          content("Your First Visible Win", "You now have one trusted place for anything that arrives during the day. Tomorrow, open this page before creating another place to store the same kind of information."),
          callout("Key Takeaway", "Build with blocks, use the slash command, and keep capture simple. A useful page beats a beautiful system you avoid.", "success"),
        ],
      },
      {
        slug: "turn-chaos-into-a-simple-home",
        title: "Turn Chaos Into a Simple Home",
        outcome: "A My Life Hub shell with Work, Life, and Notes",
        screens: [
          content("A Home, Not a Maze", "Your workspace needs a front door. My Life Hub will point to the few places you use often, without hiding them inside a deep folder tree."),
          content("The Sidebar Is Navigation", "The sidebar shows pages you can open quickly. It is not a challenge to fill every level. Keep active pages easy to reach and let search handle the rest."),
          content("Create the Hub", "Make a new page named <b>My Life Hub</b>. Add three headings: <b>Work</b>, <b>Life</b>, and <b>Notes</b>. These are signposts, not new databases."),
          quiz("Where should your most-used dashboard live?", "Near the top level of your sidebar", ["Five pages deep", "Inside Trash"], "Frequent destinations should take as few clicks as possible."),
          content("Nest Pages With Purpose", "A page can live inside another page. Nest reference material when the parent gives it useful context, such as Onboarding Notes inside Work."),
          content("Avoid Folder Thinking", "Notion pages can link to one another and appear in databases. You do not need a perfect folder for every item before you can move forward."),
          content("Link Instead of Duplicate", "Type <b>@</b> followed by a page name, or use <b>Link to page</b>, to create a shortcut. One source page can appear in several useful places without being copied."),
          match("Nest or Link?", "Choose the lighter action.", [["A policy belongs under Work", "Nest the page"], ["Quick Capture is used everywhere", "Link to the page"], ["A page already exists", "Do not duplicate it"]]),
          content("Favorite the Front Door", "Add My Life Hub and Quick Capture to Favorites. Favorites are for a small working set, not every page you have ever created."),
          callout("The Five-Item Rule", "Keep five or fewer pages in Favorites. When everything is favorite, the list stops helping."),
          content("Search Beats Scrolling", "Use <b>Search</b> when you remember a page title or phrase. Search is faster than opening several nested pages and guessing where something lives."),
          quiz("You need Quick Capture under both Work and Life. What is simplest?", "Link to the same page from both sections", ["Create two Quick Capture pages", "Move it back and forth each day"], "Links keep one source of truth while improving access."),
          content("Use Clear Names", "Choose names based on what you expect to find: Client Onboarding, Job Search, or Home Admin. Labels such as Stuff and Misc force your future self to open every page."),
          content("Leave Breathing Room", "A divider or blank space can separate sections, but decoration should not push useful links below the fold. Your dashboard is a control panel, not a mood board."),
          practice("Build the My Life Hub Shell", "Create Work, Life, and Notes sections. Link Quick Capture, add one useful page under each section, then favorite the hub."),
          truth("Duplicating a page is the best way to make it accessible from two sections.", false, "Link to one source page so updates never split across copies."),
          content("Test the Front Door", "Close the page, return to the sidebar, and reopen My Life Hub. Make sure Quick Capture and your three sections are visible without hunting."),
          callout("Key Takeaway", "Keep the hub shallow, link to existing pages, and use Favorites only for frequent destinations.", "success"),
        ],
      },
      {
        slug: "build-one-task-database",
        title: "Build One Task Database",
        outcome: "One Tasks database with five real tasks",
        screens: [
          content("One List for Every Commitment", "Work tasks, errands, and side projects can share one database. A property tells you what each item means, so you do not need a separate list for every part of life."),
          content("A Database Is a Collection of Pages", "Every row in a Notion database is also a page. The row shows structured details; opening it gives you space for notes, links, and context."),
          content("Create Tasks", "Inside My Life Hub, create a full-page database named <b>Tasks</b>. Keep the default title property and rename it <b>Task</b>."),
          quiz("What is each row inside a Notion database?", "A page with properties", ["A fixed spreadsheet cell", "A separate workspace"], "Database items stay flexible because every row opens as a page."),
          content("Property 1: Status", "Add a <b>Status</b> property with To-do, In progress, and Done. Status answers one question: where is this task now?"),
          content("Property 2: Priority", "Add a <b>Select</b> property called Priority with High, Medium, and Low. Use High only when delay has a real consequence."),
          content("Property 3: Due Date", "Add a <b>Date</b> property called Due. Dates are for genuine deadlines or planned work, not a promise that everything is urgent."),
          match("Pick the Property", "Match the information to its property.", [["Client deck is being drafted", "Status"], ["Rent must be paid Friday", "Due"], ["A blocked launch task", "Priority"]]),
          content("Start With Real Tasks", "Add five current commitments: one work deadline, one meeting follow-up, one job or career action, one life admin item, and one side-project step."),
          callout("Do Not Add More Fields Yet", "Owner, effort, category, energy, and formulas sound useful. Add a property only after you repeatedly need a decision it can support."),
          content("Open a Task Page", "Open your meeting follow-up task. Add the context, the expected result, and any useful link inside the page body. Keep properties for facts you need to filter."),
          quiz("Where should a long meeting brief live?", "Inside the task page body", ["Inside the Priority property", "In the task title"], "The page body holds context; properties keep the list scannable."),
          content("Write Action Titles", "Begin task names with a verb: Send recap, Review deck, Book dentist. A noun such as Presentation describes a topic but does not tell you what done means."),
          content("Define Done", "Before saving an important task, ask what visible result proves completion. Submit revised deck is clearer than Work on deck."),
          practice("Add Five Real Tasks", "Create five verb-led tasks. Give each a Status, Priority, and Due date, then add context inside at least one task page."),
          order("Capture a New Commitment", "Use this order when a request arrives.", ["Write a verb-led task", "Set only the needed properties", "Add context inside the task page"]),
          content("One Database, Less Maintenance", "You now have one trusted Tasks database. Different views will show work and life separately later, without creating duplicate storage."),
          callout("Key Takeaway", "Every task is a page. Use only Task, Status, Priority, and Due until real usage proves you need more.", "success"),
        ],
      },
      {
        slug: "see-your-work-your-way",
        title: "See Your Work Your Way",
        outcome: "Today, This Week, and Done task views",
        screens: [
          content("Same Tasks, Different Lenses", "A view changes how one database appears. Your tasks stay in one place while a table, board, or calendar answers a different question."),
          content("Start With Table", "Table is best for scanning properties and cleaning data. Keep it as your All Tasks view so you always have one unfiltered place to check."),
          content("Add a Board", "Create a Board view grouped by Status. Move a card between columns to update its status while keeping the same underlying task page."),
          quiz("Moving a task card from To-do to Done changes what?", "The task's Status property", ["The database it belongs to", "Its page permissions"], "A board visualizes and edits the same database properties."),
          content("Add a Calendar", "Create a Calendar view using Due. Tasks without a due date will not appear on the calendar, but they remain safely stored in Tasks."),
          content("Views Do Not Duplicate Data", "Edit a task title in Calendar and the change appears in Table and Board. There is still only one task page."),
          content("Filter for Today", "Duplicate your table view, name it <b>Today</b>, and filter Due to today. Add a second filter that hides tasks with Status Done."),
          order("Create a Useful View", "Put the setup steps in order.", ["Duplicate or add a view", "Choose its layout", "Apply filters and sorting", "Give it a clear name"]),
          content("Filter for This Week", "Create <b>This Week</b> and show unfinished tasks due within the current week. This view turns a long list into a short planning surface."),
          callout("Empty Can Be Good", "An empty Today view means nothing is due today. Do not invent busywork just to make the dashboard look active."),
          content("Create a Done View", "Add a List view named <b>Done</b> filtered to Status Done. Sort by Due descending so recent wins appear first."),
          match("Choose the View", "Match each question to a view.", [["What needs attention today?", "Filtered table"], ["Where is work getting stuck?", "Status board"], ["When are deadlines landing?", "Calendar"]]),
          content("Hide Visual Noise", "Each view can hide properties it does not need. Today may show Priority and Due, while Calendar may hide Status to keep each card short."),
          content("Sort for Decisions", "In Today, sort High priority first and then earliest Due. Sorting should help you choose the next action, not simply make the table look tidy."),
          practice("Create Three Working Views", "Build Today, This Week, and Done from the same Tasks database. Confirm that editing one task updates every view."),
          truth("A new database view creates a separate copy of every task.", false, "Views are different presentations of one shared set of task pages."),
          content("Run the Thirty-Second Test", "Open Tasks and find today's work, this week's deadlines, and your latest completed task. If any answer takes longer than thirty seconds, simplify the filters or labels."),
          callout("Key Takeaway", "Store tasks once. Use views, filters, and sorting to reveal the right work at the right moment.", "success"),
        ],
      },
    ],
  },
  {
    sourceId: "notion-unit-life-hub",
    title: "Make Notion Work for Your Life",
    lessons: [
      {
        slug: "notes-you-will-actually-reuse",
        title: "Notes You’ll Actually Reuse",
        outcome: "A Notes database and meeting-note template",
        screens: [
          content("Notes Need a Return Path", "A note is useful only if you can find and act on it later. You will create one Notes database and one repeatable meeting template."),
          content("Create Notes", "Create a database named <b>Notes</b>. Keep the title property, then add a Date property and a Type select with Meeting, Reference, and Idea."),
          content("Every Note Is a Page", "The database row keeps the title, date, and type visible. Open the row to write the full note, add links, or mention related pages."),
          quiz("Where should the full meeting discussion live?", "Inside the note page body", ["Inside the Type property", "In the database title"], "Properties help retrieval; the page body holds the actual note."),
          content("Use a Repeatable Shape", "Create three headings inside a meeting note: <b>Context</b>, <b>Key Points</b>, and <b>Next Actions</b>. This makes scanning easier before the next meeting."),
          content("Context Explains Why", "Write one or two lines on the meeting goal, attendees, and decision needed. Do not transcribe the calendar invitation."),
          content("Key Points Capture Meaning", "Record decisions, constraints, and useful evidence. Skip sentences that merely repeat what everyone already knew."),
          match("Place the Note", "Match each detail to its section.", [["Choose launch date Friday", "Key Points"], ["Agree owners for launch tasks", "Context"], ["Send revised schedule", "Next Actions"]]),
          content("Next Actions Need Owners", "Write each action with a verb, owner, and date when known. If the action belongs to you, also add it to Tasks after the meeting."),
          callout("Notes Are Not Tasks", "Notes preserve context. Tasks drive action. Do not rely on a bullet buried inside meeting notes for something you must deliver."),
          content("Save It as a Template", "Open the database template menu, create a new template, and add the three headings. New meeting notes can now start ready instead of blank."),
          quiz("A follow-up belongs to you and has a Friday deadline. Where should it go?", "In Next Actions and the Tasks database", ["Only in meeting notes", "Only in Quick Capture forever"], "Keep the context in Notes and the commitment in Tasks."),
          content("Name Notes for Retrieval", "Use names such as Weekly Sync — Aug 4 or Client Launch Decision. Avoid Meeting Notes, because the title will become meaningless after several weeks."),
          content("Keep the Database Small", "Do not create separate databases for meetings, ideas, and references. The Type property already separates them when a view needs to."),
          practice("Create Your Meeting Template", "Build Notes with Date and Type. Save a template containing Context, Key Points, and Next Actions, then create one sample meeting note."),
          truth("Every kind of note needs its own database.", false, "One Notes database plus a Type property is simpler to maintain and search."),
          content("Test Future You", "Search for the sample note, open it, and identify the decision and next action in under thirty seconds. Rename or simplify sections if you cannot."),
          callout("Key Takeaway", "Store notes once, use a predictable template, and move personal commitments into Tasks.", "success"),
        ],
      },
      {
        slug: "plan-your-week-in-5-minutes",
        title: "Plan Your Week in 5 Minutes",
        outcome: "A daily dashboard and five-minute weekly reset",
        screens: [
          content("Turn the Hub Into a Daily Tool", "Your My Life Hub already has navigation. Now it will show the small set of tasks and notes you need without opening full databases."),
          content("Linked Views Reuse the Source", "A linked view displays an existing database somewhere else. It does not copy the data, so edits still update the original Tasks or Notes database."),
          content("Add Today to the Hub", "Under Work, insert a linked view of Tasks. Select the Today view or recreate its filters, then hide every property except Status, Priority, and Due."),
          quiz("What happens when you complete a task in a linked Today view?", "The original task is updated", ["Only the dashboard card changes", "A duplicate task is created"], "Linked views edit the same source database."),
          content("Add This Week", "Place a linked This Week view below Today. Keep it collapsed or lower on the page so urgent work stays visible first."),
          content("Add Recent Notes", "Under Notes, link the Notes database. Sort Date newest first and limit your attention to recent meeting and reference notes."),
          content("Keep Quick Capture One Tap Away", "Put the Quick Capture link near the top of My Life Hub. Capture first when interrupted; process those items during your reset."),
          order("The Five-Minute Reset", "Choose the weekly reset order.", ["Empty Quick Capture", "Update overdue task dates or status", "Review the next seven days", "Choose the three most important outcomes"]),
          content("Minute 1: Empty Capture", "Turn each captured item into a task, move it into a useful note, or delete it. Do not leave processed items behind."),
          callout("Delete Is a Decision", "Not every thought deserves a task or permanent note. Removing low-value items keeps the system trustworthy."),
          content("Minute 2: Repair Reality", "Check overdue tasks. Complete, reschedule, or remove them. Repeatedly moving a task may mean it is vague, unnecessary, or blocked."),
          quiz("A task has been rescheduled three weeks in a row. What is the best next move?", "Clarify, delete, or break it into a real next action", ["Raise its priority automatically", "Create another copy"], "Repeated delay is a signal to rethink the commitment."),
          content("Minutes 3–4: Look Ahead", "Review This Week and upcoming deadlines. Add missing commitments, but avoid filling every day before new work arrives."),
          content("Minute 5: Pick Three Outcomes", "Choose three results that would make the week successful. Make sure each result has at least one clear task."),
          practice("Assemble the Daily Dashboard", "Add linked Today, This Week, and Recent Notes views to My Life Hub. Place Quick Capture near the top and run one five-minute reset."),
          match("Process the Inbox", "Match each captured item to its next home.", [["Send the revised deck", "Tasks"], ["Useful research summary", "Notes"], ["Old idea with no value", "Delete"]]),
          content("Make It Easy to Reopen", "Favorite My Life Hub and set a personal habit: open it at the start of work and before finishing for the day."),
          callout("Key Takeaway", "Your dashboard shows, but does not duplicate, Tasks and Notes. A five-minute reset keeps those views honest.", "success"),
        ],
      },
      {
        slug: "share-without-oversharing",
        title: "Share Without Oversharing",
        outcome: "One safely shared meeting note",
        screens: [
          content("Share the Result, Not Your Whole Life", "Your hub mixes work and private information. Collaboration starts by choosing the smallest page another person actually needs."),
          content("Private Is the Safe Default", "Keep My Life Hub, Tasks, and Notes private unless collaboration requires access. Share a specific meeting note instead of the entire system."),
          content("Open the Share Menu", "On the meeting note, select <b>Share</b>, invite the intended person, and review the permission before sending. Page access can also affect content nested underneath it."),
          quiz("A teammate needs to read one meeting recap. What should you share?", "That meeting-note page", ["Your entire My Life Hub", "Your whole workspace"], "The narrowest useful access reduces accidental exposure."),
          content("Choose the Smallest Permission", "Use view access for reading, comment access for feedback, and edit access only when the person must change the content."),
          content("Guests Are Page-Specific", "A guest can be invited to selected pages without becoming a full workspace member. This works well for a client, mentor, or external collaborator."),
          content("Comments Keep Feedback Attached", "Select text or use the comment control to ask a focused question. The discussion stays beside the work instead of getting lost in another chat thread."),
          match("Choose the Permission", "Match the need to the lightest permission.", [["Read the final recap", "Can view"], ["Suggest a correction", "Can comment"], ["Co-write the project brief", "Can edit"]]),
          content("Mention With Intention", "Use <b>@name</b> when a specific person needs the update. Avoid mentioning everyone for information that does not require attention."),
          callout("Check the Parent Page", "Before sharing a page, confirm where it lives. Access inherited through a parent can be broader than the invitation you are about to send."),
          content("Public Links Need Extra Care", "Publishing to the web is different from inviting a known person. Do not publish private notes, personal details, internal links, or confidential work."),
          quiz("A client needs to suggest wording but should not rewrite the page. Which access fits?", "Can comment", ["Can edit", "Public web access"], "Comment access supports feedback without allowing direct changes."),
          content("Review Before You Send", "Scan the page body, properties, backlinks, and nested pages. Remove private context that the recipient does not need."),
          content("Test From Their Point of View", "Confirm the recipient can open the intended page and cannot navigate into My Life Hub. If possible, use the permission preview or a separate browser session."),
          practice("Share One Meeting Note Safely", "Choose a sample note, remove private details, invite a trusted person with view or comment access, and verify My Life Hub remains private."),
          truth("Sharing My Life Hub is necessary when someone only needs one meeting note.", false, "Share the smallest useful page and keep the dashboard private."),
          content("Revoke Access When It Ends", "Return to Share after the review or project finishes. Remove guests and public links that no longer have a reason to exist."),
          callout("Key Takeaway", "Share the smallest useful page, grant the lightest permission, and verify access from the recipient's point of view.", "success"),
        ],
      },
      {
        slug: "finish-your-my-life-hub",
        title: "Finish Your My Life Hub",
        outcome: "A complete, tested My Life Hub",
        screens: [
          content("Make the Whole System Work", "You have built every piece. This final lesson connects capture, action, notes, review, and mobile use into one calm workflow."),
          content("Your System Has Four Doors", "My Life Hub is the home. Quick Capture catches interruptions. Tasks holds commitments. Notes holds reusable context. Everything else is optional."),
          content("Check the Top of the Hub", "The first screen should show Quick Capture, Today, and your most useful recent notes. Move anything less important lower."),
          quiz("Which item deserves the highest position on a daily dashboard?", "Today's actionable work", ["A decorative quote", "An archive from last year"], "Daily decisions should appear before decoration and history."),
          content("Remove Duplicate Storage", "Search for extra task lists or note databases created during practice. Move useful items into Tasks or Notes, then archive the empty duplicates."),
          content("Hide Unused Properties", "If a property has not helped you decide, filter, or sort anything, hide or remove it. Simpler databases are faster to maintain."),
          content("Keep the Visual System Quiet", "Use one accent color, clear headings, and limited callouts. Widgets and covers are optional; fast navigation is not."),
          order("From Request to Archive", "Put the complete workflow in order.", ["Capture the request", "Turn it into a clear task", "Schedule and complete it", "Store reusable context in Notes", "Review or archive the result"]),
          content("Set Up Mobile Capture", "Open Notion on your phone, find Quick Capture, and add it to Favorites. Mobile is for fast entry, not rebuilding database settings."),
          callout("Use Desktop for Structure", "Create views, templates, and permissions on desktop or web. Use mobile to capture, check Today, and mark simple tasks done."),
          content("Run a Real Scenario", "Imagine your manager asks for a Friday launch update. Capture the request, create a dated task, and open the task page for context."),
          match("Complete the Workflow", "Match each piece of the launch request to its home.", [["Send Friday launch update", "Tasks"], ["Decision history", "Notes"], ["Unsorted thought during a call", "Quick Capture"]]),
          content("Finish and Preserve Context", "Mark the task Done after sending the update. Save only the decisions or reference material you may need again inside Notes."),
          content("Run the Thirty-Second Test", "From My Life Hub, find today's tasks, your latest note, and Quick Capture. Complete all three checks in under thirty seconds."),
          practice("Complete the Final Challenge", "Process one real request from capture to completion. Then run the thirty-second test on desktop and add one item from mobile."),
          truth("A finished Life Hub should keep growing new databases for every project.", false, "Reuse Tasks and Notes until a real limitation proves another database is necessary."),
          content("Your Maintenance Rule", "Use the system for one week before redesigning it. During the weekly reset, fix only the friction you actually experienced."),
          callout("Course Complete", "You built a simple My Life Hub with one Tasks database, one Notes database, fast capture, focused views, and safe sharing.", "success"),
        ],
      },
    ],
  },
  {
    sourceId: "notion-unit-ai-bonus",
    title: "Optional Bonus",
    lessons: [
      {
        slug: "let-notion-ai-help-not-take-over",
        title: "Let Notion AI Help, Not Take Over",
        outcome: "A checked AI-assisted note and action list",
        screens: [
          content("Optional Means Optional", "Your My Life Hub already works without AI. Continue only if Notion AI is available in your plan or trial; no core workflow depends on it."),
          content("Use AI for Transformation", "AI is most useful when you already have source material. Ask it to summarize, restructure, or extract actions instead of inventing facts from nothing."),
          content("Start With a Messy Note", "Open a non-sensitive sample note containing several ideas. Ask Notion AI to summarize the decisions in three bullets without adding new information."),
          quiz("Which request gives AI the safest job?", "Summarize these notes without adding facts", ["Invent the missing decisions", "Guess what the client secretly wants"], "A bounded transformation is easier to verify than invented context."),
          content("Extract Action Items", "Ask AI to list actions with an owner and due date only when those details appear in the note. Missing information should be marked as unknown."),
          content("Compare With the Source", "Read every generated action against the original note. Remove invented owners, dates, or commitments before moving anything into Tasks."),
          content("Ask Your Workspace", "When workspace search is available, ask a specific question such as: What launch date was agreed in the latest project note? Open the cited page before relying on the answer."),
          order("Use AI Responsibly", "Put the workflow in order.", ["Choose safe source material", "Give a bounded instruction", "Compare the output with the source", "Keep only verified results"]),
          content("Protect Sensitive Information", "Do not paste passwords, private identity details, confidential client data, or information you are not allowed to process. Follow your employer's AI policy."),
          callout("Availability Can Change", "AI features, limits, and plan access may change. Treat the feature as an accelerator, never as a requirement for using your hub."),
          content("A Better Summary Request", "State the source, output shape, limit, and guardrail: Summarize this meeting in three bullets. Include decisions only. Mark unclear points instead of guessing."),
          quiz("AI assigns Friday as a due date, but the source note has no date. What should you do?", "Remove it or mark the date unknown", ["Trust the generated date", "Add it to every task"], "Generated details must be supported by the source."),
          content("Keep Human Decisions Human", "AI can suggest structure, but you decide priority, permission, and whether a commitment belongs in Tasks. Those choices depend on consequences the tool may not know."),
          content("Save the Useful Result", "After checking the summary, keep it in the note page. Move only verified commitments into Tasks, using the same four properties from the core course."),
          practice("Run One Checked AI Assist", "Use a non-sensitive sample note. Generate a three-bullet summary and action list, compare both with the source, and correct every unsupported detail."),
          truth("If AI produces a confident answer, checking the source is unnecessary.", false, "Confidence is not evidence. Verify names, dates, decisions, and commitments."),
          content("Know When to Skip AI", "For a two-line note or one obvious task, manual editing is faster. Use AI only when the time saved is greater than the time needed to check it."),
          callout("Bonus Takeaway", "Give AI bounded transformation jobs, protect sensitive data, verify against the source, and keep the core system usable without it.", "success"),
        ],
      },
    ],
  },
];

function makeBlock(spec, base) {
  if (spec.kind === "content") return [
    { id: `${base}-heading`, type: "heading", text: spec.title, level: 2 },
    { id: `${base}-paragraph`, type: "paragraph", text: spec.text },
  ];
  if (spec.kind === "callout") return [{ id: `${base}-callout`, type: "callout", title: spec.title, text: spec.text, tone: spec.tone }];
  if (spec.kind === "practice") return [{ id: `${base}-practice`, type: "practice", title: spec.title, prompt: spec.prompt, practiceId: base, practiceType: "guided-build" }];
  if (spec.kind === "quiz") return [{
    id: `${base}-quiz`,
    type: "single-choice",
    question: spec.question,
    options: spec.options.map((label, index) => ({ id: `${base}-option-${index + 1}`, label, isCorrect: index === 0 })),
    feedbackCorrect: { text: spec.feedback },
    feedbackIncorrect: { text: "Look for the choice that keeps the system simple and preserves one source of truth." },
  }];
  if (spec.kind === "truth") return [{
    id: `${base}-truth`,
    type: "true-false",
    question: spec.question,
    options: [
      { id: `${base}-true`, label: "True", isCorrect: spec.answer === true },
      { id: `${base}-false`, label: "False", isCorrect: spec.answer === false },
    ],
    feedbackCorrect: { text: spec.feedback },
    feedbackIncorrect: { text: "Recheck the lesson rule, then try again." },
  }];
  if (spec.kind === "order") return [{
    id: `${base}-ordering`,
    type: "ordering-task",
    title: spec.title,
    prompt: spec.prompt,
    items: [...spec.items].reverse(),
    correctItems: spec.items,
    feedbackCorrect: { text: "That sequence keeps each step clear and lightweight." },
    feedbackIncorrect: { text: "Start with the source or capture step, then organize only what is needed." },
  }];
  if (spec.kind === "match") return [{
    id: `${base}-matching`,
    type: "matching-pairs",
    title: spec.title,
    prompt: spec.prompt,
    pairs: spec.pairs.map(([left, right], index) => ({ id: `${base}-pair-${index + 1}`, left, right })),
  }];
  throw new Error(`Unsupported screen kind: ${spec.kind}`);
}

function makeLesson(lesson, unitSourceId, lessonOrder, optional = false) {
  const sourceId = `notion-lesson-${lessonOrder + 1}-${lesson.slug}`;
  const screens = lesson.screens.map((spec, index) => {
    const sequence = String(index + 1).padStart(2, "0");
    const base = `${lesson.slug}-s${sequence}`;
    const interactive = ["quiz", "truth", "order", "match", "practice"].includes(spec.kind);
    return {
      id: base,
      sourcePageId: `${base}-page`,
      order: index,
      type: spec.kind === "content" || spec.kind === "callout" ? "chunk" : spec.kind,
      title: spec.kind === "practice" ? spec.title : undefined,
      presentation: spec.kind === "practice" ? "practice" : spec.kind === "callout" ? "callout" : interactive ? "knowledge-check" : "content",
      interactionPolicy: spec.kind === "practice" ? "optional-practice" : interactive ? "required-interaction" : "read",
      blocks: makeBlock(spec, base),
    };
  });
  return {
    schemaVersion: 3,
    sourceId,
    sourceUnitId: unitSourceId,
    sourceGuideId: courseSourceId,
    slug: lesson.slug,
    title: lesson.title,
    order: lessonOrder,
    readUrl: `/course/${courseId}/lesson/${lesson.slug}`,
    hasAudio: false,
    optional,
    screens,
    blocks: screens.flatMap((screen) => screen.blocks),
    raw: {
      author: "Coursiv Content Team",
      audience: "Gen Z early-career professionals",
      outcome: lesson.outcome,
      authoredAt: "2026-08-04",
      officialSources,
    },
  };
}

let lessonOrder = 0;
const course = {
  schemaVersion: 3,
  id: courseId,
  sourceId: courseSourceId,
  kind: "tool",
  title: "Notion: Build Your Life Hub",
  image: "/images/courses/notion-life-hub.svg",
  localImage: "/images/courses/notion-life-hub.svg",
  duration: "3 hours",
  categories: ["New", "Productivity", "Career", "Pathway"],
  sourceUpdatedAt: "2026-08-04T00:00:00.000Z",
  media: [],
  units: units.map((unit, unitOrder) => ({
    sourceId: unit.sourceId,
    title: unit.title,
    order: unitOrder,
    lessons: unit.lessons.map((lesson) => makeLesson(lesson, unit.sourceId, lessonOrder++, unit.sourceId === "notion-unit-ai-bonus")),
  })),
};

await mkdir(join(root, "content", "coursiv", "courses"), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(course, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  lessons: course.units.flatMap((unit) => unit.lessons).length,
  screens: course.units.flatMap((unit) => unit.lessons).reduce((total, lesson) => total + lesson.screens.length, 0),
}, null, 2));
