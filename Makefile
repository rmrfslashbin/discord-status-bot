.PHONY: help install dev build deploy test lint format clean setup validate precommit

# Colors for output
CYAN := \033[36m
RESET := \033[0m

help: ## Show this help message
	@echo "$(CYAN)Discord Status Bot - Development Commands$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "$(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

setup: install ## Initial project setup
	@echo "$(CYAN)Setting up Discord Status Bot...$(RESET)"
	@echo "1. Configure your secrets in wrangler.toml or .dev.vars"
	@echo "2. Run 'make register' to register Discord commands"
	@echo "3. Run 'make dev' to start development server"

dev: ## Start development server
	npm run dev

deploy: ## Deploy to default environment
	npm run deploy

deploy-dev: ## Deploy to development environment
	npm run deploy:dev

deploy-prod: ## Deploy to production environment
	npm run deploy:prod

tail: ## Monitor live logs from Cloudflare
	npm run tail

test: ## Run tests
	npm run test

test-coverage: ## Run tests with coverage report
	npm run test:coverage

lint: ## Check code with ESLint
	npm run lint

lint-fix: ## Fix ESLint issues automatically
	npm run lint:fix

format: ## Format code with Prettier
	npm run format

format-check: ## Check code formatting
	npm run format:check

validate: ## Run all validation checks (lint + format)
	npm run validate

precommit: validate test ## Run pre-commit checks (validate + test)
	@echo "$(CYAN)Pre-commit checks passed!$(RESET)"

register: ## Register Discord slash commands
	npm run register:commands

clean: ## Clean build artifacts and dependencies
	rm -rf node_modules coverage .wrangler dist build
	rm -f package-lock.json

reinstall: clean install ## Clean and reinstall dependencies

# Development workflow helpers
check: validate test ## Run all checks (lint, format, test)
	@echo "$(CYAN)All checks passed!$(RESET)"

quick-deploy: check deploy-dev ## Run checks then deploy to dev
	@echo "$(CYAN)Deployed to development!$(RESET)"

prod-deploy: check deploy-prod ## Run checks then deploy to production
	@echo "$(CYAN)Deployed to production!$(RESET)"

# Git helpers
commit: precommit ## Prepare for git commit
	@echo "$(CYAN)Ready to commit!$(RESET)"
	@echo "Run: git add . && git commit -m 'your message'"

# Info commands
info: ## Show project information
	@echo "$(CYAN)Discord Status Bot$(RESET)"
	@echo "Version: $$(node -p "require('./package.json').version")"
	@echo "Author: Robert Sigler"
	@echo "License: MIT"
	@echo ""
	@echo "Runtime: Cloudflare Workers"
	@echo "Node Version: $$(node --version)"
	@echo "NPM Version: $$(npm --version)"

status: ## Show git and deployment status
	@echo "$(CYAN)Git Status:$(RESET)"
	@git status --short
	@echo ""
	@echo "$(CYAN)Current Branch:$(RESET)"
	@git branch --show-current
	@echo ""
	@echo "$(CYAN)Last Commit:$(RESET)"
	@git log -1 --oneline

# Environment management
create-env: ## Create a new wrangler environment (usage: make create-env ENV=myenv)
	@if [ -z "$(ENV)" ]; then \
		echo "$(CYAN)Error: ENV parameter is required$(RESET)"; \
		echo "Usage: make create-env ENV=myenv"; \
		exit 1; \
	fi
	@echo "$(CYAN)Creating wrangler environment: $(ENV)$(RESET)"
	@echo "Creating wrangler.$(ENV).toml..."
	@sed 's/^name = "discord-status-bot"/name = "discord-status-bot-$(ENV)"/' wrangler.toml > wrangler.$(ENV).toml
	@echo "Environment file created: wrangler.$(ENV).toml"
	@echo ""
	@echo "$(CYAN)Next steps:$(RESET)"
	@echo "1. Edit wrangler.$(ENV).toml to customize settings"
	@echo "2. Create KV namespace: make create-kv-env ENV=$(ENV)"
	@echo "3. Set secrets: make set-secrets-env ENV=$(ENV)"
	@echo "4. Deploy: make deploy-env ENV=$(ENV)"

create-kv-env: ## Create KV namespace for environment (usage: make create-kv-env ENV=myenv)
	@if [ -z "$(ENV)" ]; then \
		echo "$(CYAN)Error: ENV parameter is required$(RESET)"; \
		echo "Usage: make create-kv-env ENV=myenv"; \
		exit 1; \
	fi
	@echo "$(CYAN)Creating KV namespace for environment: $(ENV)$(RESET)"
	wrangler kv:namespace create "STATUS_BOT_STORAGE_$(shell echo $(ENV) | tr '[:lower:]' '[:upper:]')" --env $(ENV)
	@echo ""
	@echo "$(CYAN)Update your wrangler.$(ENV).toml with the namespace ID from above$(RESET)"

set-secrets-env: ## Set secrets for environment (usage: make set-secrets-env ENV=myenv)
	@if [ -z "$(ENV)" ]; then \
		echo "$(CYAN)Error: ENV parameter is required$(RESET)"; \
		echo "Usage: make set-secrets-env ENV=myenv"; \
		exit 1; \
	fi
	@echo "$(CYAN)Setting secrets for environment: $(ENV)$(RESET)"
	@echo "Setting DISCORD_APPLICATION_ID..."
	@wrangler secret put DISCORD_APPLICATION_ID --env $(ENV)
	@echo "Setting DISCORD_BOT_TOKEN..."
	@wrangler secret put DISCORD_BOT_TOKEN --env $(ENV)
	@echo "Setting DISCORD_PUBLIC_KEY..."
	@wrangler secret put DISCORD_PUBLIC_KEY --env $(ENV)
	@echo "Setting LLM_CREDENTIALS..."
	@wrangler secret put LLM_CREDENTIALS --env $(ENV)
	@echo "$(CYAN)Secrets set for $(ENV) environment$(RESET)"

deploy-env: ## Deploy to specific environment (usage: make deploy-env ENV=myenv)
	@if [ -z "$(ENV)" ]; then \
		echo "$(CYAN)Error: ENV parameter is required$(RESET)"; \
		echo "Usage: make deploy-env ENV=myenv"; \
		exit 1; \
	fi
	@echo "$(CYAN)Deploying to environment: $(ENV)$(RESET)"
	wrangler deploy --config wrangler.$(ENV).toml

list-envs: ## List all available wrangler environment files
	@echo "$(CYAN)Available environment files:$(RESET)"
	@ls -la wrangler*.toml 2>/dev/null || echo "No environment files found"
	@echo ""
	@echo "$(CYAN)Create new environment with:$(RESET) make create-env ENV=myenv"

delete-env: ## Delete environment files (usage: make delete-env ENV=myenv)
	@if [ -z "$(ENV)" ]; then \
		echo "$(CYAN)Error: ENV parameter is required$(RESET)"; \
		echo "Usage: make delete-env ENV=myenv"; \
		exit 1; \
	fi
	@echo "$(CYAN)Deleting environment files for: $(ENV)$(RESET)"
	@if [ -f "wrangler.$(ENV).toml" ]; then \
		rm -f wrangler.$(ENV).toml; \
		echo "Deleted wrangler.$(ENV).toml"; \
	else \
		echo "Environment file wrangler.$(ENV).toml not found"; \
	fi

# Complete environment setup workflow
setup-env: ## Complete setup for new environment (usage: make setup-env ENV=myenv)
	@if [ -z "$(ENV)" ]; then \
		echo "$(CYAN)Error: ENV parameter is required$(RESET)"; \
		echo "Usage: make setup-env ENV=myenv"; \
		exit 1; \
	fi
	@echo "$(CYAN)Setting up complete environment: $(ENV)$(RESET)"
	make create-env ENV=$(ENV)
	@echo ""
	@echo "$(CYAN)Manual steps required:$(RESET)"
	@echo "1. Update wrangler.$(ENV).toml KV namespace binding with:"
	@echo "   make create-kv-env ENV=$(ENV)"
	@echo "2. Set secrets:"
	@echo "   make set-secrets-env ENV=$(ENV)"
	@echo "3. Deploy:"
	@echo "   make deploy-env ENV=$(ENV)"