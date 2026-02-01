# AI Social Media Manager Platform - Build Plan

## Project Overview

A web-based platform that provides small businesses with an AI-powered social media manager. Clients interact with their dedicated agent through async "meetings" to plan and execute social media content. The agent maintains persistent memory across sessions, presents content options for approval, and (eventually) automates posting.

---

## Technical Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React + TypeScript | Strong ecosystem, chat UI components available, your JS familiarity |
| Backend | Python + FastAPI | Async support, great for AI workflows, your Python familiarity |
| Database | PostgreSQL + pgvector | Single database for structured data and vector search |
| Authentication | Clerk | Social login, multi-user support, excellent React SDK, simpler setup |
| File Storage | DigitalOcean Spaces (S3-compatible) | Image uploads, content exports, generated assets |
| AI | Claude API (Anthropic) | Primary LLM for agent conversations |
| Embeddings | OpenAI text-embedding-3-small | Semantic search for memory retrieval, low cost |
| Image Generation | OpenAI DALL-E 3 | AI image generation when needed, same vendor as embeddings |
| Hosting | DigitalOcean Droplet | Your existing infrastructure comfort |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                    React + TypeScript                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Login/Auth  │  │ Chat UI     │  │ Admin Dashboard         │  │
│  │ (Auth0)     │  │ (Meetings)  │  │ (Client Management)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│                    Python + FastAPI                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Auth        │  │ Chat/Agent  │  │ Content Management      │  │
│  │ Middleware  │  │ Service     │  │ Service                 │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Memory      │  │ File        │  │ Usage Tracking          │  │
│  │ Service     │  │ Service     │  │ Service                 │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │ DO Spaces   │  │ External APIs   │
│   + pgvector    │  │ (S3)        │  │ Claude, DALL-E  │
└─────────────────┘  └─────────────┘  └─────────────────────┘
```

---

## Database Schema

### Core Tables

```sql
-- Organizations (the client businesses)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    onboarding_data JSONB,
    brand_guidelines JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users (can belong to organizations or be admins)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_provider_id VARCHAR(255) UNIQUE NOT NULL,  -- Auth0/Clerk ID
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL,  -- 'admin', 'client_owner', 'client_member'
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Meetings (discrete conversation sessions)
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    title VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',  -- 'active', 'archived'
    summary TEXT,  -- AI-generated summary after meeting ends
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    archived_at TIMESTAMP
);

-- Messages (individual exchanges within meetings)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) NOT NULL,
    role VARCHAR(20) NOT NULL,  -- 'user', 'assistant'
    content TEXT NOT NULL,
    metadata JSONB,  -- store token counts, model used, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Memory Items (persistent knowledge per organization)
CREATE TABLE memory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),  -- for semantic search
    memory_type VARCHAR(50) NOT NULL,  -- 'brand', 'preference', 'decision', 'insight', 'meeting_summary'
    source_meeting_id UUID REFERENCES meetings(id),  -- if derived from a meeting
    importance INTEGER DEFAULT 5,  -- 1-10 scale for retrieval weighting
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP  -- optional, for time-sensitive memories
);

-- Content Items (generated content awaiting approval or approved)
CREATE TABLE content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    meeting_id UUID REFERENCES meetings(id),
    content_type VARCHAR(50) NOT NULL,  -- 'instagram_post', 'facebook_post', 'twitter_post', etc.
    platform VARCHAR(50) NOT NULL,
    text_content TEXT,
    image_urls JSONB,  -- array of image URLs in DO Spaces
    scheduled_for TIMESTAMP,
    status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'pending_approval', 'approved', 'published', 'rejected'
    approval_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    published_at TIMESTAMP
);

-- Usage Tracking
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    event_type VARCHAR(50) NOT NULL,  -- 'meeting_started', 'message_sent', 'content_generated', 'image_generated'
    metadata JSONB,  -- tokens used, model, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_memory_org ON memory_items(organization_id);
