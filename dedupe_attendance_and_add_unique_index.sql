WITH ranked_attendance AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY member_id, meeting_id
            ORDER BY created_at DESC, id DESC
        ) AS duplicate_rank
    FROM attendance
)
DELETE FROM attendance
WHERE id IN (
    SELECT id
    FROM ranked_attendance
    WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_member_meeting
ON attendance(member_id, meeting_id);
