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