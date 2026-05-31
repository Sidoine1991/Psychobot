#!/usr/bin/env python3

"""
PsychoBot - Setup RDS Schema
Uses AWS RDS Helper (same as TradBOT)
Creates psychobot schema with all tables and indices
"""

import sys
import os

# Add TradBOT services to path (assuming you have aws_rds_helper)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../src/services'))

try:
    from aws_rds_helper import RDSHelper
except ImportError:
    print("❌ Error: Cannot import aws_rds_helper")
    print("   Make sure you have the TradBOT services available")
    print("   Expected: src/services/aws_rds_helper.py")
    sys.exit(1)

def setup_psychobot_schema():
    """Create PsychoBot schema in RDS"""

    print("\n" + "="*60)
    print("🚀 PsychoBot - AWS RDS Schema Setup")
    print("="*60 + "\n")

    try:
        # Initialize RDS connection
        print("🔌 Connecting to AWS RDS...")
        rds = RDSHelper()

        # Test connection
        result = rds.execute("SELECT 1 as connected")
        if result:
            print("✅ Connected to AWS RDS\n")

        # Create schema
        print("📋 Creating psychobot schema...")
        rds.execute("CREATE SCHEMA IF NOT EXISTS psychobot;")
        print("✅ Schema created\n")

        # Create applications table
        print("📋 Creating applications table...")
        rds.execute("""
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
        print("✅ applications table created\n")

        # Create stories table
        print("📋 Creating stories table...")
        rds.execute("""
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
        print("✅ stories table created\n")

        # Create job_scores table
        print("📋 Creating job_scores table...")
        rds.execute("""
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
        print("✅ job_scores table created\n")

        # Create indices
        print("📋 Creating indices for performance...")

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
            rds.execute(idx_query)
            print(f"   ✅ {idx_name}")

        print()

        # Create trigger for updated_at
        print("📋 Creating updated_at trigger...")
        rds.execute("""
            CREATE OR REPLACE FUNCTION psychobot.update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            DROP TRIGGER IF EXISTS update_applications_updated_at ON psychobot.applications;

            CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON psychobot.applications
                FOR EACH ROW EXECUTE FUNCTION psychobot.update_updated_at_column();
        """)
        print("✅ Trigger created\n")

        # Verify tables
        print("🔍 Verifying schema...")
        result = rds.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'psychobot'
            ORDER BY table_name;
        """)

        if result:
            print(f"   Found {len(result)} tables:")
            for row in result:
                print(f"   ✅ {row[0]}")
            print()

        # Count records
        print("📊 Initial state:")

        apps_count = rds.execute("SELECT COUNT(*) as count FROM psychobot.applications;")
        stories_count = rds.execute("SELECT COUNT(*) as count FROM psychobot.stories;")

        if apps_count:
            print(f"   Applications: {apps_count[0][0]} records")
        if stories_count:
            print(f"   Stories: {stories_count[0][0]} records")

        print("\n" + "="*60)
        print("✅ PsychoBot schema setup complete!")
        print("="*60 + "\n")

        print("Next steps:")
        print("1. Set USE_RDS=true in .env.production")
        print("2. Set RDS_HOST, RDS_USER, RDS_PASSWORD, RDS_DATABASE")
        print("3. Deploy to Render")
        print("4. Run: node scripts/migrate-to-rds.js (optional, to migrate Markdown data)")
        print()

        return True

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = setup_psychobot_schema()
    sys.exit(0 if success else 1)
