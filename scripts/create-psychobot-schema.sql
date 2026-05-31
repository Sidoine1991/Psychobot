-- PsychoBot Production Schema
-- AWS RDS PostgreSQL
-- Run this script to create tables and indices

CREATE SCHEMA IF NOT EXISTS psychobot;

-- Applications table
CREATE TABLE IF NOT EXISTS psychobot.applications (
    id SERIAL PRIMARY KEY,
    company VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Applied',
    score VARCHAR(1) DEFAULT 'B',
    applied_date DATE DEFAULT CURRENT_DATE,
    next_followup DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stories (interview prep) table
CREATE TABLE IF NOT EXISTS psychobot.stories (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    situation TEXT NOT NULL,
    task TEXT NOT NULL,
    action TEXT NOT NULL,
    result TEXT NOT NULL,
    reflection TEXT NOT NULL,
    roles TEXT[] DEFAULT ARRAY[]::TEXT[],
    confidence VARCHAR(20) DEFAULT 'Medium',
    keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job scores cache table
CREATE TABLE IF NOT EXISTS psychobot.job_scores (
    id SERIAL PRIMARY KEY,
    company VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    overall_score VARCHAR(1),
    numeric_score INT,
    dimensions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_applications_company
    ON psychobot.applications(company);

CREATE INDEX IF NOT EXISTS idx_applications_status
    ON psychobot.applications(status);

CREATE INDEX IF NOT EXISTS idx_applications_applied_date
    ON psychobot.applications(applied_date DESC);

CREATE INDEX IF NOT EXISTS idx_stories_title
    ON psychobot.stories(title);

CREATE INDEX IF NOT EXISTS idx_job_scores_lookup
    ON psychobot.job_scores(company, role);

-- Add updated_at trigger for applications
CREATE OR REPLACE FUNCTION psychobot.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON psychobot.applications
    FOR EACH ROW EXECUTE FUNCTION psychobot.update_updated_at_column();

-- Grant permissions
GRANT USAGE ON SCHEMA psychobot TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA psychobot TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA psychobot TO postgres;

-- Verify
SELECT 'Schema created successfully!' as status;
SELECT COUNT(*) as tables_created FROM information_schema.tables
    WHERE table_schema = 'psychobot';
