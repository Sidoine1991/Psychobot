#!/usr/bin/env python3

"""
PsychoBot - Setup RDS Schema
Creates psychobot schema with all tables and indices
Uses credentials from environment or .env.production
"""

import sys
import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.production')
load_dotenv()

# Get RDS credentials
RDS_HOST = os.getenv('AWS_RDS_HOST') or os.getenv('RDS_HOST')
RDS_PORT = int(os.getenv('AWS_RDS_PORT') or os.getenv('RDS_PORT') or 5432)
RDS_DATABASE = os.getenv('AWS_RDS_DATABASE') or os.getenv('RDS_DATABASE') or 'psychobot'
RDS_USER = os.getenv('AWS_RDS_USER') or os.getenv('RDS_USER')
RDS_PASSWORD = os.getenv('AWS_RDS_PASSWORD') or os.getenv('RDS_PASSWORD')
RDS_SSLMODE = os.getenv('AWS_RDS_SSLMODE') or os.getenv('RDS_SSLMODE') or 'require'

if not all([RDS_HOST, RDS_USER, RDS_PASSWORD]):
    print("[ERROR] Missing RDS credentials")
    print("   Required: AWS_RDS_HOST, AWS_RDS_USER, AWS_RDS_PASSWORD")
    print("   Set them in .env.production or environment variables")
    sys.exit(1)

def get_connection():
    """Create RDS connection"""
    return psycopg2.connect(
        host=RDS_HOST,
        port=RDS_PORT,
        database=RDS_DATABASE,
        user=RDS_USER,
        password=RDS_PASSWORD,
        sslmode=RDS_SSLMODE
    )

def setup_psychobot_schema():
    """Create PsychoBot schema in RDS"""

    print("\n" + "="*60)
    print("[SETUP] PsychoBot - AWS RDS Schema Setup")
    print("="*60)
    print(f"\nTarget: {RDS_HOST}:{RDS_PORT}/{RDS_DATABASE}")
    print(f"User: {RDS_USER}\n")

    conn = None
    try:
        # Connect to RDS
        print("[INFO] Connecting to AWS RDS...")
        conn = get_connection()
        cursor = conn.cursor()
        print("[OK] Connected to AWS RDS\n")

        # Test connection
        cursor.execute("SELECT 1")

        # Create schema
        print("[INFO] Creating psychobot schema...")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS psychobot;")
        conn.commit()
        print("[OK] Schema created\n")

        # Create applications table
        print("[INFO] Creating applications table...")
        cursor.execute("""
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
        """)
        conn.commit()
        print("[OK] applications table created\n")

        # Create stories table
        print("[INFO] Creating stories table...")
        cursor.execute("""
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
        """)
        conn.commit()
        print("[OK] stories table created\n")

        # Create job_scores table
        print("[INFO] Creating job_scores table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS psychobot.job_scores (
                id SERIAL PRIMARY KEY,
                company VARCHAR(255) NOT NULL,
                role VARCHAR(255) NOT NULL,
                overall_score VARCHAR(1),
                numeric_score INT,
                dimensions JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        print("[OK] job_scores table created\n")

        # Create indices
        print("[INFO] Creating indices for performance...")

        indices = [
            ("idx_applications_company",
             "CREATE INDEX IF NOT EXISTS idx_applications_company ON psychobot.applications(company);"),

            ("idx_applications_status",
             "CREATE INDEX IF NOT EXISTS idx_applications_status ON psychobot.applications(status);"),

            ("idx_applications_date",
             "CREATE INDEX IF NOT EXISTS idx_applications_date ON psychobot.applications(applied_date DESC);"),

            ("idx_stories_title",
             "CREATE INDEX IF NOT EXISTS idx_stories_title ON psychobot.stories(title);"),

            ("idx_job_scores_lookup",
             "CREATE INDEX IF NOT EXISTS idx_job_scores_lookup ON psychobot.job_scores(company, role);"),
        ]

        for idx_name, idx_query in indices:
            cursor.execute(idx_query)
            conn.commit()
            print(f"   [OK] {idx_name}")

        print()

        # Create trigger for updated_at
        print("[INFO] Creating updated_at trigger...")
        cursor.execute("""
            CREATE OR REPLACE FUNCTION psychobot.update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        """)
        cursor.execute("""
            DROP TRIGGER IF EXISTS update_applications_updated_at ON psychobot.applications;
        """)
        cursor.execute("""
            CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON psychobot.applications
                FOR EACH ROW EXECUTE FUNCTION psychobot.update_updated_at_column();
        """)
        conn.commit()
        print("[OK] Trigger created\n")

        # Verify tables
        print("[INFO] Verifying schema...")
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'psychobot'
            ORDER BY table_name;
        """)
        result = cursor.fetchall()

        if result:
            print(f"   Found {len(result)} tables:")
            for row in result:
                print(f"   [OK] {row[0]}")
            print()

        # Count records
        print("[INFO] Initial state:")

        cursor.execute("SELECT COUNT(*) as count FROM psychobot.applications;")
        apps_count = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) as count FROM psychobot.stories;")
        stories_count = cursor.fetchone()

        if apps_count:
            print(f"   Applications: {apps_count[0]} records")
        if stories_count:
            print(f"   Stories: {stories_count[0]} records")

        print("\n" + "="*60)
        print("[SUCCESS] PsychoBot schema setup complete!")
        print("="*60 + "\n")

        print("Next steps:")
        print("1. Set USE_RDS=true in .env.production")
        print("2. Set RDS_HOST, RDS_USER, RDS_PASSWORD, RDS_DATABASE")
        print("3. Deploy to Render")
        print("4. Run: node scripts/migrate-to-rds.js (optional, to migrate Markdown data)")
        print()

        return True

    except Exception as e:
        print(f"\n[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = setup_psychobot_schema()
    sys.exit(0 if success else 1)
