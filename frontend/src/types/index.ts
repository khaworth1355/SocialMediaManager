export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  organization_id: string;
  title: string | null;
  status: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  meeting_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  message_metadata?: Record<string, unknown>;
}

export interface ChatRequest {
  meeting_id: string;
  message: string;
}

export interface ChatResponse {
  message: Message;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}
