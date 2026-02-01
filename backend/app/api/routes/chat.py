from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ...dependencies import get_db
from ...models import Meeting, Message
from ...models.schemas import ChatRequest, ChatResponse, MessageResponse
from ...services.agent import get_agent_service, AgentService

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    agent: AgentService = Depends(get_agent_service)
):
    """Send a message and get an AI response."""
    # Get meeting with existing messages
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.messages))
        .where(Meeting.id == request.meeting_id)
    )
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Save user message
    user_message = Message(
        meeting_id=meeting.id,
        role="user",
        content=request.message,
    )
    db.add(user_message)
    await db.flush()

    # Build conversation history for Claude
    conversation = [
        {"role": msg.role, "content": msg.content}
        for msg in meeting.messages
    ]
    conversation.append({"role": "user", "content": request.message})

    # Get AI response
    response = await agent.chat(conversation)

    # Save assistant message
    assistant_message = Message(
        meeting_id=meeting.id,
        role="assistant",
        content=response["content"],
        message_metadata={"usage": response["usage"]},
    )
    db.add(assistant_message)
    await db.flush()
    await db.refresh(assistant_message)

    return ChatResponse(
        message=MessageResponse.model_validate(assistant_message),
        usage=response["usage"],
    )
