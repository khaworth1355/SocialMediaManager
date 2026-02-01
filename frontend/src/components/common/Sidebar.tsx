import type { Meeting } from '../../types';

interface SidebarProps {
  meetings: Meeting[];
  currentMeetingId?: string;
  onSelectMeeting: (meetingId: string) => void;
  onNewMeeting: () => void;
  isLoading?: boolean;
}

export function Sidebar({
  meetings,
  currentMeetingId,
  onSelectMeeting,
  onNewMeeting,
  isLoading,
}: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">AI Social Media</h1>
        <p className="text-sm text-gray-500">Manager</p>
      </div>

      {/* New Meeting Button */}
      <div className="flex-shrink-0 p-4">
        <button
          onClick={onNewMeeting}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2
                     bg-blue-600 text-white rounded-lg font-medium
                     hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                     disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New Meeting
        </button>
      </div>

      {/* Meetings List */}
      <div className="flex-1 overflow-y-auto px-2">
        <p className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Recent Meetings
        </p>
        {meetings.length === 0 ? (
          <p className="px-2 py-4 text-sm text-gray-500 text-center">
            No meetings yet
          </p>
        ) : (
          <ul className="space-y-1">
            {meetings.map((meeting) => (
              <li key={meeting.id}>
                <button
                  onClick={() => onSelectMeeting(meeting.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors
                             ${
                               meeting.id === currentMeetingId
                                 ? 'bg-blue-50 text-blue-700'
                                 : 'text-gray-700 hover:bg-gray-100'
                             }`}
                >
                  <p className="font-medium truncate">
                    {meeting.title || 'Untitled Meeting'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(meeting.created_at).toLocaleDateString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">Phase 1 - Foundation</p>
      </div>
    </div>
  );
}
