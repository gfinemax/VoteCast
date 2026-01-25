---
description: Fix a bug, verify with build, and commit changes
---
# Bug Fix Wizard

This workflow guides you through the process of fixing a bug, ensuring stability, and documenting the fix.

## Step 1: Diagnosis & Fix
1.  Identify the root cause of the bug.
2.  Implement the fix in the codebase.
3.  Add comments explaining *why* this fix works if it's not obvious.

## Step 2: Verification
// turbo
1.  Run the build command to ensure no regressions:
```powershell
pnpm build
```
2.  If the build fails, STOP and fix the errors.
3.  If the build passes, proceed to the next step.

## Step 3: Architecture Check
1.  Does this fix require a change in `PRD.md` (e.g., changing a requirement)?
2.  Does this fix need a mention in `User_Manual.md` (e.g., a behavior change)?
3.  If yes to either, update the documents now.

## Step 4: Commit
// turbo
1.  Stage and commit the changes:
```powershell
git add .
git commit -m "fix: [Bug Description] - Resolved issue and verified build"
```
*(Replace [Bug Description] with a short summary).*

## Step 5: Report
1.  Report back to the user: "Bug fixed, build verified, and changes committed."
