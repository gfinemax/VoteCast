---
description: Finalize a feature by updating PRD, User Manual, and creating a git commit
---
# Feature Wrap-up Workflow

This workflow helps you wrap up a development task by ensuring all documentation is synced and changes are committed.

## Step 1: Review Changes
1.  Analyze the code changes made in the recent task.
2.  Summarize "What was built/modified" (Technical) and "How it affects the user" (User-facing).

## Step 2: Update PRD
1.  Open `PRD.md`.
2.  Check if the new feature or change is reflected in the requirements.
3.  If not, append or update the relevant section with technical details.
   - *Example: "Added `contact_status` column to `parcel_owners` table."*

## Step 3: Update User Manual
1.  Open `User_Manual.md`.
2.  Check if the change affects what the user sees or does.
3.  If yes, update the instructions in friendly language.
   - *Example: "You can now see a 'Secured' badge next to the owner's name."*

## Step 4: Commit Changes
// turbo
1.  Run the following commands to stage and commit:
```powershell
git add .
git commit -m "feat: [Feature Name] - Finalize implementation and update docs"
```
*(Replace [Feature Name] with the actual feature name).*

## Step 5: Notify User
1.  Inform the user that the feature is wrapped up and docs are synced.