CREATE INDEX idx_memory_embedding ON memory_items USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_messages_meeting ON messages(meeting_id);
CREATE INDEX idx_meetings_org ON meetings(organization_id);
CREATE INDEX idx_content_org ON content_items(organization_id);
CREATE INDEX idx_usage_org_date ON usage_events(organization_id, created_at);
```

---

## Project Structure

```
ai-social-media-manager/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── config.py               # Environment and settings
│   │   ├── dependencies.py         # Dependency injection
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes/
│   │   │   │   ├── auth.py         # Auth callbacks and user management
│   │   │   │   ├── meetings.py     # Meeting CRUD and chat endpoints
│   │   │   │   ├── content.py      # Content management and approval
│   │   │   │   ├── organizations.py # Org management (admin)
│   │   │   │   ├── users.py        # User management
│   │   │   │   ├── files.py        # File upload/download
│   │   │   │   └── admin.py        # Admin dashboard endpoints
│   │   │   └── middleware/
│   │   │       ├── auth.py         # JWT validation
│   │   │       └── rate_limit.py   # Rate limiting
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── agent.py            # Core agent logic and Claude integration
│   │   │   ├── memory.py           # Memory retrieval and storage
│   │   │   ├── content.py          # Content generation and formatting
│   │   │   ├── images.py           # Image generation (DALL-E/Stability)
│   │   │   ├── export.py           # Content export (CSV, calendar, etc.)
│   │   │   └── usage.py            # Usage tracking
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── database.py         # SQLAlchemy models
│   │   │   └── schemas.py          # Pydantic schemas
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── embeddings.py       # Text embedding utilities
│   │       └── prompts.py          # System prompts and templates
│   │
│   ├── alembic/                    # Database migrations
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatWindow.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── ContentPreview.tsx
│   │   │   │   └── MeetingList.tsx
│   │   │   ├── content/
│   │   │   │   ├── ContentCard.tsx
│   │   │   │   ├── ApprovalButtons.tsx
│   │   │   │   └── ExportModal.tsx
│   │   │   ├── admin/
│   │   │   │   ├── ClientList.tsx
│   │   │   │   ├── UsageCharts.tsx
│   │   │   │   └── OnboardingForm.tsx
│   │   │   └── common/
│   │   │       ├── Layout.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       └── LoadingStates.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Meeting.tsx
│   │   │   ├── ContentLibrary.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── admin/
│   │   │       ├── Clients.tsx
│   │   │       ├── Analytics.tsx
│   │   │       └── Onboarding.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useChat.ts
│   │   │   └── useContent.ts
│   │   │
│   │   ├── services/
│   │   │   └── api.ts              # API client
│   │   │
│   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   ├── App.tsx
│   │   └── index.tsx
│   │
│   ├── public/
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Build Phases

### Phase 1: Foundation (Week 1-2)

**Objective**: Get a working chat interface with Claude, basic auth, and database.

#### 1.1 Environment Setup
- [ ] Set up PyCharm project with backend and frontend directories
- [ ] Initialize Git repository
- [ ] Create `.env.example` with all required environment variables
- [ ] Set up Docker Compose for local development (PostgreSQL + pgvector)

#### 1.2 Database Setup
- [ ] Install PostgreSQL with pgvector extension locally via Docker
- [ ] Create initial Alembic migration with core tables
- [ ] Test database connection and basic CRUD operations
- [ ] Seed test data for development

#### 1.3 Backend Foundation
- [ ] Initialize FastAPI application structure
- [ ] Set up configuration management (pydantic-settings)
- [ ] Create SQLAlchemy models for all tables
- [ ] Create Pydantic schemas for request/response validation
- [ ] Implement health check endpoint
- [ ] Set up CORS middleware

#### 1.4 Basic Claude Integration
- [ ] Create agent service with Claude API integration
- [ ] Implement basic chat endpoint (no memory yet)
- [ ] Test conversation flow end-to-end via API
- [ ] Add token counting and basic usage tracking

