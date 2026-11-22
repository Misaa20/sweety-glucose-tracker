ALTER TABLE users ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'patient'
  CHECK (role IN ('patient', 'doctor'));
ALTER TABLE users ADD COLUMN report_version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE doctor_patients (
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (doctor_id, patient_id),
  CHECK (doctor_id <> patient_id)
);
CREATE FUNCTION check_assignment_roles() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.doctor_id AND role='doctor')
     OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.patient_id AND role='patient') THEN
    RAISE EXCEPTION 'Assignments require a doctor and a patient' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER doctor_patient_roles BEFORE INSERT OR UPDATE ON doctor_patients
  FOR EACH ROW EXECUTE FUNCTION check_assignment_roles();

-- A transactionally updated revision also protects against slow cache writes
-- finishing after another request has committed a reading change.
CREATE FUNCTION bump_report_version() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE users SET report_version=report_version+1 WHERE id=OLD.user_id;
  ELSE
    UPDATE users SET report_version=report_version+1 WHERE id=NEW.user_id;
    IF TG_OP = 'UPDATE' AND OLD.user_id <> NEW.user_id THEN
      UPDATE users SET report_version=report_version+1 WHERE id=OLD.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER readings_report_version AFTER INSERT OR UPDATE OR DELETE ON readings
  FOR EACH ROW EXECUTE FUNCTION bump_report_version();

CREATE TABLE reminder_logs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reading_count SMALLINT NOT NULL CHECK (reading_count BETWEEN 0 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);
