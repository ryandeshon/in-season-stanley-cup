# In-Season Stanley Cup - AI Guide

## Project Overview

This is a Vue 3 application for tracking the In-Season Stanley Cup competition. The project uses Vuetify, Pinia for state management, and Vue Router.

## Package Management

**ALWAYS use `yarn` for all package management operations.**

- Install dependencies: `yarn install`
- Add dependencies: `yarn add <package>`
- Add dev dependencies: `yarn add -D <package>`
- Remove dependencies: `yarn remove <package>`
- Run scripts: `yarn <script-name>`

Never use `npm` commands in this project.

## Testing

### End-to-End Testing

**Use Cypress for all end-to-end testing.**

Available commands:
- `yarn test:e2e` - Run Cypress tests headlessly
- `yarn test:e2e:open` - Open Cypress interactive test runner

The E2E tests run against a dev server on port 8080 using the cypress mode configuration.

### Unit Testing

Unit tests use Vitest:
- `yarn test:unit` - Run unit tests once
- `yarn test:unit:watch` - Run unit tests in watch mode

## Code Quality & Linting

**Always run linting before committing code.**

Available linting commands:
- `yarn lint` - Check for linting errors
- `yarn lint:fix` - Automatically fix linting errors

The project uses:
- ESLint with Vue 3 essential rules
- Prettier for code formatting
- `prettier/prettier` errors will fail the build

Before committing:
1. Run `yarn lint:fix` to auto-fix issues
2. Verify `yarn lint` passes with no errors
3. Ensure all modified files follow the project's style guide

## Commit Message Standards

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or correcting tests
- `chore`: Changes to build process or auxiliary tools

### Scopes (optional but recommended)

- `web`: Web/frontend changes
- `api`: API-related changes
- `aws`: AWS infrastructure changes
- `home`: Home page specific changes
- `assets`: Asset management

### Examples

```
feat: add SeasonChampionFlash component with animations and responsive design
fix(web): remove inappropriate quote from SeasonChampion component
fix: update API endpoints in mockApiScenario for consistency
docs: Finalize season closeout runbook and README updates
feat(api): Invalidate API cache upon draft start
```

### Guidelines

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- First line should be 72 characters or less
- Reference issues/PRs in the footer when applicable
- Keep commits atomic - one logical change per commit

## Branching & GitHub Issues

**Always start work on a new branch that is connected to a GitHub issue.**

### Branch Naming Convention

Follow the established pattern: `isc-<issue-number>-<brief-description>`

Examples:
- `isc-69-season2-closeout-2-4-0`
- `isc-026-draft-admin-safety-controls`
- `isc-022-home-game-profile`

### GitHub Issue Integration

Before starting work, you must:

1. **Check for an existing issue** - Use `gh issue list` to search for related issues
2. **Create a new issue** if one doesn't exist - Use `gh issue create` with a clear title and description
3. **Update an existing issue** if it matches your work - Add comments or update the description as needed
4. **Use the issue number in your branch name** - This creates automatic linking between branches, commits, and issues

### Workflow with Issues

```bash
# Search for existing issues
gh issue list --search "keyword"

# Create a new issue if needed
gh issue create --title "Brief description" --body "Detailed description"

# Note the issue number (e.g., #70)

# Create and checkout a new branch from main
git checkout main
git pull
git checkout -b isc-70-brief-description

# Make your changes...
```

When you push your branch and create a PR, GitHub will automatically link it to the issue.

## Development Workflow

1. **Create or identify a GitHub issue** for the work
2. **Create a feature branch from `main`** using the `isc-<issue-number>-<description>` naming convention
3. Make your changes
4. Run `yarn lint:fix` to fix any linting issues
5. Run `yarn lint` to verify no errors remain
6. Run relevant tests (`yarn test:unit` or `yarn test:e2e`)
7. Commit with a properly formatted commit message
8. Push branch to GitHub with `git push -u origin <branch-name>`
9. Create a PR against `main` using `gh pr create`
10. Reference the issue number in the PR description (e.g., "Closes #70")

## Version Management

This project uses [Changesets](https://github.com/changesets/changesets) for version management:

- `yarn changeset` - Create a new changeset
- `yarn version:prepare` - Apply changesets and version packages
- `yarn version:status` - Check changeset status

## Additional Scripts

- `yarn serve` - Start development server
- `yarn cy:serve` - Start dev server in Cypress mode (port 8080)
- `yarn build` - Build for production
- `yarn assets:optimize` - Optimize image assets
- `yarn assets:upload` - Upload assets to cloud storage
- `yarn security:audit` - Run security scan

## Code Style

- The project uses ESLint + Prettier for consistent code style
- Prettier configuration enforces formatting rules
- All linting errors must be resolved before merging
- Follow Vue 3 Composition API best practices where applicable