#### 1.5 Frontend Foundation
- [ ] Initialize React project with TypeScript
- [ ] Set up Tailwind CSS for styling
- [ ] Configure mobile-first responsive breakpoints
- [ ] Create basic layout components (sidebar, header) with mobile navigation
- [ ] Build simple chat interface (hardcoded user for now)
- [ ] Test responsive layout on mobile viewport sizes
- [ ] Connect frontend to backend chat endpoint
- [ ] Verify full request/response cycle works

**Phase 1 Deliverable**: You can chat with Claude through a web interface. No auth, no memory, single user—just proof of life.

---

### Phase 2: Authentication & Multi-Tenancy (Week 3)

**Objective**: Secure the application with proper auth and client isolation.

#### 2.1 Auth Provider Setup
- [ ] Create Clerk account and application
- [ ] Configure social login providers (Google, optionally others)
- [ ] Set up custom claims for roles and organization_id
- [ ] Create test users with different roles

#### 2.2 Backend Auth Integration
- [ ] Install Clerk SDK for Python
- [ ] Create auth middleware to validate JWTs
- [ ] Implement user creation/update on first login
- [ ] Add role-based access control decorators
- [ ] Protect all API routes with auth middleware
- [ ] Add organization_id filtering to all queries

#### 2.3 Frontend Auth Integration
- [ ] Install Clerk React SDK
- [ ] Implement ClerkProvider and authentication components
- [ ] Create login/logout flow with social options
- [ ] Implement protected routes
- [ ] Add auth state to API client (attach JWT to requests)
- [ ] Create user profile component

#### 2.4 Multi-User Support
- [ ] Implement organization invitation flow
- [ ] Create user management endpoints (for org owners)
- [ ] Build UI for managing team members
- [ ] Test isolation between organizations

**Phase 2 Deliverable**: Multiple users can log in via Google, each sees only their organization's data.

---

### Phase 3: Memory System (Week 4)

**Objective**: Implement persistent, context-aware memory per client.

#### 3.1 Embedding Infrastructure
- [ ] Choose embedding model (OpenAI `text-embedding-3-small` recommended for cost)
- [ ] Create embedding utility functions
- [ ] Test vector storage and retrieval with pgvector

#### 3.2 Memory Service
- [ ] Implement memory item creation with auto-embedding
- [ ] Build semantic search function (query by similarity)
- [ ] Create memory retrieval logic (relevance scoring, deduplication)
- [ ] Add memory type filtering (brand, preference, decision, etc.)
- [ ] Implement importance weighting in retrieval

#### 3.3 Agent Memory Integration
- [ ] Modify agent service to retrieve relevant memories before responding
- [ ] Create system prompt template that incorporates memories
- [ ] Implement memory extraction from conversations (identify when agent learns something new)
- [ ] Add manual memory creation endpoint (for onboarding data)
- [ ] Test memory persistence across conversations

#### 3.4 Memory Management UI
- [ ] Create memory viewer component (what does the agent know?)
- [ ] Build manual memory editor (add/edit/delete memories)
- [ ] Add memory source attribution (which meeting did this come from?)

**Phase 3 Deliverable**: Agent remembers context across sessions. Brand guidelines loaded at onboarding persist. Decisions from past meetings inform future responses.

---

### Phase 4: Meeting System (Week 5)

**Objective**: Implement discrete meeting sessions with archival and summarization.

#### 4.1 Meeting CRUD
- [ ] Create meeting management endpoints (create, list, archive)
- [ ] Implement meeting status transitions (active → archived)
- [ ] Add meeting metadata (title, created_at, summary)

#### 4.2 Meeting Context
- [ ] Load previous meeting summaries as context for new meetings
- [ ] Implement meeting summarization on archive (Claude generates summary)
- [ ] Store meeting summaries as memory items for future retrieval
- [ ] Add "scan past meetings" functionality for relevant context

#### 4.3 Meeting UI
- [ ] Build meeting list sidebar
- [ ] Create new meeting flow
- [ ] Implement meeting archival UI
- [ ] Display meeting summaries
- [ ] Add meeting search/filter

