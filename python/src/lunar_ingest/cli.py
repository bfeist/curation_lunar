import argparse
import json
from pathlib import Path

from . import __version__, code_fingerprint
from .common import PILOT_SAMPLES, digest, utcnow
from .pipeline import Pipeline
from .reports import export, validate
from .storage import Store, read_config, write_json

DEFAULT_DATA = Path(__file__).resolve().parents[3] / "data" / "runs"


def main(argv=None):
    parser = argparse.ArgumentParser(description="Acquire and audit NASA's current public Lunar Curation website.")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)
    start = sub.add_parser("start", help="Create a dated pilot/full run, acquire metadata and produce reports")
    start.add_argument("--mode", choices=["pilot", "full"], default="pilot")
    start.add_argument("--run", required=True, help="Run name (new directory, never overwrite a prior run)")
    start.add_argument("--data-dir", type=Path, default=DEFAULT_DATA)
    start.add_argument("--samples", nargs="*", default=PILOT_SAMPLES)
    start.add_argument("--max-requests", type=int, default=120, help="HTTP budget per invocation; 0 means unlimited")
    start.add_argument("--delay", type=float, default=1.0)
    start.add_argument("--photo-limit", type=int, default=12, help="Pilot photo-detail cap; ignored in full mode")
    start.add_argument("--page-limit", type=int, default=25, help="Pilot informational-page cap; ignored in full mode")
    start.add_argument("--user-agent", default="LunarPublicViewResearch/0.1 (metadata acquisition; sequential requests)")
    for name in ("resume", "parse", "validate", "export", "status"):
        command = sub.add_parser(name)
        command.add_argument("run_dir", type=Path)
        if name == "resume":
            command.add_argument("--max-requests", type=int, default=120)
            command.add_argument("--retry-failed", action="store_true")
    args = parser.parse_args(argv)
    if args.command == "start":
        if Path(args.run).name != args.run or args.run in (".", ".."):
            parser.error("--run must be a directory name, not a path")
        if args.delay < 0 or args.max_requests < 0 or args.photo_limit < 0 or args.page_limit < 0:
            parser.error("Limits and delay must be nonnegative")
        root = args.data_dir.resolve() / args.run
        if root.exists():
            parser.error(f"Run already exists: {root}. Use resume or a new run name.")
        config = {"run_id": args.run, "created_at": utcnow(), "mode": args.mode, "samples": args.samples, "delay": args.delay, "photo_limit": args.photo_limit, "page_limit": args.page_limit, "user_agent": args.user_agent, "parser_version": __version__, "source_model": "reverse_engineered_public_view", "search_discrepancy_policy": "legacy_search_bug_pending_original_source_audit"}
        config["parser_code_sha256"] = code_fingerprint()
        config["config_sha256"] = digest(config)
        write_json(root / "run.json", config)
    else:
        root = args.run_dir.resolve()
        if not (root / "run.json").is_file():
            parser.error(f"Not an acquisition run: {root}")
        config = read_config(root)
    store = Store(root)
    try:
        pipeline = Pipeline(store, config)
        if args.command == "start":
            pipeline.seed()
            state = pipeline.run(args.max_requests)
            validate(store, config)
            print(f"{state}: {root}")
        elif args.command == "resume":
            if args.max_requests < 0:
                parser.error("--max-requests must be nonnegative")
            state = pipeline.run(args.max_requests, args.retry_failed)
            validate(store, config)
            print(f"{state}: {root}")
        elif args.command == "parse":
            print(f"Reparsed {pipeline.reparse()} cached responses; no network requests.")
            validate(store, config)
        elif args.command == "validate":
            result = validate(store, config)
            print(json.dumps({k: result[k] for k in ("totals", "unresolved_errors", "content_parity")}, indent=2))
            return 1 if result["unresolved_errors"] else 0
        elif args.command == "export":
            print(export(store, config))
        else:
            print(json.dumps(store.rows("SELECT kind,state,COUNT(*) count FROM requests GROUP BY kind,state ORDER BY kind,state"), indent=2))
        return 0
    except KeyboardInterrupt:
        print("Interrupted. Completed requests are saved; use resume.")
        return 130
    finally:
        store.close()


if __name__ == "__main__":
    raise SystemExit(main())
