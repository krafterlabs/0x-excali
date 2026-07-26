.PHONY: all setup build build-prod dev clean

# Default target
all: clean build

# Setup local development environment (Git hooks, etc.)
setup:
	@echo "Configuring native Git hooks..."
	git config core.hooksPath .githooks
	@echo "Setup complete."

# Run the application in development mode with proper logs
dev:
	@echo "Starting development server..."
	wails dev -loglevel debug

# Build the Wails application for local testing with logs enabled
build:
	@echo "Building 0x-excali (Local with logs)..."
	wails build -debug

# Secure production grade build with full optimization and preflight checks
build-prod:
	@echo "Building 0x-excali (Secure Production optimized)..."
	GOTOOLCHAIN=local ./scripts/build-production.sh --target macos --arch universal --package dmg --secure

# Deep clean (removes build directories, node_modules, and Go module cache)
clean:
	@echo "Cleaning build directories..."
	rm -rf build/bin
	rm -rf frontend/dist
	rm -rf frontend/.vite
	@echo "Cleaning dependency caches..."
	rm -rf frontend/node_modules
	go clean -modcache
	@echo "Deep clean complete."
