.PHONY: help check-env docker-build docker-up docker-down docker-logs docker-restart docker-clean docker-db-init docker-db-backup docker-db-restore test-api

# Default target
.DEFAULT_GOAL := help

# Variables
DOCKER_COMPOSE = docker-compose
ENV_FILE = .env
ENV_EXAMPLE = .env.example

# Colors for output
COLOR_RESET = \033[0m
COLOR_INFO = \033[36m
COLOR_SUCCESS = \033[32m
COLOR_WARNING = \033[33m
COLOR_ERROR = \033[31m

help: ## Show this help message
	@echo "$(COLOR_INFO)S1pper Dashboard - Docker Management$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_INFO)Available targets:$(COLOR_RESET)"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(COLOR_SUCCESS)%-20s$(COLOR_RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

check-env: ## Check if .env file exists and has required variables
	@echo "$(COLOR_INFO)Checking environment configuration...$(COLOR_RESET)"
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "$(COLOR_WARNING)⚠️  .env file not found!$(COLOR_RESET)"; \
		echo "$(COLOR_INFO)Creating .env from .env.example template...$(COLOR_RESET)"; \
		cp $(ENV_EXAMPLE) $(ENV_FILE); \
		echo "$(COLOR_SUCCESS)✅ Created .env file$(COLOR_RESET)"; \
		echo "$(COLOR_WARNING)⚠️  Please update .env with your configuration before proceeding!$(COLOR_RESET)"; \
		exit 1; \
	fi
	@echo "$(COLOR_SUCCESS)✅ Environment file exists$(COLOR_RESET)"
	@if ! grep -q "PRINTER_HOST=" $(ENV_FILE) || ! grep -q "POSTGRES_PASSWORD=" $(ENV_FILE); then \
		echo "$(COLOR_ERROR)❌ .env file is missing required variables$(COLOR_RESET)"; \
		echo "$(COLOR_INFO)Please ensure PRINTER_HOST and POSTGRES_PASSWORD are set$(COLOR_RESET)"; \
		exit 1; \
	fi
	@echo "$(COLOR_SUCCESS)✅ Required variables present$(COLOR_RESET)"

check-deps: ## Check if required dependencies are installed
	@echo "$(COLOR_INFO)Checking dependencies...$(COLOR_RESET)"
	@command -v docker >/dev/null 2>&1 || { echo "$(COLOR_ERROR)❌ Docker is not installed$(COLOR_RESET)"; exit 1; }
	@echo "$(COLOR_SUCCESS)✅ Docker is installed$(COLOR_RESET)"
	@command -v docker-compose >/dev/null 2>&1 || command -v docker compose >/dev/null 2>&1 || { echo "$(COLOR_ERROR)❌ Docker Compose is not installed$(COLOR_RESET)"; exit 1; }
	@echo "$(COLOR_SUCCESS)✅ Docker Compose is installed$(COLOR_RESET)"

docker-build: check-env check-deps ## Build Docker images
	@echo "$(COLOR_INFO)Building Docker images...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) build --no-cache
	@echo "$(COLOR_SUCCESS)✅ Docker images built successfully$(COLOR_RESET)"

docker-up: check-env check-deps ## Start Docker containers
	@echo "$(COLOR_INFO)Starting Docker containers...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) up -d
	@echo ""
	@echo "$(COLOR_SUCCESS)✅ Containers started successfully!$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_INFO)Dashboard URL: http://localhost:3000$(COLOR_RESET)"
	@echo "$(COLOR_INFO)Database: postgresql://localhost:5432/guestbook$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_INFO)View logs with: make docker-logs$(COLOR_RESET)"

docker-down: ## Stop and remove Docker containers
	@echo "$(COLOR_INFO)Stopping Docker containers...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) down
	@echo "$(COLOR_SUCCESS)✅ Containers stopped$(COLOR_RESET)"

docker-logs: ## Show Docker container logs
	@echo "$(COLOR_INFO)Showing container logs (Ctrl+C to exit)...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) logs -f

docker-restart: docker-down docker-up ## Restart Docker containers

docker-clean: ## Remove containers, volumes, and images
	@echo "$(COLOR_WARNING)⚠️  This will remove all containers, volumes, and images!$(COLOR_RESET)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "$(COLOR_INFO)Cleaning up Docker resources...$(COLOR_RESET)"; \
		$(DOCKER_COMPOSE) down -v --rmi all; \
		echo "$(COLOR_SUCCESS)✅ Cleanup complete$(COLOR_RESET)"; \
	else \
		echo "$(COLOR_INFO)Cleanup cancelled$(COLOR_RESET)"; \
	fi

docker-db-init: ## Initialize database with sample data
	@echo "$(COLOR_INFO)Initializing database with sample data...$(COLOR_RESET)"
	@docker exec -i s1pper-postgres psql -U guestbook -d guestbook < scripts/init-db.sql
	@echo "$(COLOR_SUCCESS)✅ Database initialized$(COLOR_RESET)"

docker-db-backup: ## Backup database to SQL file
	@echo "$(COLOR_INFO)Backing up database...$(COLOR_RESET)"
	@mkdir -p backups
	@docker exec s1pper-postgres pg_dump -U guestbook guestbook > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(COLOR_SUCCESS)✅ Database backed up to backups/$(COLOR_RESET)"

docker-db-restore: ## Restore database from latest backup
	@echo "$(COLOR_INFO)Restoring database from latest backup...$(COLOR_RESET)"
	@LATEST=$$(ls -t backups/*.sql 2>/dev/null | head -1); \
	if [ -z "$$LATEST" ]; then \
		echo "$(COLOR_ERROR)❌ No backup files found in backups/$(COLOR_RESET)"; \
		exit 1; \
	fi; \
	echo "$(COLOR_INFO)Restoring from: $$LATEST$(COLOR_RESET)"; \
	docker exec -i s1pper-postgres psql -U guestbook -d guestbook < "$$LATEST"
	@echo "$(COLOR_SUCCESS)✅ Database restored$(COLOR_RESET)"

test-api: ## Test API endpoints with curl
	@echo "$(COLOR_INFO)Testing API endpoints...$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_INFO)Testing printer status endpoint...$(COLOR_RESET)"
	@curl -s http://localhost:3000/api/printer/status | jq '.' || echo "$(COLOR_ERROR)❌ Failed$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_INFO)Testing camera info endpoint...$(COLOR_RESET)"
	@curl -s http://localhost:3000/api/camera/info | jq '.' || echo "$(COLOR_ERROR)❌ Failed$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_INFO)Testing guestbook endpoint...$(COLOR_RESET)"
	@curl -s http://localhost:3000/api/guestbook | jq '.' || echo "$(COLOR_ERROR)❌ Failed$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_SUCCESS)✅ API tests complete$(COLOR_RESET)"

dev: ## Start development server (without Docker)
	@echo "$(COLOR_INFO)Starting development server...$(COLOR_RESET)"
	@pnpm dev

install: ## Install dependencies
	@echo "$(COLOR_INFO)Installing dependencies...$(COLOR_RESET)"
	@pnpm install
	@echo "$(COLOR_SUCCESS)✅ Dependencies installed$(COLOR_RESET)"

build: ## Build production bundle
	@echo "$(COLOR_INFO)Building production bundle...$(COLOR_RESET)"
	@pnpm build
	@echo "$(COLOR_SUCCESS)✅ Build complete$(COLOR_RESET)"
