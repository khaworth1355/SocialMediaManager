"""Seed script to create test data for development."""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models.database import Base, Organization, Meeting


async def seed_database():
    """Create test organization and meeting."""
    settings = get_settings()

    engine = create_async_engine(settings.database_url, echo=True)

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        # Check if test org exists
        from sqlalchemy import select
        result = await session.execute(
            select(Organization).where(Organization.slug == "test-company")
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"Test organization already exists: {existing.id}")
            org = existing
        else:
            # Create test organization
            org = Organization(
                name="Test Company",
                slug="test-company",
                brand_guidelines={
                    "tone": "friendly and professional",
                    "colors": ["#3B82F6", "#10B981"],
                    "target_audience": "small business owners"
                }
            )
            session.add(org)
            await session.flush()
            print(f"Created test organization: {org.id}")

        # Create a test meeting
        meeting = Meeting(
            organization_id=org.id,
            title="Welcome Meeting",
        )
        session.add(meeting)
        await session.commit()
        print(f"Created test meeting: {meeting.id}")

        print("\n--- Test Data ---")
        print(f"Organization ID: {org.id}")
        print(f"Meeting ID: {meeting.id}")
        print("\nUse these IDs when testing the API!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_database())
