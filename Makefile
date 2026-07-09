.PHONY: all build clean frontend backend run

VERSION  ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT   ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILDTIME ?= $(shell date -u '+%Y-%m-%d %H:%M:%S')
LDFLAGS  := -X 'main.Version=$(VERSION)' -X 'main.CommitID=$(COMMIT)' -X 'main.BuildTime=$(BUILDTIME)'

all: build

build: frontend backend

clean:
	rm -rf code-pdm-server frontend/dist

frontend:
	cd frontend && ( [ -d node_modules ] || npm install )
	cd frontend && npm run build

backend:
	go mod download
	go build -ldflags "$(LDFLAGS)" -o code-pdm-server

run: build
	./code-pdm-server
