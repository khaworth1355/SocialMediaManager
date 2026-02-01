import anthropic
from ..config import get_settings
from ..utils.prompts import SYSTEM_PROMPT

settings = get_settings()


class AgentService:
    """Service for interacting with Claude AI."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-20250514"
        self.max_tokens = 4096

    async def chat(
        self,
        messages: list[dict],
        system_prompt: str | None = None
    ) -> dict:
        """
        Send messages to Claude and get a response.

        Args:
            messages: List of message dicts with 'role' and 'content'
            system_prompt: Optional custom system prompt

        Returns:
            Dict with 'content' and 'usage' information
        """
        # Format messages for Claude API
        formatted_messages = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in messages
        ]

        # Call Claude API
        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system_prompt or SYSTEM_PROMPT,
            messages=formatted_messages,
        )

        # Extract response content
        content = ""
        if response.content:
            content = response.content[0].text

        return {
            "content": content,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }
        }


# Singleton instance
agent_service = AgentService()


def get_agent_service() -> AgentService:
    """Get the agent service instance."""
    return agent_service
