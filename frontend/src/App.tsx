import { useEffect, useState, useCallback } from 'react';
import { Layout } from './components/common/Layout';
import { Sidebar } from './components/common/Sidebar';
import { ChatWindow } from './components/chat/ChatWindow';
import { useChat } from './hooks/useChat';
import { meetingsApi } from './services/api';
import type { Meeting } from './types';
import './index.css';

// For Phase 1, we'll use a hardcoded organization ID
// This will be replaced with auth in Phase 2
const DEFAULT_ORG_ID = localStorage.getItem('organizationId') || '';

function App() {
  const [organizationId, setOrganizationId] = useState(DEFAULT_ORG_ID);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showSetup, setShowSetup] = useState(!DEFAULT_ORG_ID);

  const {
    messages,
    isLoading,
    error,
    meeting,
    sendMessage,
    loadMeeting,
    createMeeting,
    clearError,
  } = useChat();

  // Load meetings when organization ID is set
  useEffect(() => {
    if (organizationId) {
      meetingsApi.list(organizationId).then(setMeetings).catch(console.error);
    }
  }, [organizationId]);

  const handleNewMeeting = useCallback(async () => {
    if (!organizationId) return;
    try {
      const newMeeting = await createMeeting(organizationId, 'New Meeting');
      setMeetings((prev) => [newMeeting, ...prev]);
    } catch (err) {
      console.error('Failed to create meeting:', err);
    }
  }, [organizationId, createMeeting]);

  const handleSelectMeeting = useCallback(
    async (meetingId: string) => {
      await loadMeeting(meetingId);
    },
    [loadMeeting]
  );

  const handleSetOrganization = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const orgId = formData.get('orgId') as string;
    if (orgId) {
      localStorage.setItem('organizationId', orgId);
      setOrganizationId(orgId);
      setShowSetup(false);
    }
  };

  // Setup screen for entering organization ID
  if (showSetup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            AI Social Media Manager
          </h1>
          <p className="text-gray-600 mb-6">
            Enter your organization ID to get started. (Phase 1 - No auth yet)
          </p>
          <form onSubmit={handleSetOrganization}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization ID
            </label>
            <input
              type="text"
              name="orgId"
              placeholder="Enter UUID from seed script..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium
                         hover:bg-blue-700 transition-colors"
            >
              Get Started
            </button>
          </form>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Setup Instructions:</strong>
            </p>
            <ol className="text-sm text-gray-600 mt-2 list-decimal list-inside space-y-1">
              <li>Start PostgreSQL: <code className="bg-gray-200 px-1 rounded">docker-compose up -d</code></li>
              <li>Run migrations: <code className="bg-gray-200 px-1 rounded">alembic upgrade head</code></li>
              <li>Run seed script: <code className="bg-gray-200 px-1 rounded">python scripts/seed.py</code></li>
              <li>Copy the Organization ID above</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const sidebar = (
    <Sidebar
      meetings={meetings}
      currentMeetingId={meeting?.id}
      onSelectMeeting={handleSelectMeeting}
      onNewMeeting={handleNewMeeting}
      isLoading={isLoading}
    />
  );

  return (
    <Layout sidebar={sidebar}>
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4">
          <div className="flex items-center justify-between">
            <p className="text-red-700">{error}</p>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {meeting ? (
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          onSendMessage={sendMessage}
          meetingTitle={meeting.title || undefined}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-16 h-16 text-gray-400 mb-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome to AI Social Media Manager
          </h2>
          <p className="text-gray-600 mb-6 max-w-md">
            Start a new meeting to chat with your AI assistant about social media
            content planning and creation.
          </p>
          <button
            onClick={handleNewMeeting}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-300 disabled:cursor-not-allowed
                       transition-colors"
          >
            Start New Meeting
          </button>
        </div>
      )}
    </Layout>
  );
}

export default App;
