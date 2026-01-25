---
description: Checklist for code refactoring and cleanup
---
# Refactoring Checklist

Use this workflow to clean up and improve code quality.

## Step 1: Clean Up Imports
1. Check for unused imports in modified files.
2. Ensure imports are ordered logically (External -> Internal).

## Step 2: Code Structure
1. Check for long functions that can be broken down.
2. Extract repeated logic into helper functions or hooks.
3. Verify variable and function names are descriptive and consistent.

## Step 3: Comments & Documentation
1. Add JSDoc comments to complex functions.
2. Remove commented-out code (dead code).

## Step 4: Verification
// turbo
1. Run the build to ensure refactoring didn't break anything:
```powershell
pnpm build
```
