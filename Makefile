.PHONY: all build dev clean tidy clean-all

# Default target
all: clean-all build

# Build the Wails application for production
build:
	@echo "Building 0x-excali..."
	wails build

# Run the application in development mode
dev:
	@echo "Starting development server..."
	wails dev

# Tidy up unused dependencies (Go and Node)
tidy:
	@echo "Tidying Go dependencies..."
	go mod tidy
	@echo "Pruning frontend dependencies..."
	cd frontend && pnpm prune

# Clean build artifacts (keeps node_modules)
clean:
	@echo "Cleaning build directories..."
	rm -rf build/bin
	rm -rf frontend/dist
	rm -rf frontend/.vite
	go clean
	@echo "Clean complete."

# Deep clean (removes node_modules and Go module cache)
clean-all: clean
	@echo "Removing frontend dependencies (node_modules)..."
	rm -rf frontend/node_modules
	@echo "Cleaning Go module cache..."
	go clean -modcache
	@echo "Deep clean complete."
