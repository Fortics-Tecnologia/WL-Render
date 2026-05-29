REPO    := us-central1-docker.pkg.dev/gcp-fortics-genier/genier/fortics-theme-lab/
IMAGE   := fortics-theme-lab
VERSION := $(shell node -p "require('./package.json').version")
BUILD   := $(shell git rev-parse --short HEAD)

# Nome do alvo
all: build-push

# Dependências do alvo "build-push"
build-push: build push

dev: build-dev push-dev

# Build local dev otimizado (uso de disco)
build-local-dev-clean: local-clean build-local-dev

# Regra para construir a imagem do Docker
build:
	docker build -t $(IMAGE):$(VERSION) .
	docker tag $(IMAGE):$(VERSION) $(REPO)$(IMAGE):latest
	docker tag $(IMAGE):$(VERSION) $(REPO)$(IMAGE):$(VERSION)

build-nocache:
	docker build --no-cache -t $(IMAGE):$(VERSION) .
	docker tag $(IMAGE):$(VERSION) $(REPO)$(IMAGE):latest
	docker tag $(IMAGE):$(VERSION) $(REPO)$(IMAGE):$(VERSION)

build-dev:
	docker build -t $(IMAGE):$(VERSION) .
	docker tag $(IMAGE):$(VERSION) $(REPO)$(IMAGE):dev
	docker tag $(IMAGE):$(VERSION) $(REPO)$(IMAGE):$(VERSION)
	docker tag $(IMAGE):$(VERSION) $(REPO)$(IMAGE):$(BUILD)

build-local-dev:
	docker build -t $(IMAGE):local .

# Push
push:
	docker push $(REPO)$(IMAGE):latest
	docker push $(REPO)$(IMAGE):$(VERSION)

push-dev:
	docker push $(REPO)$(IMAGE):dev
	docker push $(REPO)$(IMAGE):$(VERSION)
	docker push $(REPO)$(IMAGE):$(BUILD)

# Run local
run-local: build-local-dev
	docker run --rm -it \
		--name $(IMAGE)-local \
		-p 3000:3000 \
		-e NODE_ENV=development \
		$(IMAGE):local

# Cleanup
local-clean:
	docker rmi --force $(IMAGE):local 2>/dev/null || true

clean:
	docker rmi --force \
		$(IMAGE):$(VERSION) \
		$(REPO)$(IMAGE):latest \
		$(REPO)$(IMAGE):$(VERSION) \
		$(REPO)$(IMAGE):dev \
		$(REPO)$(IMAGE):$(BUILD) \
		$(IMAGE):local 2>/dev/null || true

help:
	@grep -E '^[a-zA-Z_-]+:' $(MAKEFILE_LIST) \
		| grep -v '^\s' \
		| awk -F: '{printf "  \033[36m%-22s\033[0m\n", $$1}'

.PHONY: all build-push dev build-local-dev-clean build build-nocache \
        build-dev build-local-dev push push-dev run-local local-clean clean help

.DEFAULT_GOAL := help
