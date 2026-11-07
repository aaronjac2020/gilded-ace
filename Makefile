# Thin wrapper; run.py is the cross-platform source of truth.
PY ?= python
.PHONY: setup check pipeline test export web dev build judge shots all
setup:    ; $(PY) run.py setup
check:    ; $(PY) run.py check
pipeline: ; $(PY) run.py pipeline
test:     ; $(PY) run.py test
export:   ; $(PY) run.py export
web:      ; $(PY) run.py web
dev:      ; $(PY) run.py dev
build:    ; $(PY) run.py build
judge:    ; $(PY) run.py judge $(ARGS)
shots:    ; $(PY) run.py shots
all:      ; $(PY) run.py all
