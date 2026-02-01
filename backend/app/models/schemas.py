from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


# ============== Organization Schemas ==============

class OrganizationBase(BaseModel):
    name: str
    slug: str


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationResponse(OrganizationBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============== Meeting Schemas ==============

class MeetingBase(BaseModel):
    title: str | None = None


class MeetingCreate(MeetingBase):
    organization_id: UUID


class MeetingResponse(MeetingBase):
    id: UUID
    organization_id: UUID
    status: str
    summary: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MeetingWithMessages(MeetingResponse):
    messages: list["MessageResponse"] = []


# ============== Message Schemas ==============

class MessageBase(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class MessageCreate(MessageBase):
    meeting_id: UUID


class MessageResponse(MessageBase):
    id: UUID
    meeting_id: UUID
    created_at: datetime
    message_metadata: dict | None = None

    class Config:
        from_attributes = True


# ============== Chat Schemas ==============

class ChatRequest(BaseModel):
    """Request to send a message in a meeting."""
    meeting_id: UUID
    message: str


class ChatResponse(BaseModel):
    """Response from the AI agent."""
    message: MessageResponse
    usage: dict | None = None


# Update forward references
MeetingWithMessages.model_rebuild()
