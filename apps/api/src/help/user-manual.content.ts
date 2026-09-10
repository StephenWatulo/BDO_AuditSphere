export const MANUAL_TITLE = 'BDO AuditSphere User Manual';
export const MANUAL_VERSION = '1.2';
export const MANUAL_DATE = '8 September 2026';

export interface ManualSection {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
  bullets?: string[];
  figure?: 'engagement-profile' | 'finding-response';
}

export interface ManualChapter {
  title: string;
  sections: ManualSection[];
}

// This is the single source for the PDF, Word and Markdown editions.
export const MANUAL_CHAPTERS: ManualChapter[] = [
  {
    title: 'About this manual',
    sections: [
      { heading: 'Purpose and audience', paragraphs: [
        'BDO AuditSphere supports internal audit planning, engagement delivery, workpapers, evidence, findings, management responses, reporting and follow-up. This manual explains the current application for auditors, engagement leaders, business owners, management reviewers, committee viewers and administrators.',
        'This edition describes the implementation reviewed on 8 September 2026, including the Internal Audit AI Assistant. It is an application operating guide, not a replacement for BDO methodology, professional judgement, engagement terms or your organisation\'s information-handling policies. A visible button does not constitute approval to take a business action. Follow the delegated authority for the engagement.',
        'Screens and actions depend on your account permissions and the record\'s current state. Examples and illustrations use demonstration information. Do not copy example conclusions or dates into a live audit without validating them.',
      ] },
      { heading: 'How to use the guide', bullets: [
        'New users: read chapters 2 to 4, then follow the chapter for your task.',
        'Audit teams: work through the universe, planning, engagement, workpaper and reporting chapters in order.',
        'Management: start with Finding agreement and action owners, then Client portal.',
        'Administrators: review Users and roles, Audit trail, and Troubleshooting before onboarding colleagues.',
        'Use the PDF contents links or bookmarks to jump to a chapter. Use your PDF reader\'s Find command for a button name or an error message.',
      ] },
      { heading: 'Download and edition control', steps: [
        'In the workspace side panel, scroll to Admin. User manual is immediately below Audit trail when that entry is visible to your role.',
        'Click User manual to download the PDF. Use the adjacent format menu for Word (.docx) or Markdown (.md). In collapsed navigation, the manual icon downloads the PDF; expand the navigation to choose another format.',
        'On a small screen, open the navigation menu first, then scroll to Admin. The guide is available to signed-in users; it does not grant access to user administration or audit records.',
        'Check the edition and date on the cover. A downloaded copy does not update automatically. Download a fresh copy after an application release.',
      ] },
    ],
  },
  {
    title: 'Signing in and account security',
    sections: [
      { heading: 'Before you begin', paragraphs: [
        'Obtain the approved application address, organisation identifier if required, and an individual account from your administrator. The local development address is http://localhost:3000; it only works on the computer running the services. A production deployment has its own address. Never use shared demonstration accounts for live client work.',
        'You need a network connection to save changes, upload documents and download reports. The current browser application must not be treated as an offline evidence-capture tool. Preserve unsaved text securely if your connection is interrupted.',
      ] },
      { heading: 'Sign in', steps: [
        'Open the application address. Enter your organisation details where requested, your work email and your password.',
        'Select Sign in. If your organisation has configured Microsoft Entra ID, use its Microsoft sign-in option and complete your organisation\'s authentication checks.',
        'If prompted for multi-factor authentication, enter the current authenticator code or an available recovery code. Do not share either with another person.',
        'Confirm that the displayed identity is yours. Business-owner-only accounts normally open the Client portal; audit staff normally open the workspace. A deep link may take you directly to the requested record.',
      ] },
      { heading: 'Profile, password and MFA', steps: [
        'Open your avatar menu and select the profile or security screen. Maintain your display name and other editable contact details so assignments identify you correctly.',
        'For a local account, use Security > Change password. Supply the current password and a strong replacement that meets the on-screen requirements. For an Entra account, manage the password through Microsoft or your organisation\'s identity support process.',
        'To enrol MFA, start setup on the Security page, scan the displayed QR code with your approved authenticator, and verify a current six-digit code.',
        'Store recovery codes in the approved secure location before closing their one-time display. A recovery code is a credential, not an attachment for an audit file.',
        'Use Sign out in the avatar menu when finished, especially on a shared computer. Lock your workstation when leaving it unattended.',
      ] },
      { heading: 'When sign-in fails', paragraphs: [
        'Check the organisation, email, password and account status before retrying. A suspended or deactivated account must be handled by an administrator. If an authenticator code fails, check the device time and use a current code. Follow your organisation\'s recovery process if you have lost the authenticator.',
        'A session-expired message requires sign-in again. An Internal Server Error is a service problem, not proof of an incorrect password. Note the time and request ID if shown, then contact support. Do not repeatedly create new accounts or change audit records to diagnose a login failure.',
      ] },
    ],
  },
  {
    title: 'Roles, permissions and responsibilities',
    sections: [
      { heading: 'How access works', paragraphs: [
        'The application combines the permissions of all roles assigned to your account. Menu visibility is a convenience; the API checks access when reading or changing data. A missing menu, read-only field or forbidden response may reflect your role rather than a defect. Request the minimum access needed for your responsibilities.',
        'The descriptions below summarise the standard role configuration. Your deployed configuration and any additional roles remain authoritative. Being an engagement lead or being named as an action owner does not, by itself, grant every workflow permission.',
      ] },
      { heading: 'Standard roles', bullets: [
        'Global Administrator: platform-wide capabilities within the organisation, including user administration. Use this role sparingly; it is not a substitute for independent audit review.',
        'Audit Partner and Chief Audit Executive: plan approval, report issue, engagement closure, risk acceptance, workpaper unlocking, restricted-document access and oversight dashboards, in addition to management capabilities.',
        'Audit Manager: manage the universe, plans, engagements, resources and monitoring; approve programmes; sign off workpapers; validate findings and view the audit trail. The standard role does not include report issue, engagement closure, risk acceptance or management agreement.',
        'Senior Auditor: maintain risks and controls, record assessments and control tests, manage programmes, review workpapers, submit findings and export reports, in addition to auditor preparation activities.',
        'Junior Auditor: prepare workpapers, create and edit findings, manage document requests, upload evidence, contribute library drafts, record own time and use AI Sphere. Submission, independent review and export actions require additional permissions.',
        'Business Owner: respond to requests and findings, upload supporting documents and work through the Client portal. This role is not an auditor sign-off role.',
        'Management Reviewer: business-owner response capabilities plus selected workspace reading and report exports. An appropriate role for management review, not independent audit validation.',
        'Audit Committee Viewer: read oversight information and export reports. Cannot edit audit work, agree management responses or validate remediation through this role alone.',
      ] },
      { heading: 'Independence and accountability', paragraphs: [
        'A workpaper preparer cannot review or sign off their own work. Use the actual reviewer\'s account; do not reassign authorship simply to remove the restriction. A platform action owner cannot validate their own finding. External owner names also require an organisational independence check because free-text ownership does not reliably identify a platform account.',
        'The standard audit leadership roles do not automatically have finding:respond. Management agreement is intended for a Business Owner or Management Reviewer; a Global Administrator also has the technical capability. Ask an authorised management representative to agree the finding instead of borrowing credentials.',
      ] },
    ],
  },
  {
    title: 'Navigation and everyday controls',
    sections: [
      { heading: 'Finding your way around', paragraphs: [
        'The workspace is arranged into Universe, Delivery, Knowledge and Admin groups. Home and, where permitted, Client portal are at the top. Select a record title to open its detail view. Breadcrumbs return to its parent list or engagement. Tabs divide a record into working areas without changing the record\'s lifecycle stage.',
        'Use Collapse at the bottom of the desktop sidebar for an icon-only rail. Hover or focus an icon to identify it. On a phone, use Open navigation in the top bar. Wide registers and tab strips may scroll horizontally within their own area.',
      ] },
      { heading: 'Search, lists and assignment pickers', steps: [
        'Use the top search control, or Ctrl+K, to open global search. Use the search inside a register when you only want that record type.',
        'Apply available filters such as stage, severity, status, entity or Mine. Check active filter chips before concluding that a record is missing. Remove filters or clear the search to widen the list.',
        'Select a sortable column heading to change ordering. Use the column control to choose displayed fields and the pagination controls for more results.',
        'In a person picker, open the list and type part of the name or email. The assignment directory contains active accounts in the current organisation. A person who was invited but is not yet active may not appear.',
        'If the picker says Could not load people, use Retry after checking connectivity or signing in again. No active users found means the current search returned no eligible matches, not that a server error should be ignored.',
      ] },
      { heading: 'Saving and workflow actions', paragraphs: [
        'Detail fields commonly open an editor when you click their value or pencil icon. Make the change, then use the Save checkmark; use Cancel or Escape to discard an uncommitted edit. The main workpaper narrative editor saves when you leave a field or use Ctrl+Enter. Follow the behaviour of the particular screen and wait for its saved state before navigating away.',
        'A workflow action such as Agree finding is separate from saving text. Buttons are determined by both state and permission; additional actions may be under More. If a Cannot proceed dialog appears, complete each listed requirement, save those changes, then retry the action. Repeated clicking does not override a guard.',
        'Save errors should be resolved before assuming an edit has persisted. Re-open or refresh the record to verify important changes. A download is a snapshot, not evidence that the record was approved or that a workflow stage changed.',
      ] },
    ],
  },
  {
    title: 'Home dashboards and daily priorities',
    sections: [
      { heading: 'My work', paragraphs: [
        'My work is the auditor\'s starting point. Review assigned work, review attention, upcoming deadlines and time-recording information. Open the underlying record before acting: a dashboard is an overview and may not contain the full instruction, evidence or current conversation.',
      ], steps: [
        'Start with overdue and imminent work. Check who owns each item and whether you have the required preparation or review authority.',
        'Open the linked engagement, workpaper, request or finding. Read the instructions and recent history before editing.',
        'Complete the relevant task in its own screen, then return Home and refresh the view if the summary has not updated.',
      ] },
      { heading: 'Portfolio', paragraphs: [
        'Portfolio is available to accounts with partner-dashboard access. It summarises engagements by stage, hours and utilisation, and highlights overdue milestones. Use it to identify workload, delivery and budget exceptions, then investigate the underlying engagement or resource record.',
        'Actual hours depend on recorded time. An empty utilisation result is not a statement that all staff are idle. Check the reporting period and time-entry completeness before drawing a management conclusion. Budget and charge-rate information is operational information, not a final invoicing calculation.',
      ] },
      { heading: 'Audit committee', paragraphs: [
        'Audit committee is the oversight view for authorised committee and leadership users. Review plan progress, findings, overdue actions and available risk information. Check the population and period before using a chart in a committee discussion.',
        'Use Reports for a downloadable pack or register. A zero count may be valid; a failed data-load message is not a zero count. Retry a failed view and report a persistent error. Users without dashboard permissions may see another starting view or the portal instead of these tabs.',
      ] },
    ],
  },
  {
    title: 'Audit universe and auditable entities',
    sections: [
      { heading: 'Create an entity before linking an audit', paragraphs: [
        'An auditable entity represents the organisation, business unit, location or other audit object selected for an engagement. It is different from a user account and different from an audit engagement. Use a consistent hierarchy and code convention to avoid duplicate records.',
      ], steps: [
        'Open Audit universe and search for the entity by name or code. Expand relevant parent nodes before creating another record.',
        'With universe-management permission, select New entity. Enter Name, Code and Type. Use a unique, meaningful code, for example DEMO-MFG, for an illustrative manufacturing entity.',
        'Choose a Parent when the entity belongs beneath another node. Complete the optional ownership, location, risk or other details shown in the form, as appropriate.',
        'Select Create and confirm the entity appears in the tree. Open it to review its details and linked information.',
        'Return to Engagements > New engagement. In Profile > Auditable entity, search for and select the new entity before creating the engagement.',
      ] },
      { heading: 'Maintain the universe', paragraphs: [
        'Open an entity to inspect its Overview, Processes, Risks and Engagements tabs. Create or edit processes where your role permits it. Link risks to the correct entity or process rather than relying on similar text in a title. Coverage summaries depend on the information recorded in the universe and historical audits.',
        'Removing an entity archives it while historical engagements and findings retain their references. Review dependencies and obtain the appropriate approval before removal. Archiving should not be used to repair an incorrectly named entity when an ordinary edit would preserve continuity.',
      ] },
      { heading: 'If the entity is not available', bullets: [
        'Clear the entity picker search and try its code or a shorter name.',
        'Check that creation completed, that the entity is active rather than archived, and that you are in the correct organisation.',
        'Ask an Audit Manager or another user with universe:manage to create it when New entity is not visible.',
        'Creating a contact under Users does not create an auditable entity. An entity\'s owner is not automatically the lead of every engagement linked to it.',
      ] },
    ],
  },
  {
    title: 'Risks, assessments and controls',
    sections: [
      { heading: 'Build and assess a risk record', steps: [
        'Open Risks. Search first, then choose New risk if the required risk does not already exist.',
        'Enter a unique Code and descriptive Title. Record the risk description and category, then link the relevant entity or process using the controls provided.',
        'Record inherent and residual likelihood and impact, and velocity where appropriate. Use your organisation\'s approved scoring guidance rather than selecting scores only to obtain a desired colour.',
        'Save the risk. Open its details to review links and assessment history.',
        'For a periodic reassessment, use Assess, enter the assessment Period, current scores and Rationale, then save. This records a new assessment instead of merely changing the wording of the risk.',
      ], paragraphs: [
        'The register and residual heat map help compare risks. A rating summarises recorded scores; it does not replace the rationale or evidence. Click a heat-map cell or use register filters to investigate the relevant population. Retired risks should remain traceable to historical work.',
      ] },
      { heading: 'Create and link controls', steps: [
        'Open Controls and search for an existing control. Choose New control where necessary.',
        'Complete Code, Title and description. Select the control Type, Nature and Frequency, identify whether it is a key control, and complete the available owner and entity details.',
        'Save, then use the risk-linking action to select the risks addressed by the control. Review the linked risk list to confirm the intended risk-control relationship.',
        'Keep the control description specific: who performs it, what they do, when it happens, what evidence is retained and how exceptions are handled.',
      ] },
      { heading: 'Record a control test', steps: [
        'Open the control and select the test-recording action with control:test permission.',
        'Choose Design or Operating effectiveness. Complete the period, population, sample size, exceptions and test date where applicable.',
        'Document the Procedure and Conclusion and select the appropriate result. Reconcile exception counts to the supporting workpaper and evidence.',
        'Save and review the test history. Recording a control test does not prepare, review or sign off a workpaper; complete those separate audit-file actions as well.',
      ] },
    ],
  },
  {
    title: 'Annual and multi-year audit plans',
    sections: [
      { heading: 'Create a plan and its items', steps: [
        'Open Plans and select New plan. Complete Title, Fiscal year, Start and End dates and any other applicable fields.',
        'Open the created plan and add plan items. Give each item a clear title and link its entity and other planning references where provided.',
        'Set the risk rating, priority, planned year, quarter, budget hours and leadership information. Priority 1 is high; priority 5 is low.',
        'Document the rationale, including the risk, management request or other reason for coverage. A planned item without an explanation is harder to defend at approval.',
        'Review the schedule and hours by rating. Use the quarter controls or, on a suitable screen, drag items between quarters to reschedule while the plan is editable.',
      ] },
      { heading: 'Approval lifecycle', bullets: [
        'Draft > Submit for approval: at least one plan item is required.',
        'Pending approval > Approve or Return to draft: the approver reviews scope, timing, resourcing and rationale. Use a return comment to make rework clear.',
        'Approved > Activate: an authorised planner starts the active plan. An authorised approver may reopen an approved plan to Draft where a change is needed.',
        'Active > Archive: preserve the completed planning cycle. Do not treat an archived plan as an editable working draft.',
      ] },
      { heading: 'Create an engagement from an item', paragraphs: [
        'Use the plan item\'s Create engagement action where available, or create an engagement from the Engagements register according to your planning process. Check for an existing engagement link first. After creation, confirm the engagement\'s entity, objectives, scope, dates, lead and budget; a plan title alone is not an audit scope.',
        'Removing an item from the plan does not remove an engagement already created from it. Check both records before making planning changes so reporting does not suggest that a cancelled plan item automatically cancelled the audit.',
      ] },
    ],
  },
  {
    title: 'Creating and managing an engagement',
    sections: [
      { heading: 'Create the engagement', steps: [
        'Open Engagements and search for an existing audit. Select New engagement when a new audit is required.',
        'In Profile, enter a clear Title, choose the audit Type and Risk rating, and select the Auditable entity. The audit number is generated automatically.',
        'Write Objectives describing what the audit intends to conclude. Write Scope describing the included processes, systems, locations and boundaries. Record exclusions in the appropriate profile field after creation where needed.',
        'Choose Lead, Manager and Partner in Team. The lead is required before risk assessment can begin; manager and partner responsibilities should follow the engagement governance.',
        'Set the audit Period start/end separately from Planned start/end. The period is what is being examined; the planned dates describe when the audit work will take place.',
        'Enter Budget hours, check that end dates do not precede start dates, then select Create engagement. Confirm the generated number and entity on the detail screen.',
      ], figure: 'engagement-profile' },
      { heading: 'Working in the engagement', paragraphs: [
        'The header displays the audit identity, rating and lifecycle. The detail tabs contain the profile and associated audit work, including the programme, workpapers, findings, requests, documents, report and collaboration or history views provided by the screen. Use these links to preserve the relationship between records.',
        'Edit profile fields with the pencil or field editor and save with the checkmark. Maintain milestones and team assignments as the audit changes. A stage indicates lifecycle progress; it should not be used as a substitute for updating dates, hours, narrative, workpapers or remediation records.',
      ] },
      { heading: 'Cancellation and avoiding duplicate audits', paragraphs: [
        'Cancellation is a separate workflow action available from Planning to an authorised closer. Record a reason. Do not cancel an audit merely because a later-stage guard needs additional work. If you accidentally create a duplicate, ask the engagement owner to determine which record to retain and how to document the cancellation.',
        'Before creating another engagement after a slow response, refresh the register and search for the submitted title. A delayed response does not necessarily mean the initial creation failed.',
      ] },
    ],
  },
  {
    title: 'Engagement stages and completion gates',
    sections: [
      { heading: 'Planning through fieldwork', bullets: [
        'Planning > Start risk assessment: objectives, scope and a lead must be recorded.',
        'Risk assessment > Build audit programme: review the linked risks, controls and intended testing before advancing.',
        'Programme > Start fieldwork: at least one programme must have reached an approved, in-progress or completed state accepted by the gate. Approve the actual programme before relying on that status.',
        'Fieldwork > Submit for review: at least one workpaper must exist and no workpapers may remain in Draft.',
      ] },
      { heading: 'Review through reporting', bullets: [
        'Review > Return to fieldwork: use when additional testing is required. Record the reason and coordinate the changes with the preparer.',
        'Review > Start reporting: every workpaper must be signed off and open review notes must be cleared. A prepared or reviewed workpaper is not a signed-off workpaper.',
        'Reporting > Issue report: findings must have progressed beyond Draft and Management review into an accepted downstream state, or have been risk-accepted. Check the actual guard results and report contents before issue.',
        'Issue report moves the engagement to Follow-up. Downloading a report file does not trigger this action. Standard Audit Partner, CAE or Global Administrator permissions are required to issue.',
      ] },
      { heading: 'Close an engagement without losing follow-up', paragraphs: [
        'In this implementation, Follow-up > Close engagement requires every non-deleted finding to have an action owner and to have been sent beyond Draft. An owner can be a linked platform user or recorded external name/email. Closure does not require every finding to be Closed or Risk accepted.',
        'This distinction matters: engagement closure records completion of the engagement, while open finding remediation continues in the Findings area. Do not report every action as implemented merely because its engagement is closed. The report-issue gate must still have been satisfied before reaching Follow-up.',
      ], steps: [
        'Review the report, workpaper sign-offs and follow-up handover against the organisation\'s close-out checklist.',
        'Review the findings for missing owners and any still in Draft. Assign the responsible party and submit drafts through the normal finding workflow.',
        'Ask an authorised closer to select Close engagement and address any listed blockers.',
        'Re-open the engagement and relevant finding register to confirm the stage and remaining remediation responsibilities. Closed engagement report attachments cannot be replaced.',
      ] },
    ],
  },
  {
    title: 'Audit programmes and workpapers',
    sections: [
      { heading: 'Build the programme', steps: [
        'Open the engagement\'s Programme tab and select New programme. Choose an approved library template or a blank programme and give it a title.',
        'Review each step for relevance to the engagement. Add or edit the reference, objective, procedure, expected evidence and assignments available in the step editor.',
        'Remove irrelevant template content only after considering whether it leaves a coverage gap. A copied programme is a starting point, not confirmation of a complete risk response.',
        'An authorised programme approver selects Approve programme after reviewing the steps. An empty programme cannot be approved from the screen.',
        'Use Create workpaper on a step to create the related audit work. Open an existing workpaper when the step already has one to avoid duplication.',
      ] },
      { heading: 'Prepare a defensible workpaper', steps: [
        'Confirm Identification: reference, title, objective and any linked risk, control or programme step.',
        'In Work performed, record the Procedure and what you actually tested in Test performed. Include the population, selection method, period and sample details needed to understand the work.',
        'Record Results, Exceptions and Conclusion. Separate factual exceptions from your evaluation of their impact. State the limitations of the work where relevant.',
        'Add supporting evidence and record its source. Open a downloaded attachment to verify it is the intended file and is readable.',
        'Wait for the narrative save when leaving a field, or use Ctrl+Enter. Recheck important fields, then select Mark as prepared. Procedure and conclusion are required by this gate.',
      ] },
      { heading: 'Version history and locked workpapers', paragraphs: [
        'Version history lets you view saved snapshots and compare a prior version with the current one. Use it to understand what changed; viewing a snapshot does not restore it. Keep the narrative and attachments consistent when responding to review.',
        'Signed-off workpapers are locked. Unlock is a controlled action reserved for authorised users such as the CAE, Partner or Administrator. Record why reopening is needed and arrange renewed review and sign-off after changes. Do not create a duplicate workpaper to avoid the lock.',
      ] },
    ],
  },
  {
    title: 'Review notes and independent sign-off',
    sections: [
      { heading: 'Workpaper review sequence', steps: [
        'An independent reviewer opens a Prepared workpaper and selects Start review. The reviewer must not be the preparer.',
        'Examine the objective, procedure, results, conclusion and supporting evidence. Raise a review note for a specific gap, with an appropriate priority and assignee.',
        'Use Raise review notes when the workflow requires a return for action. The workpaper moves to Review notes open.',
        'The preparer updates the work and responds to each note. Notes addressed returns the workpaper to Prepared when the required responses are recorded.',
        'The reviewer verifies the changes and clears notes when satisfied. A response is not the same thing as reviewer clearance. Re-enter review as required, then Approve review once there are no open notes.',
        'An authorised signer selects Sign off on the Reviewed workpaper. The signer must not be the preparer. Check the recorded preparer, reviewer and sign-off stamps.',
      ] },
      { heading: 'Good review-note practice', bullets: [
        'Identify the precise paragraph, test, result or attachment requiring attention.',
        'Explain the requested change and why it affects the audit conclusion. Avoid vague notes such as Fix this.',
        'Respond with what changed and where the evidence can be found. If you disagree, explain the basis and resolve it with the reviewer.',
        'Do not clear your own unresolved work simply to allow stage advancement. Confirm the engagement\'s review-note summary before starting reporting.',
      ] },
      { heading: 'Common blockers', paragraphs: [
        'If review or sign-off is blocked as self-review, switch responsibility to a genuinely independent authorised reviewer, not a shared account. If notes remain open, inspect both their responses and clearance status. If the next action is absent, check the current workpaper state and your role before escalating a technical issue.',
      ] },
    ],
  },
  {
    title: 'Documents, evidence and requests',
    sections: [
      { heading: 'Choose the correct upload location', bullets: [
        'Engagement > Documents: supporting audit material associated with that engagement.',
        'Workpaper evidence: evidence supporting a specific procedure or conclusion. Register the description and source, and attach or link the intended file.',
        'Finding > Evidence: documents supporting the issue or its remediation. Use the appropriate stage and describe how the file demonstrates implementation.',
        'Requests: material supplied in answer to a particular document request. Submitting the response is separate from uploading.',
        'Engagement > Report: the reviewed report attachment. This is distinct from general supporting documents and from an automatically generated draft report.',
        'AI Sphere context documents: private sources for an AI request. These do not automatically become engagement evidence or request attachments.',
      ] },
      { heading: 'Upload and verify a document', steps: [
        'Open the correct record and upload area. Confirm the record identity before choosing a file.',
        'Select the appropriate classification and file. General supporting documents are limited to 50 MB per file; AI context has a separate 10 MB limit. Empty files are rejected.',
        'Wait for upload completion and verify that the file appears in the document list. A local selection or progress indicator is not completion.',
        'Use the download action to check the original content when accuracy is important. Confirm the file name, version, period and readability.',
        'Record an evidence description or response note explaining relevance. Keep the original and your analysis distinguishable.',
      ], paragraphs: [
        'Restricted-classified documents require additional access. Deleting documents requires permission; records used as the current report attachment must be detached first. Deletion does not automatically erase historic references or AI interaction records. Use the organisation\'s retention and incident procedures.',
      ] },
      { heading: 'Raise, respond to and accept a request', steps: [
        'An auditor opens Requests, raises a request on the correct engagement, and records a clear title, requirements, assignee and due date. If using an external email, check it carefully.',
        'The assignee opens the request in the workspace or Client portal, uploads the required files and enters a Response note explaining what has been supplied or why an item is unavailable.',
        'Select Submit response. At least a response note or an uploaded attachment is required. The status changes from Open to Submitted.',
        'The auditor reviews the submission and selects Accept when it meets the request, or Return with a clear reason when further work is required.',
        'For a Returned request, the assignee addresses the reason and selects Resubmit. A manager may cancel an Open or Returned request when it is no longer needed, recording the reason.',
      ] },
    ],
  },
  {
    title: 'Drafting and submitting findings',
    sections: [
      { heading: 'Create the finding in context', steps: [
        'Open the engagement\'s Findings area or choose New finding from the Findings register. Confirm the engagement selection.',
        'Enter a concise, factual title and severity. Link the relevant entity, process, risk, control and workpaper where the form provides these fields.',
        'Complete the five Cs: Condition, Criteria, Cause, Impact and Recommendation. The interface uses Impact for the consequence component.',
        'Add supporting evidence, classification or root-cause information and a prior finding reference if it is genuinely a repeat.',
        'Save the draft and review it against the workpaper. An authorised submitter selects Submit to management after completing condition, criteria and recommendation.',
      ] },
      { heading: 'What each narrative should contain', bullets: [
        'Condition: the observed fact, population or sample affected, period and evidence. Distinguish what was tested from an assumption about the whole population.',
        'Criteria: the policy, control requirement or approved expectation used for comparison. Identify the applicable version or period where it matters.',
        'Cause: why the gap occurred, supported by analysis and management discussion rather than speculation.',
        'Impact: actual and potential consequences, with the basis for any quantified amount or risk assessment.',
        'Recommendation: a practical corrective action addressing the cause, with a result that can be evaluated during follow-up.',
      ] },
      { heading: 'Recommendations, evidence and history', paragraphs: [
        'Use Recommendations to break the headline recommendation into trackable actions. Record the responsible owner, target date, priority, action plan and progress information supported by the form. Keep individual actions consistent with the headline finding and the management response.',
        'Use Evidence, History and Comments to review supporting documents, lifecycle events and discussions. Audit trail is visible only where authorised. A comment does not replace the management response field, and a progress note does not close the finding.',
        'If a submitted finding requires substantive correction, an authorised manager can Return to draft from Management review. Document why and repeat the normal submission and agreement process. Do not silently change the basis of an agreed response.',
      ] },
    ],
  },
  {
    title: 'Finding agreement and action owners',
    sections: [
      { heading: 'The three agreement requirements', paragraphs: [
        'Agree finding is available in Management review to an account with finding:respond. The API requires a management response, an action owner and a due date. A statement such as Management agrees by itself is not enough.',
        'An owner can be a linked active platform account, a recorded external owner name, or an external owner email. The current gate accepts any of these ownership forms. For operational accountability, record both name and contact details when the owner is external. A platform account is preferable when that person must receive assignments and act in the application.',
      ] },
      { heading: 'Agree a finding in the workspace', steps: [
        'Open the finding and confirm that its status is Management review. Read the five Cs, recommendations and evidence before responding.',
        'In Management response, click Response, record management\'s position and corrective action, and save it.',
        'Open Action owner. Search by name or email and select the intended active user. Selection saves the user link and contact details. Alternatively, retain or enter the external owner name and email using their field editors.',
        'Click Set due date when no date is recorded. Choose the deadline agreed with the responsible owner, then click the Save checkmark. Do not rely on an unsaved calendar value.',
        'Verify that the response, owner and saved date are visible. Select Agree finding and confirm the status changes to Agreed.',
      ], figure: 'finding-response' },
      { heading: 'Resolving the common agreement error', paragraphs: [
        'If an external name and email are already visible but Due date is blank, the missing date is the blocker. It is not necessary to invent another user account merely to pass the owner check. Set and save the real agreed deadline, then retry.',
        'The message A due date is required. The recorded action owner is already sufficient identifies this situation. A separate missing-owner message means you must select a user or record an external owner. If the person list fails to load, use its Retry control; if a search is empty, clear or shorten the search and ask an administrator to confirm the account is active.',
        'Do not choose an arbitrary date solely to advance the workflow. If management disagrees or will accept the risk, record its actual position and follow the escalation and risk-acceptance process. Accept risk is a different privileged action, not another way to record ordinary agreement.',
      ] },
    ],
  },
  {
    title: 'Implementation, validation and follow-up',
    sections: [
      { heading: 'Manage implementation', steps: [
        'On an Agreed finding, the responsible management user selects Start implementation.',
        'Maintain the recommendation action plans, dates, progress percentages and progress notes available to your role. Explain delays and dependencies; a percentage alone does not demonstrate effectiveness.',
        'Attach implementation evidence on the finding. Explain what changed, when it was put into operation and how the attached material supports completion.',
        'Select Request validation when implementation is ready for independent review. The application checks for implementation support; the audit team must still judge its sufficiency and relevance.',
      ] },
      { heading: 'Validate and close, or return for further work', steps: [
        'An authorised validator opens a finding in Validation and reviews the management claim, implementation evidence and recommendations.',
        'Perform the follow-up procedures required by the audit methodology. Confirm that the corrective action addresses the original issue and, where necessary, has operated for a sufficient period.',
        'If support is insufficient, select Return to implementation and record the reason and what is still required.',
        'If the action is satisfactory, select Validate and close. Confirm the Closed status and recorded validation information. A linked platform action owner cannot validate their own finding.',
      ] },
      { heading: 'Extensions, ageing and risk acceptance', paragraphs: [
        'Use Extend due date when a recorded deadline must be extended. Enter the new date and a meaningful reason. The original due date and extension count are retained for transparency. An extension is not proof that remediation has progressed.',
        'Ageing highlights overdue actions for follow-up. Review the actual owner and dates before escalation. Reminders and escalation jobs depend on deployment configuration and a running worker; do not rely on an email arriving as your only deadline control.',
        'Accept risk is available to authorised leadership from Management review. Record the rationale and follow the organisation\'s approval process. Risk accepted is a terminal finding status, distinct from independently validated remediation. Engagement closure does not automatically close findings that remain in implementation.',
      ] },
    ],
  },
  {
    title: 'Reports and downloads',
    sections: [
      { heading: 'Select the right export', bullets: [
        'Reports > Executive: PDF, Word (.docx) or Markdown (.md) for executive reporting.',
        'Reports > Findings: PDF, Excel (.xlsx) or CSV for the findings register.',
        'Reports > Engagements: PDF, Excel (.xlsx) or CSV for the engagement register.',
        'An engagement\'s Download report menu: PDF, Word or Markdown for its current audit report draft.',
        'Download original on a report attachment or document: retrieves the uploaded file without converting its format.',
      ] },
      { heading: 'Download an accurate snapshot', steps: [
        'Open the appropriate report tab and apply the available search and filters. Check that the displayed selection represents the intended period and population.',
        'Open the download menu and choose a format. PDF is suitable for a fixed-layout reading copy; Word for controlled narrative editing; Excel or CSV for register analysis.',
        'Wait for the browser download to finish, then open the file. Check the title, generated date, filters, record count and first and last pages or rows.',
        'For register exports, remember that the download includes all matching records, not only the visible page. Selections over 10,000 matches must be narrowed.',
        'Review and distribute the file only through approved channels. Exported copies no longer benefit from the application\'s record-access controls.',
      ] },
      { heading: 'Draft, reviewed attachment and issued report', paragraphs: [
        'The generated engagement report assembles the current profile, objectives, scope, opinion, findings, management responses, owners and due dates. It remains a current draft even if downloaded as a PDF. Downloading does not approve or issue the report.',
        'Use the engagement Report tab to preview information and upload the reviewed report file. Select Download original to retrieve that attachment. An authorised manager may replace or detach it while the engagement is open. A current report attachment must be detached before deletion.',
        'Issue report is a separate privileged workflow action with finding-agreement gates. Confirm that the reviewed file and system records agree before issue. Closing the engagement prevents changing its report attachment, but outstanding finding follow-up remains a separate responsibility.',
      ] },
      { heading: 'If a PDF will not open', paragraphs: [
        'Download a fresh copy using the application control. Do not rename an HTML error response or an empty file to .pdf. Check the downloaded file size and whether the browser actually completed the transfer. A previous broken copy will not repair itself after the service is fixed.',
        'The application validates PDF downloads and retries an incomplete transfer once. If failure persists, sign in again, check the service connection and report the exact message and time. A download-manager integration may intercept a transfer; use your IT-approved browser troubleshooting process rather than disabling security controls.',
      ] },
    ],
  },
  {
    title: 'AI Sphere and document context',
    sections: [
      { heading: 'Choose a capability and provide context', steps: [
        'Open AI Sphere under Knowledge. Select Planning scope, Audit procedures, Evidence Review & Exception Analysis, Finding draft, Report summary, Quality check, Risk radar or Audit Intelligence Search.',
        'Write a precise Instruction: the task, audit area, period, intended output and constraints. For example: Draft procurement test procedures from the selected policy; identify evidence needed and state any assumptions.',
        'Select Audit context type, then use the searchable Audit record picker. Available types include entity, process, risk, control, audit procedure, engagement, workpaper, evidence and finding. AI Sphere follows available links through the audit hierarchy, within your permissions. Leave No target to work only from supplied context, or to run tenant-wide risk radar or search.',
        'Enter Additional context and select approved source documents. For Finding draft, optionally provide impact and likelihood together on a 1-5 scale plus a rationale. For Audit procedures, optionally provide the population size. These inputs remain unverified proposals.',
        'Select Generate review or Search audit records. Review source-reported facts, assumptions, missing information, exceptions and reviewer notes. Click a source reference such as S1 to inspect its register entry, open the underlying record or download the original. The Context links tab shows the retrieved relationships.',
        'Use Copy audit review or Download audit review to obtain the draft in Markdown. The human-review notice and source register remain in the export. Open a row or eye icon in Interaction history to retrieve an earlier review; the server rechecks your current access to its sources. Mark useful records feedback, not audit approval.',
      ] },
      { heading: 'Outputs across the audit lifecycle', bullets: [
        'Planning scope includes a proposed objective, scope boundaries, period and locations, process-linked risks, audit approach and information requests. Missing scope details are identified, not invented.',
        'Audit procedures link risks, controls and test objectives, then set out steps, expected evidence and sampling considerations. Population size alone does not justify a statistical sample count; confirm the method under the approved methodology.',
        'Evidence Review & Exception Analysis checks completeness and reports potential versus recorded exceptions. The local engine detects missing transaction references, approvers, approval dates and commitment dates, and approvals recorded after commitment in supported CSV/spreadsheet columns. Use ISO dates such as 2026-08-10. A missing approval record is not proof that approval never occurred.',
        'Evidence sufficiency is insufficient, partially sufficient or sufficient for a documented scope. A sufficient local assessment requires recorded independent human review and linked evidence support; it is not a new AI assurance opinion. Names in a spreadsheet do not establish approval authority or authentic signatures.',
        'Finding draft produces a Five Cs draft with cited criteria, potential causes unless corroborated, consequence/impact and an owner/timeframe recommendation. Impact multiplied by likelihood produces a proposed rating with a rationale; the stored finding and risk ratings are not changed.',
        'Report summary includes an executive summary, complete finding counts for the selected engagement and management themes from the retrieved detail. It reports an existing opinion as recorded or leaves the opinion unassigned. Detail limits may mean theme counts differ from the full dashboard.',
        'Quality check prioritises unsupported conclusions, inadequate procedures, missing evidence, inconsistent no-exception statements, findings with weak support and self-review. Reviewer notes remain suggestions until an authorised auditor records and resolves them through the normal review workflow.',
        'Risk radar considers available risks, controls, repeated findings, prior audits and recorded signals. Missing links and emerging-risk hypotheses require validation. It does not research external events or revise the risk register automatically.',
        'Audit Intelligence Search retrieves audit records using audit terminology and recorded relationships. For example, Show me all procurement controls tested in the last year with exceptions applies a rolling 12-month test-date range to the same test showing the exceptions. It does not change records or use a model to invent missing search results.',
      ] },
      { heading: 'Transaction exception register', bullets: [
        'Evidence Review creates an Exception Register for supported transactional tables. The ten columns are Exception ID, Transaction Reference, Supplier/Vendor, Amount, Control Requirement, Evidence Observed, Exception Identified, Risk Impact, Severity and Auditor Follow-up.',
        'Each row cites the source and identifies the specific supplier, transaction and recorded amount. Missing approver identity becomes a transaction-specific exception, not merely a generic approval checklist. Missing references, currency, amounts or criteria remain explicitly unknown.',
        'Inspect the source links beside each exception ID. Scroll horizontally to read the follow-up column. The Markdown download and saved interaction retain the full register. Multiple exceptions may refer to one transaction: do not add their amounts together as a loss or total exposure.',
        'The local register supports delimited spreadsheet/CSV and Markdown tables with recognisable headers and retained worksheet/page markers. Unstructured narrative requires further auditor analysis or a configured approved model. Severity is source-reported or unrated, not an automatic finding rating.',
      ] },
      { heading: 'Audit Intelligence Search workflow', steps: [
        'Select Audit Intelligence Search. Keep All audit universe for cross-engagement questions, or choose Current engagement and select the engagement. Select the record types to include. The question determines the answer type within those filters.',
        'Ask a precise question, such as: Show me all procurement-related findings identified across completed audits; Which risks have linked findings; Show me all open audit actions with owners and due dates; or Which controls have recurring weaknesses.',
        'Select Search audit records. Review the search summary, match count, engagement count, owner, status, severity or rating and due date. Expand Linked source records to follow workpapers, evidence, risks, controls and actions. Select a source reference to inspect its saved excerpt or original document.',
        'Check Search coverage and Coverage details. A 100% figure refers only to accessible record metadata scanned, not hidden records or full document text. Missing text, permission exclusions and indexing limits are reported separately. Incomplete scans show an unknown percentage. Confidence concerns retrieval, not the quality of audit evidence.',
        'Use Previous results and Next results for additional pages. Each page performs a fresh audited search. Copy or download the displayed result page in Markdown, or reopen it in Interaction history. Current permissions and source availability are checked again.',
        'For no matching records, inspect the stated reason: no indexed data for the requested types, no filter matches, permission restrictions or incomplete indexing. A search service error is not an absence of records. Refine the terms or scope, and ask an administrator to investigate missing permissions or indexing failures.',
        'Open actions include implemented recommendations awaiting validation. Finding-level management actions are labelled when no separate action plan exists. Repeated findings identify candidates for reviewer analysis, not a confirmed common cause. Validate every conclusion before using it in audit documentation.',
      ] },
      { heading: 'Context upload limits and behaviour', bullets: [
        'Supported context formats: PDF, DOCX, XLSX, TXT, CSV and Markdown. Files must be nonempty and no larger than 10 MB each.',
        'Select up to five documents per generation. The list shows up to 50 recent readable uploads belonging to you. Selections are not restored when the page reloads.',
        'Extraction reads up to 50 PDF pages and uses at most 12,000 characters from each document. An excerpt or truncation marker means the full source was not used.',
        'Image-only scans require OCR outside the application. Unlock a password-protected PDF through an approved process before upload. Spreadsheet formulas are not executed.',
        'A context upload requires AI use, document upload and document read permissions. Restricted context also needs restricted-document access. The originals are private to the uploader within the organisation.',
        'Download retrieves the original. Delete is permission-controlled. Removing an upload does not erase previous AI interactions, extracted context already recorded there, or the audit history.',
      ] },
      { heading: 'Provider limits and professional review', paragraphs: [
        'Check Provider on the page and on each result. Local rule-based review applies deterministic documentation and transaction checks; it is not model-based understanding of arbitrary documents. A configured remote provider receives the permitted retrieved audit context and selected extracted text. Use only an organisation-approved endpoint for confidential audit information. Provider failures or invalid output fall back to a clearly labelled local review.',
        'Uploaded documents are source material, not instructions to override your task. Treat generated text as an unapproved draft. AI Sphere does not independently approve programmes, sign workpapers, agree findings, issue reports or validate remediation. Quality-check output is not certification of compliance with BDO or professional standards.',
        'Every output displays: AI-generated output. Auditor review required before inclusion in audit documentation. Citations identify supplied source records, not independent verification. The assistant cannot approve workpapers, close findings, issue audit reports or automatically change risk ratings.',
        'Non-search review context is limited to 80 sources and 140,000 characters. Audit Intelligence Search uses a separate paged index with disclosed coverage limits. Ordinary documents without extracted text contribute metadata only. No OCR is performed. Audit terminology expansion is not unrestricted semantic understanding; refine unfamiliar terms when necessary.',
        'Prompts, user, date, source snapshots and output are stored in the audited interaction. History is requester-only and source access is checked again when opened. Deleting or restricting a source can prevent reopening a previous interaction; deletion does not erase retained audit snapshots. Apply the organisation\'s retention policy.',
      ] },
    ],
  },
  {
    title: 'Monitoring alerts and risk radar',
    sections: [
      { heading: 'Open and investigate an alert', steps: [
        'Open Monitoring and select Alerts. Review title, rule, severity, status, amount, assignee and detected date. Distinguish the assigned-to-me summary from the overall open-alert count.',
        'Click the alert title or row to open the alert detail panel. Keyboard users can focus a row and press Enter.',
        'Read the description, rule and available connector information, then inspect Transaction details. Nested records, invoice references and other source fields provide the basis for investigation.',
        'With monitoring-management permission, change status or assignee using the controls in the panel or list. A read-only user can inspect the alert but cannot change these values.',
        'Use Copy alert link to share a deep link with an authorised colleague. Close the panel to return to the list; existing list pagination is preserved.',
      ] },
      { heading: 'Record the outcome responsibly', paragraphs: [
        'Investigate an alert before concluding that it represents an audit finding. Check the underlying transaction, legitimate exceptions, amount, currency and source completeness. Select the appropriate available status when the investigation progresses or finishes. Do not equate high severity with a confirmed loss.',
        'Where an issue warrants a formal finding, raise it through the normal finding workflow and document the alert reference in the supporting narrative or evidence. Do not assume an alert automatically creates a finding or constitutes adequate evidence on its own.',
      ] },
      { heading: 'Risk radar, rules and connectors', paragraphs: [
        'Risk radar lists recorded signals; Rules and Connectors show the configuration and status exposed by the current interface. Authorised users can maintain the available settings. Review the rule definition and data source before interpreting an alert.',
        'Important current limitation: the application has alert and configuration screens, but no implemented scheduled connector/rule execution engine. An enabled rule or connector entry is not proof that a source system is connected or that transactions are being monitored continuously. Confirm the provenance and freshness of loaded alerts with the administrator.',
        'If a detail panel cannot load, use Retry. A missing record may have been removed or be inaccessible in your organisation. Copying a link does not grant access to another user.',
      ] },
    ],
  },
  {
    title: 'Client portal for management',
    sections: [
      { heading: 'Access and your work lists', paragraphs: [
        'The Client portal uses the same sign-in as the workspace. A business-owner-only account normally lands there automatically. A management reviewer with workspace access can select Client portal and use Workspace to return where that control is available.',
        'The overview shows requests needing action, findings awaiting response, actions in progress and completed work. My requests and My actions match your user ID or the recorded owner/assignee email. An external email must match your provisioned sign-in identity for the item to appear in your list.',
      ] },
      { heading: 'Respond to a request', steps: [
        'Open My requests and use Needs action, Submitted, Completed or All to locate the request.',
        'Read the requested information, due date and any return reason. Upload the files and enter a Response note.',
        'Select Submit response or Resubmit after the files have finished uploading. Check the new status rather than assuming that the upload itself submitted the request.',
        'Use the discussion thread for clarification. If the auditor returns the response, address the specified gaps and resubmit.',
      ] },
      { heading: 'Respond to and implement an action', steps: [
        'Open My actions and use Awaiting response, In progress, Under validation, Closed or All.',
        'Read the full finding and recommendations. Complete the management response, owner details and target date in the portal\'s editors.',
        'Save the entries, then select Agree finding. If blocked, resolve the listed response, owner or date requirement.',
        'Select Start implementation when appropriate. Upload implementation evidence, then Request validation when ready for audit review.',
        'Follow the auditor\'s response. Returned actions require more work; only an authorised independent validator completes audit closure.',
      ] },
      { heading: 'Confidentiality and current access boundary', paragraphs: [
        'Portal lists focus on your items, but they are not a client-by-client security boundary. Current request and finding read permissions are organisation-wide, and an account may read other records through a direct workspace URL. Do not place unrelated clients in one organisation on the assumption that portal filtering isolates them. Administrators must assess deployment access and segregation before external rollout.',
        'You need an authorised account to follow a shared link. An email address entered on a finding does not automatically send an invitation or create an account. Ask the audit team to verify assignment and provisioning if expected work is missing.',
      ] },
    ],
  },
  {
    title: 'Resources, library and collaboration',
    sections: [
      { heading: 'Time recording and resources', steps: [
        'Open Resources and review Current week. Select Record time for your own work.',
        'Choose the work date, charge code and engagement where relevant. Enter hours and a description that explains the activity.',
        'Save and check the week\'s entries and total. Correct errors before submitting the timesheet using the available workflow control.',
        'An authorised approver reviews submitted timesheets and approves or returns them as appropriate. Resolve returned entries rather than creating a duplicate week.',
        'Use utilisation and upcoming availability for planning where your role permits. These depend on recorded time and availability data and do not themselves change staffing assignments.',
      ] },
      { heading: 'Use and contribute library content', paragraphs: [
        'Library contains reusable audit content and framework references. Search and filter by type, status, industry or tags as provided. Inspect the content and approval state before using it in an engagement. Prefer an approved template, then adapt its steps to the audit scope.',
        'Contributors may create a library draft with code, title, summary and applicable metadata. The advanced Content field expects valid JSON, not an uploaded Word document. Follow the established content structure for that library type or ask the methodology administrator for a template.',
        'Approval and publication remain privileged methodology activities. A copied library item does not automatically update existing programmes when the library source changes. Review engagement-specific content deliberately.',
      ] },
      { heading: 'Tasks, comments and notifications', bullets: [
        'Use tasks for assigned work and deadlines where the task view is available. Completing a task does not change a workpaper, finding or engagement workflow automatically.',
        'Use Comments on the correct record for discussion. Check whether a comment is internal before posting confidential audit-team deliberations; portal discussions do not offer the internal-only toggle.',
        'Open the bell to review notifications and follow a record link. Marking a notification read only clears attention; it does not accept a request or complete an action.',
        'Use approved secure channels for material that should not be stored in comments, and avoid posting passwords, access tokens or MFA recovery codes.',
      ] },
    ],
  },
  {
    title: 'Users, roles and the audit trail',
    sections: [
      { heading: 'Invite or activate an account', steps: [
        'With user-management permission, open Admin > Users. Search for the email before inviting another account.',
        'Select Invite user. Enter Email and Display name, optional name/job-title fields, and at least one appropriate role.',
        'Supply a password meeting the form\'s requirements or leave it blank for a generated temporary password. The generated password is shown once; share it through an approved secure channel.',
        'Review the created account status. A generated-password invitation starts as Invited; an explicit-password account is created active. Confirm the onboarding and activation process before expecting the person in active-user pickers.',
        'Have the user sign in, replace the temporary password and enrol MFA as required by organisational policy. Do not rely on an assumed enforcement prompt: confirm completion.',
      ] },
      { heading: 'Change access and offboard safely', paragraphs: [
        'Use Edit roles to choose the minimum required roles and save. Permissions are combined, so adding a second role can grant more than the single task you had in mind. Review the actual capabilities and test with the intended role. The API applies current permissions; refresh or sign in again if navigation still shows an older view.',
        'Suspend temporarily or deactivate when access should stop. History, sign-offs and assignments are retained. Reassign outstanding action ownership, requests and audit work deliberately; deactivation does not complete those responsibilities. Keep at least one authorised administrator available and follow the application\'s safeguards for protected account changes.',
        'Microsoft sign-in and email delivery require deployment configuration. An Invite action or a recorded external owner email should not be treated as proof that an email was delivered or that SSO is enabled.',
      ] },
      { heading: 'Investigate changes using Audit trail', steps: [
        'Open Admin > Audit trail with audit_trail:read permission.',
        'Filter by action/search, target type, target UUID, actor and From/To dates as needed. Use the actual record UUID from its URL rather than a display reference in Target id.',
        'Expand the relevant event to inspect the recorded before/after values and metadata. Compare actor, timestamp and request ID to the reported issue.',
        'Clear filters when an expected event is missing and check the time window and record identity. Preserve relevant details through approved incident or review procedures.',
      ], paragraphs: [
        'The audit trail is a read-only review surface, not a way to undo changes. The application records many business mutations and exports, but not every read or notification action creates an event. Absence of an event is not by itself proof that no access occurred. Ask an administrator to inspect service logs when appropriate.',
      ] },
    ],
  },
  {
    title: 'Troubleshooting and support',
    sections: [
      { heading: 'Missing or unavailable information', bullets: [
        'Could not load data / Internal Server Error: check whether other screens work, retry once, and report the page, time and request ID. Do not interpret the error as an empty register.',
        'An expected record is absent: clear search, Mine and status filters, check pagination and organisation, then check whether the record was archived or is assigned to another email.',
        'Action owner is empty: clear the picker search, use Retry if a load error appears, and confirm the account is Active. An external owner may be recorded without a platform account.',
        'A menu or button is missing: confirm permission and record state. For example, the standard Audit Manager cannot issue a report or close an engagement without a role granting those capabilities.',
        'A shared link opens Not found or Forbidden: confirm the organisation, record UUID and access. Sharing a link does not grant permission.',
      ] },
      { heading: 'Workflow blockers', bullets: [
        'Cannot agree finding: save a management response, record an owner and save a due date. If an external owner is already present, only the missing date may need attention.',
        'Cannot start risk assessment: complete and save objectives, scope and lead on the engagement.',
        'Cannot start fieldwork: create and approve an audit programme containing relevant steps.',
        'Cannot submit for review: create workpapers and ensure none remain Draft.',
        'Cannot start reporting: complete every workpaper sign-off and clear open review notes.',
        'Cannot issue report: move findings out of Draft and Management review through the proper agreement or risk-acceptance process.',
        'Cannot close engagement: ensure every finding has an owner and has been submitted beyond Draft. Closing an engagement is separate from closing all findings.',
        'Cannot request validation: provide implementation support on the finding and reconcile recommendation completion. Upload completion alone is not an audit conclusion.',
        'Self-review or self-validation blocked: use a genuinely independent authorised person. Do not change attribution or share an account to bypass the rule.',
      ] },
      { heading: 'Files and AI context', bullets: [
        'Upload too large: general files are limited to 50 MB and AI context to 10 MB. Split or reduce the document through an approved process while preserving meaning and provenance.',
        'AI context has no extractable text: use a text-readable PDF or supported document; perform approved OCR for a scan. Check for password protection.',
        'AI output ignores part of a source: check document selection, excerpt flags and the 12,000-character/50-PDF-page limits. Supply the relevant excerpt explicitly and verify the result.',
        'Provider says Local: built-in guidance is expected. Remote model analysis requires an approved, configured provider, not another upload.',
        'Cannot delete a report file: detach the current report attachment first while the engagement is open. Closed engagement attachments are protected.',
        'PDF is empty or cannot open: retry the application download and inspect the fresh file. Keep the exact error for support; do not distribute a partial file.',
      ] },
      { heading: 'What to send to support', paragraphs: [
        'Provide the screen URL, record reference and UUID, approximate time with time zone, your role, the action attempted, expected result, exact error and request ID if displayed. Include a redacted screenshot when useful. For a download problem include format and file size; for an upload include format and size, not the confidential source itself unless approved.',
        'Never send your password, authentication cookies, access tokens, MFA secret or recovery codes. Do not resend live business actions repeatedly to collect errors. If you suspect an unauthorised disclosure, follow the organisation\'s incident procedure immediately.',
      ] },
    ],
  },
  {
    title: 'Quick checklists and glossary',
    sections: [
      { heading: 'Before fieldwork', bullets: [
        'Correct entity and engagement; no duplicate audit.',
        'Objectives, scope, period, lead, dates and budget recorded.',
        'Relevant risks and controls reviewed; programme adapted and approved.',
        'Steps assigned; document requests sent to the correct contacts.',
        'Evidence handling, access and independent review responsibilities agreed.',
      ] },
      { heading: 'Before reporting and close-out', bullets: [
        'Workpapers complete, independently reviewed and signed off; review notes cleared.',
        'Findings supported by evidence and consistent with the report; management responses, owners and dates verified.',
        'Reviewed report file and generated draft reconciled; issue performed only by an authorised person.',
        'Follow-up owners and outstanding actions handed over; engagement closure not confused with remediation completion.',
        'Downloaded reports checked for completeness, labelled appropriately and shared through approved channels.',
      ] },
      { heading: 'Key terms', bullets: [
        'Action owner: person responsible for remediation; not necessarily the auditor who raised the finding.',
        'Auditable entity: organisation, business unit or other audit object in the universe.',
        'Audit programme: engagement-specific testing steps and objectives, which may be created from a library template.',
        'Criteria: the expectation or requirement against which the observed condition is evaluated.',
        'Engagement: an individual audit with its own number, team, scope and lifecycle.',
        'Evidence: material supporting audit work or remediation; uploading a file does not establish sufficiency.',
        'Finding: a documented issue moving through management review, agreement, implementation and independent validation, or authorised risk acceptance.',
        'Guard: a required condition checked before a workflow action may proceed.',
        'Management response: management\'s recorded position and intended corrective action.',
        'Original due date: the retained deadline used to understand extensions and follow-up history.',
        'Prepared / Reviewed / Signed off: separate workpaper states; none should be used interchangeably.',
        'Risk accepted: a privileged decision to accept the risk, distinct from validated correction.',
        'Tenant / Organisation: the application\'s organisational data boundary. A portal filter is not an additional tenant boundary.',
        'UUID: the long internal record identifier in a detail-page URL; different from display references such as IA-2026-001 or F-03.',
      ] },
      { heading: 'Current implementation boundaries', paragraphs: [
        'This edition does not promise offline working, automatic connector execution, autonomous AI audit conclusions, automatic management approval or complete client-level isolation inside a shared organisation. SSO, email, storage scanning and scheduled reminders depend on deployment configuration. Use the implemented controls and verify operational readiness with your administrator.',
        'End of manual. Return to Admin > User manual for the current downloadable edition.',
      ] },
    ],
  },
];
