from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ...dependencies import get_db
from ...models import Organization, Meeting, Message
from ...models.schemas import (
    MeetingCreate,
    MeetingResponse,
    MeetingWithMessages,
)

router = APIRouter()


@router.post("/", response_model=MeetingResponse)
async def create_meeting(
    meeting: MeetingCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new meeting."""
    # Verify organization exists
    result = await db.execute(
        select(Organization).where(Organization.id == meeting.organization_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Create meeting
    db_meeting = Meeting(
        organization_id=meeting.organization_id,
        title=meeting.title or "New Meeting",
    )
    db.add(db_meeting)
    await db.flush()
    await db.refresh(db_meeting)

    return db_meeting


@router.get("/", response_model=list[MeetingResponse])
async def list_meetings(
    organization_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """List all meetings for an organization."""
    result = await db.execute(
        select(Meeting)
        .where(Meeting.organization_id == organization_id)
        .order_by(Meeting.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{meeting_id}", response_model=MeetingWithMessages)
async def get_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a meeting with all its messages."""
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.messages))
        .where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    return meeting