**Phase 4 Deliverable**: Clients can start discrete meetings, archive them, and the agent references past meeting context appropriately.

---

### Phase 5: Content Generation & Management (Week 6-7)

**Objective**: Agent produces structured content options, clients approve, content is stored and exportable.

#### 5.1 Content Generation
- [ ] Create content generation prompts per platform (Instagram, Facebook, Twitter, LinkedIn)
- [ ] Implement "three options" generation flow
- [ ] Structure content output (text, hashtags, suggested image descriptions)
- [ ] Add content variation controls (tone, length, style)

#### 5.2 Content Presentation
- [ ] Build content preview cards in chat
- [ ] Create platform-specific preview mockups (show how post will look)
- [ ] Implement inline image display
- [ ] Add approval/rejection buttons with optional notes

#### 5.3 Content Library
- [ ] Create content library page (all generated content)
- [ ] Build filtering by status, platform, date
- [ ] Implement bulk approval/rejection
- [ ] Add content scheduling (set publish date)

#### 5.4 Export Functionality
- [ ] Implement CSV export (for spreadsheet lovers)
- [ ] Create formatted document export (PDF or DOCX)
- [ ] Build calendar file export (ICS)
- [ ] Add platform-specific export formats where relevant

**Phase 5 Deliverable**: Agent generates three content options per request, displayed nicely in chat, clients approve, content goes to library, exports work.

---

### Phase 6: Image Handling (Week 8)

**Objective**: Support image uploads, storage, and optional AI generation.

#### 6.1 File Upload Infrastructure
- [ ] Set up DigitalOcean Spaces bucket
- [ ] Create file upload endpoints with presigned URLs
- [ ] Implement image validation (size, format)
- [ ] Add image optimization/resizing on upload

#### 6.2 Client Image Uploads
- [ ] Build drag-and-drop upload UI
- [ ] Create image library per organization
- [ ] Implement image tagging/categorization
- [ ] Add image selection in content creation flow

#### 6.3 AI Image Generation
- [ ] Integrate OpenAI DALL-E 3 API
- [ ] Create image generation prompts based on content context
- [ ] Implement generation UI (agent suggests, client approves)
- [ ] Add image size/style options appropriate for social platforms
- [ ] Add stock image search as fallback (Unsplash API)

#### 6.4 Image in Content
- [ ] Associate images with content items
- [ ] Display images in content previews
- [ ] Include images in exports

**Phase 6 Deliverable**: Clients can upload images, agent can reference them, AI generation available when needed, images included in content workflow.

---

### Phase 7: Admin Dashboard (Week 9)

**Objective**: You and your partner can manage clients, view usage, and handle onboarding.

#### 7.1 Admin Authentication
- [ ] Create admin role checks
- [ ] Build admin-only routes
- [ ] Separate admin UI section

#### 7.2 Client Management
- [ ] List all organizations with key metrics
- [ ] View individual organization details
- [ ] Edit organization settings
- [ ] Impersonate client view (for support)

#### 7.3 Onboarding Flow
- [ ] Create onboarding form (brand info, guidelines, preferences)
- [ ] Build guided intake wizard
- [ ] Implement onboarding data → memory item conversion
- [ ] Add onboarding status tracking

#### 7.4 Usage Analytics
- [ ] Build usage dashboard (meetings, messages, content generated)
- [ ] Create per-client usage breakdown
- [ ] Add date range filtering
- [ ] Implement usage export (for billing purposes)

**Phase 7 Deliverable**: Admin dashboard lets you manage all clients, run onboarding, and track usage.

---

### Phase 8: Polish & Hardening (Week 10)

**Objective**: Production-ready security, error handling, and UX polish.

