"""A versioned model of the public website, not NASA's original curation schema."""

__version__ = "0.1.0"


def code_fingerprint():
    """Fingerprint packaged Python/SQL sources even before this workspace has Git history."""
    import hashlib
    from pathlib import Path
    root = Path(__file__).parent
    h = hashlib.sha256()
    for path in sorted(list(root.glob("*.py")) + list((root / "migrations").glob("*.sql"))):
        h.update(path.relative_to(root).as_posix().encode())
        h.update(path.read_bytes())
    return h.hexdigest()
