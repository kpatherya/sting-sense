# Contributing to Sting-Sense

Thanks for helping improve this route-analytics research artifact.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Local Validation

Before opening a pull request, run:

```bash
python -m py_compile bus_routes_app.py all_routes_viz.py all_routes_traffichourfilter.py all_routes_timeseries.py
```

If you change route data assumptions, include one screenshot or short note
showing how the map output changed.

## Contribution Guidelines

- Keep changes focused to one concern per pull request.
- Avoid committing secrets, private credentials, or personal API keys.
- Document any required input-column changes in `README.md`.
- Prefer portable paths over machine-specific absolute paths.
