-- agendas 테이블에 총회 개최일 컬럼 추가
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS meeting_date DATE;
