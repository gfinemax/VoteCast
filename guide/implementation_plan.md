# Implementation Plan - Real-time Check-in System

The goal is to expand the VoteCast app into a multi-role system (Entrance Check-in, Admin Control, Projector View) that simulates real-time data synchronization.

## User Review Required
**Simulation Note**: To allow immediate testing without setting up an actual database (Supabase), I will use **LocalStorage events** to simulate real-time synchronization between tabs. Accessing the app from different tabs/windows in the same browser will demonstrate the "Real-time" effect.

## Proposed Changes

### Data Layer
#### [NEW] src/lib/store.js
- Implement a simple state manager that syncs to `localStorage`.
- Data schema:
    - `members`: List of members { id, name, unit, isCheckedIn }
    - `agendas`: List of agendas { id, title, votes... }
    - `viewState`: Current display mode (PPT/Result)
- Functions: `checkInMember(id)`, `updateVote(id, data)`, `setProjectorMode(mode)`.

### Components
#### [NEW] src/components/*
- Extract reusable UI components (`Card`, `Button`) from `page.js`.

### Pages
#### [MODIFY] src/app/page.js
- Convert to a "Role Selection" landing page.
- Links to `/admin`, `/checkin`, `/projector`.

#### [NEW] src/app/checkin/page.js
- **UI**: Search bar (Unit/Name), Member List, Quick "Check-in" button.
- **Logic**: Updates `members` list in store.

#### [NEW] src/app/admin/page.js
- **UI**: Existing Admin Dashboard.
- **Logic**:
    - "Direct Attendance" input -> Read-only display derived from Check-in data.
    - Control Projector mode (PPT vs Result).

#### [NEW] src/app/projector/page.js
- **UI**: Full-screen display.
- **Logic**: Reactively shows content based on `viewState` (Intro, PPT Placeholder, Vote Result).

## Verification Plan
### Manual Verification
1.  Open 3 tabs: Admin, Check-in, Projector.
2.  **Check-in Tab**: Search for a member and click "Check In".
3.  **Admin Tab**: Verify "Direct Attendance" count increases effectively instantly.
4.  **Admin Tab**: Click "Publish Result".
5.  **Projector Tab**: Verify screen changes to Result view.
