import { useState, useCallback } from 'react';
import type { Message, Meeting } from '../types';
import { chatApi, meetingsApi } from '../services/api';

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  meeting: Meeting | null;
  sendMessage: (content: string) => Promise<void>;
  loadMeeting: (meetingId: string) => Promise<void>;
  createMeeting: (organizationId: string, title?: string) => Promise<Meeting>;
  clearError: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);

  const loadMeeting = useCallback(async (meetingId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await meetingsApi.get(meetingId);
      setMeeting(data);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meeting');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createMeeting = useCallback(async (organizationId: string, title?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const newMeeting = await meetingsApi.create(organizationId, title);
      setMeeting(newMeeting);
      setMessages([]);
      return newMeeting;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create meeting';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!meeting) {
      setError('No meeting selected');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      meeting_id: meeting.id,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await chatApi.send({
        meeting_id: meeting.id,
        message: content,
      });

      // Replace temp message and add assistant response
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempUserMessage.id);
        return [
          ...withoutTemp,
          { ...tempUserMessage, id: `user-${Date.now()}` },
          response.message,
        ];
      });
    } catch (err) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [meeting]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    meeting,
    sendMessage,
    loadMeeting,
    createMeeting,
    clearError,
  };
}
