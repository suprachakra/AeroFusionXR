# 🤝 Contributing to AeroFusionXR

Thank you for your interest in contributing to AeroFusionXR! This document provides guidelines and information for contributors.

## 📋 **Table of Contents**

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Guidelines](#contribution-guidelines)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Community](#community)

## 📜 **Code of Conduct**

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 **Getting Started**

### Prerequisites

- **Node.js** 18+ and npm 8+
- **Python** 3.9+ for ML services
- **Go** 1.19+ for some backend services
- **Docker** and Docker Compose
- **Git** for version control

### Development Environment

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/aerofusionxr.git
   cd aerofusionxr
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd clients/web && npm install
   cd ../mobile && npm install
   cd ../../
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start Development Environment**
   ```bash
   docker-compose up -d
   npm run dev
   ```

## 🛠️ **Development Setup**

### Repository Structure
```
aerofusionxr/
├── .github/              # GitHub workflows and templates
├── clients/              # Client applications
│   ├── web/             # React web application
│   ├── mobile/          # React Native mobile app
│   ├── kiosk/           # Kiosk interface
│   └── xr/              # XR applications
├── services/            # Backend microservices
├── infrastructure/      # Infrastructure as code
├── config/             # Configuration files
├── tests/              # Test suites
└── docs/               # Documentation
```

### Branch Strategy

We use **Git Flow** with the following branches:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature development
- `hotfix/*` - Critical production fixes
- `release/*` - Release preparation

### Naming Conventions

**Branches:**
- `feature/JIRA-123-add-ar-navigation`
- `bugfix/JIRA-456-fix-login-issue`
- `hotfix/JIRA-789-critical-security-patch`

**Commits:**
Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: add real-time baggage tracking`
- `fix: resolve authentication timeout issue`
- `docs: update API documentation`
- `test: add unit tests for wayfinding service`
- `chore: update dependencies`

## 📝 **Contribution Guidelines**

### Types of Contributions

1. **🐛 Bug Reports**
   - Use the bug report template
   - Provide detailed reproduction steps
   - Include environment information
   - Add relevant screenshots/logs

2. **✨ Feature Requests**
   - Use the feature request template
   - Explain the problem being solved
   - Provide user stories
   - Consider implementation complexity

3. **📖 Documentation**
   - Fix typos and improve clarity
   - Add examples and tutorials
   - Update API documentation
   - Translate content

4. **🔧 Code Contributions**
   - Bug fixes
   - New features
   - Performance improvements
   - Refactoring

### Before You Start

1. **Check Existing Issues**
   - Search for related issues
   - Comment on existing issues to avoid duplication
   - Ask questions if unclear

2. **Discuss Major Changes**
   - Create an issue for significant features
   - Get feedback from maintainers
   - Consider breaking changes carefully

## 🔄 **Pull Request Process**

### 1. Preparation

- Create a branch from `develop`
- Make your changes with clear commits
- Update documentation if needed
- Add tests for new functionality

### 2. Before Submitting

- [ ] Run all tests locally: `npm run test`
- [ ] Run linting: `npm run lint`
- [ ] Update documentation
- [ ] Add changelog entry if needed
- [ ] Rebase on latest `develop`

### 3. Pull Request Template

Use our [PR template](.github/pull_request_template.md) and ensure:

- [ ] Clear description of changes
- [ ] Link to related issues
- [ ] List of changes made
- [ ] Testing details
- [ ] Screenshots/videos if applicable
- [ ] Breaking changes noted

### 4. Review Process

1. **Automated Checks**
   - CI/CD pipeline must pass
   - Code quality checks
   - Security scans
   - Test coverage

2. **Code Review**
   - At least 2 approvals from maintainers
   - Address all feedback
   - Keep discussions focused

3. **Merge**
   - Squash and merge for features
   - Merge commit for releases
   - Delete feature branch after merge

## 📏 **Coding Standards**

### General Principles

- **Clean Code**: Write self-documenting code
- **SOLID Principles**: Follow object-oriented design principles
- **DRY**: Don't Repeat Yourself
- **YAGNI**: You Aren't Gonna Need It
- **Performance**: Consider performance implications

### Language-Specific Standards

#### JavaScript/TypeScript
```typescript
// ✅ Good
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

const getUserById = async (id: string): Promise<User | null> => {
  try {
    return await userRepository.findById(id);
  } catch (error) {
    logger.error('Failed to get user', { id, error });
    throw new UserNotFoundError(id);
  }
};

// ❌ Bad
const getUser = (id) => {
  return db.query('SELECT * FROM users WHERE id = ?', [id]);
};
```

#### Python
```python
# ✅ Good
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class UserService:
    def __init__(self, repository: UserRepository):
        self._repository = repository
    
    async def get_user(self, user_id: str) -> Optional[User]:
        try:
            return await self._repository.find_by_id(user_id)
        except Exception as e:
            logger.error(f"Failed to get user {user_id}: {e}")
            raise UserNotFoundError(user_id)

# ❌ Bad
def get_user(id):
    return db.query(f"SELECT * FROM users WHERE id = '{id}'")
```

### File Organization

- **Small, Focused Files**: One class/component per file
- **Clear Naming**: Descriptive file and variable names
- **Consistent Structure**: Follow established patterns
- **Proper Imports**: Organized and efficient imports

### Documentation

```typescript
/**
 * Calculates the optimal route between two points in the airport
 * using A* pathfinding algorithm with accessibility considerations.
 * 
 * @param from - Starting location coordinates
 * @param to - Destination location coordinates
 * @param options - Route calculation options
 * @returns Promise resolving to the optimal route
 * 
 * @example
 * ```typescript
 * const route = await calculateRoute(
 *   { x: 100, y: 200, floor: 1 },
 *   { x: 300, y: 400, floor: 2 },
 *   { accessibility: true, avoid: ['construction'] }
 * );
 * ```
 */
export async function calculateRoute(
  from: Coordinates,
  to: Coordinates,
  options: RouteOptions = {}
): Promise<Route> {
  // Implementation
}
```

## 🧪 **Testing Requirements**

### Test Coverage

- **Minimum**: 80% overall coverage
- **Services**: 85% coverage required
- **Critical Paths**: 95% coverage required

### Test Types

1. **Unit Tests**
   ```typescript
   describe('UserService', () => {
     it('should create user with valid data', async () => {
       const userData = { email: 'test@example.com', name: 'Test User' };
       const user = await userService.create(userData);
       
       expect(user.id).toBeDefined();
       expect(user.email).toBe(userData.email);
     });
   });
   ```

2. **Integration Tests**
   ```typescript
   describe('Authentication API', () => {
     it('should login with valid credentials', async () => {
       const response = await request(app)
         .post('/api/auth/login')
         .send({ email: 'test@example.com', password: 'password' })
         .expect(200);
       
       expect(response.body.token).toBeDefined();
     });
   });
   ```

3. **E2E Tests**
   ```typescript
   test('should complete booking flow', async ({ page }) => {
     await page.goto('/booking');
     await page.fill('[data-testid=departure]', 'JFK');
     await page.fill('[data-testid=arrival]', 'LAX');
     await page.click('[data-testid=search-button]');
     
     await expect(page.locator('[data-testid=flight-results]')).toBeVisible();
   });
   ```

### Testing Commands

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests in watch mode
npm run test:watch
```

## 📚 **Documentation**

### Types of Documentation

1. **Code Documentation**
   - Inline comments for complex logic
   - JSDoc/TSDoc for functions and classes
   - README files for modules

2. **API Documentation**
   - OpenAPI/Swagger specifications
   - Request/response examples
   - Error codes and handling

3. **User Documentation**
   - Setup guides
   - Feature documentation
   - Troubleshooting guides

4. **Architecture Documentation**
   - System design documents
   - Database schemas
   - Infrastructure diagrams

### Documentation Standards

- **Clear and Concise**: Easy to understand
- **Up-to-Date**: Sync with code changes
- **Examples**: Practical examples included
- **Searchable**: Well-organized and indexed

## 🌟 **Recognition**

Contributors will be recognized in:

- **Contributors Section**: README.md contributors list
- **Release Notes**: Acknowledgment in releases
- **Annual Report**: Yearly contributor highlights
- **Community Events**: Speaking opportunities

## 💬 **Community**

### Communication Channels

- **GitHub Discussions**: Technical discussions and Q&A
- **Slack**: Real-time chat (invite-only)
- **Email**: team@aerofusionxr.com for private matters

### Getting Help

1. **Check Documentation**: README, docs folder, and wiki
2. **Search Issues**: Look for existing discussions
3. **Ask Questions**: Create a discussion or issue
4. **Community**: Join our Slack for immediate help

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Professional**: Keep discussions focused and constructive
- **Be Inclusive**: Welcome newcomers and different perspectives
- **Report Issues**: Contact maintainers about any concerns

## 📞 **Contact**

- **Email**: contributors@aerofusionxr.com
- **GitHub**: @aerofusionxr
- **Website**: https://aerofusionxr.com

---

Thank you for contributing to AeroFusionXR! Together, we're building the future of airport navigation. 🚀 