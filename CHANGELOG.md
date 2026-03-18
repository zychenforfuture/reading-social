# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Admin panel with dashboard, user/document/comment management
- API performance benchmarking tests
- Web frontend utility function tests (timeAgo, cn, chapterUtils)
- JWT secret complexity validation
- CONTRIBUTING.md and LICENSE files

### Changed
- Increased Web test coverage from 5 to 34 test cases
- Updated documentation structure and cross-references
- Improved TypeScript strict mode compliance

### Fixed
- Documentation link errors in FAQ.md
- Removed deprecated README.new.md

## [0.1.0] - 2026-03-14

### Added

#### Web Frontend
- User authentication (login/register/forgot password)
- Document reading with chapter navigation
- Inline comment system with reply and like support
- Reading settings (font size, line height, theme)
- Table of contents with auto-detection
- Notification center for comment interactions
- Admin panel for system management
- Responsive design for mobile browsers

#### API Backend
- RESTful API with Express.js
- JWT/OAuth authentication with OTP email verification
- Document upload and processing
- Comment CRUD operations with nested replies
- Real-time notifications via SSE
- Swagger API documentation
- Admin APIs for user/document/comment management
- PostgreSQL database with pgvector extension

#### Worker Service
- Document text chunking and processing
- SimHash similarity detection (64-bit fingerprint)
- Embedding generation with all-MiniLM-L6-v2 model
- Asynchronous job processing with BullMQ
- Redis queue for job distribution

#### Mobile App (Expo)
- Basic authentication flow
- Document list and reading view
- Comment viewing and creation
- User profile management
- API integration with backend

#### Infrastructure
- Docker Compose configuration for development and production
- Automated deployment scripts
- Database migration system
- Environment variable management

### Technical Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + TanStack Query
- **Backend**: Express.js + PostgreSQL + Redis + BullMQ
- **Mobile**: Expo + React Native + Zustand
- **Testing**: Vitest + Testing Library + Supertest
- **Deployment**: Docker + Docker Compose

### Known Limitations
- Qdrant vector database configured but not fully integrated
- Mobile notification center and reading settings incomplete
- Cross-document comment aggregation UI not implemented
- PDF/EPUB upload support in development

---

## Release Notes Template

When creating a new release, use this template:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Now removed features

### Fixed
- Bug fixes

### Security
- Security improvements
```
