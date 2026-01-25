---
description: Prepare for deployment by running checks and tests
---
# Deployment Preparation

Run this workflow before deploying to production to ensure code quality and stability.

## Step 1: Type Checking
// turbo
1. Run TypeScript compiler check:
```powershell
npx tsc --noEmit
```
2. If errors exist, fix them before proceeding.

## Step 2: Linting
// turbo
1. Run ESLint:
```powershell
pnpm lint
```
2. Fix any warnings or errors.

## Step 3: Clean up Logs
1. Search for `console.log` in the codebase.
2. Remove any debug logs that shouldn't be in production.

## Step 4: Production Build
// turbo
1. Run the build command:
```powershell
pnpm build
```
2. Ensure the build completes without errors.

## Step 5: Final Confirmation
1. Notify the user: "All checks passed. Ready for deployment."