#### 8.1 Security Audit
- [ ] Review all endpoints for proper authorization
- [ ] Implement rate limiting per user/organization
- [ ] Add input sanitization everywhere
- [ ] Set up HTTPS (Let's Encrypt via Caddy or nginx)
- [ ] Review CORS settings for production
- [ ] Implement API key rotation strategy
- [ ] Add audit logging for sensitive operations

#### 8.2 Error Handling
- [ ] Create consistent error response format
- [ ] Add frontend error boundaries
- [ ] Implement retry logic for Claude API calls
- [ ] Build graceful degradation for service outages
- [ ] Set up error alerting (email or Slack)

#### 8.3 Performance
- [ ] Add database query optimization (indexes, query analysis)
- [ ] Implement response caching where appropriate
- [ ] Add loading states throughout UI
- [ ] Optimize bundle size

#### 8.4 UX Polish
- [ ] Add keyboard shortcuts for chat (desktop)
- [ ] Implement typing indicators
- [ ] Create onboarding tutorial for new clients
- [ ] Add empty states and helpful prompts
- [ ] Final mobile responsiveness pass and touch target optimization
- [ ] Test on actual mobile devices (iOS Safari, Android Chrome)

**Phase 8 Deliverable**: Application is secure, handles errors gracefully, feels polished, and works well on mobile.

---

### Phase 9: Deployment (Week 11)

**Objective**: Get the application running on your DigitalOcean droplet.

#### 9.1 Server Setup
- [ ] Provision droplet (recommend 4GB RAM minimum)
- [ ] Install Docker and Docker Compose
- [ ] Set up firewall rules (UFW)
- [ ] Configure SSH key access only
- [ ] Install and configure Caddy for reverse proxy + HTTPS

#### 9.2 Application Deployment
- [ ] Create production Docker Compose configuration
- [ ] Set up environment variables securely
- [ ] Deploy PostgreSQL (or use managed database)
- [ ] Deploy backend and frontend containers
- [ ] Run database migrations

#### 9.3 Domain & SSL
- [ ] Point domain to droplet IP
- [ ] Configure Caddy for automatic HTTPS
- [ ] Test SSL configuration

#### 9.4 Monitoring
- [ ] Set up basic health monitoring (UptimeRobot or similar)
- [ ] Configure log aggregation (simple: just Docker logs)
- [ ] Create backup strategy for database

**Phase 9 Deliverable**: Application is live at your domain, accessible to pilot clients.

---

### Phase 10: Pilot Launch (Week 12+)

**Objective**: Onboard first clients and iterate based on feedback.

#### 10.1 Pilot Preparation
- [ ] Create client onboarding documentation
- [ ] Build FAQ/help content
- [ ] Set up feedback collection mechanism
- [ ] Prepare rollback plan if critical issues arise

#### 10.2 Client Onboarding
- [ ] Conduct intake meetings (you handle this)
- [ ] Enter onboarding data into system
- [ ] Walk client through platform
- [ ] Monitor first conversations closely

#### 10.3 Iteration
- [ ] Collect feedback systematically
- [ ] Prioritize fixes and improvements
- [ ] Ship updates weekly
- [ ] Document learnings for next cohort

---

## Security Considerations

### Authentication & Authorization
- **JWT validation**: Verify tokens on every request, check expiration, validate issuer
- **Role-based access**: Enforce at middleware level, not just UI
- **Organization isolation**: Every database query must filter by organization_id for client users
- **Admin access logging**: Track when admins access client data

### Data Protection
- **Encryption at rest**: PostgreSQL with encrypted storage (DigitalOcean managed DB handles this)
- **Encryption in transit**: HTTPS everywhere, no exceptions
- **API keys**: Store in environment variables, never in code, rotate periodically
- **PII handling**: Minimize storage, consider data retention policies

### API Security
- **Rate limiting**: Per user and per organization to prevent abuse and runaway costs
- **Input validation**: Validate and sanitize all inputs using Pydantic
- **Output sanitization**: Prevent XSS in any user-generated content displayed
- **CORS**: Restrict to your frontend domain only in production

### Infrastructure
- **Firewall**: Only expose ports 80, 443, and 22 (SSH)
- **SSH**: Key-based auth only, disable password login
- **Updates**: Keep OS and dependencies updated
- **Secrets management**: Consider using DigitalOcean's secrets or a vault for production

### AI-Specific Concerns
- **Prompt injection**: Validate user inputs, consider guardrails in system prompt
- **Content filtering**: Monitor for inappropriate content generation
- **Cost controls**: Set usage limits per organization to prevent runaway API costs
- **Data leakage**: Ensure organization isolation in memory retrieval (never cross-contaminate)

---

## Additional Considerations

### Scalability Path (Post-Pilot)
- **Database**: Move to managed PostgreSQL when ready (DigitalOcean Managed Databases)
- **Caching**: Add Redis for session management and frequently accessed data
- **Queue system**: Add Celery or similar for background jobs (content scheduling, summarization)
- **CDN**: Put static assets behind a CDN for frontend performance

### Future Features (Not in Pilot)
- **Real-time streaming**: WebSocket/SSE implementation for words appearing as Claude generates them (nicer UX, add post-pilot)
- **Automated posting**: Browser automation via Playwright (Phase 2 of business)
- **Analytics integration**: Pull engagement metrics from social platforms
- **A/B testing**: Generate multiple versions, track performance
- **Team collaboration**: Comments, approvals, workflows
- **White-labeling**: Custom branding for agency use

### Cost Monitoring
- **Claude API**: Track tokens per organization, set alerts at thresholds
- **Image generation**: Track generations, potentially charge extra or limit
- **Storage**: Monitor DO Spaces usage
- **Compute**: Watch droplet resource usage, upgrade when needed

### Backup & Recovery
- **Database**: Daily automated backups (DO managed or pg_dump cron job)
- **File storage**: DO Spaces has built-in redundancy
- **Code**: Git repository is your backup
- **Environment**: Document all configuration for reproducibility

---

## Environment Variables

```bash
# Application
APP_ENV=development  # development, staging, production
APP_SECRET_KEY=your-secret-key-here
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/social_media_manager

# Auth (Clerk)
CLERK_SECRET_KEY=your-clerk-secret-key
CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_WEBHOOK_SECRET=your-webhook-secret  # for syncing user events

# AI Services
ANTHROPIC_API_KEY=your-claude-api-key
OPENAI_API_KEY=your-openai-api-key  # for embeddings and DALL-E 3

# Storage
DO_SPACES_KEY=your-spaces-key
DO_SPACES_SECRET=your-spaces-secret
DO_SPACES_BUCKET=your-bucket-name
DO_SPACES_REGION=nyc3

# Optional
SENTRY_DSN=your-sentry-dsn  # error tracking
UNSPLASH_ACCESS_KEY=your-unsplash-key  # stock image fallback
```

---

## Getting Started Checklist

Before you write any code:

- [ ] Create Clerk account and set up application with Google social login
- [ ] Create Anthropic account and generate API key
- [ ] Create OpenAI account and generate API key (for embeddings + DALL-E)
- [ ] Set up DigitalOcean Spaces bucket for file storage
- [ ] Set up local PostgreSQL with pgvector via Docker
- [ ] Clone/initialize the repository structure
- [ ] Create `.env` file with all required variables
- [ ] Verify you can connect to Claude API with a simple test script
- [ ] Verify you can generate embeddings with OpenAI API

---

## Confirmed Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth provider | Clerk | Simpler React integration, good developer experience |
| Embedding model | OpenAI text-embedding-3-small | Low cost, reliable, same vendor as image generation |
| Image generation | OpenAI DALL-E 3 | Single vendor relationship with OpenAI, simpler billing |
| Real-time streaming | Deferred to post-pilot | Reduces initial complexity, request/response is sufficient for launch |
| Mobile support | Required for pilot | Mobile-first responsive design from Phase 1 |

---

## Next Steps

1. Review this plan and flag anything that doesn't match your vision
2. Answer the open questions above
3. Set up accounts and local development environment
4. Begin Phase 1

Ready to build when you are.
