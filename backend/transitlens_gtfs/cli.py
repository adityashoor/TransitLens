from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import load_settings
from .bikeshare import bikeshare_resources, ingest_bikeshare, resource_year, validate_bikeshare
from .db import apply_schema, create_database, make_engine
from .download import archive_feed, download_feed, extract_feed
from .equity import build_equity_scores, validate_equity_scores
from .load import load_gtfs_tables, populate_spatial_columns, upsert_feed_version
from .prediction_model import train_ridership_model
from .ridership import ingest_ridership, validate_ridership
from .transit_graph import build_transit_graph_tables, validate_transit_graph
from .validate import assert_valid, run_validations


def cmd_init_db(_: argparse.Namespace) -> None:
    settings = load_settings()
    create_database(settings)
    engine = make_engine(settings.database_url)
    apply_schema(engine)
    print("Database transitlens is ready with PostGIS schema.")


def cmd_download(args: argparse.Namespace) -> None:
    settings = load_settings()
    result = download_feed(settings, force=args.force)
    archive_path = archive_feed(settings, result["zip_path"], result["sha256"])
    extract_dir = extract_feed(settings, result["zip_path"])
    print(
        json.dumps(
            {
                "zip_path": str(result["zip_path"]),
                "archive_path": str(archive_path),
                "extract_dir": str(extract_dir),
                "sha256": result["sha256"],
                "downloaded": result["downloaded"],
                "resource_url": result["resource"].get("url"),
            },
            indent=2,
        )
    )


def cmd_ingest(args: argparse.Namespace) -> None:
    settings = load_settings()
    if args.download:
        download_result = download_feed(settings, force=args.force_download)
        archive_path = archive_feed(
            settings, download_result["zip_path"], download_result["sha256"]
        )
        extract_dir = extract_feed(settings, download_result["zip_path"])
        resource = download_result["resource"]
        zip_sha256 = download_result["sha256"]
    else:
        extract_dir = extract_feed(settings, settings.gtfs_zip_path)
        archive_path = archive_feed(
            settings,
            settings.gtfs_zip_path,
            download_feed(settings, force=False)["sha256"],
        )
        resource = download_feed(settings, force=False)["resource"]
        zip_sha256 = download_feed(settings, force=False)["sha256"]

    create_database(settings)
    engine = make_engine(settings.database_url)
    apply_schema(engine)
    row_counts = load_gtfs_tables(engine, extract_dir, chunksize=args.chunksize)
    populate_spatial_columns(engine)
    feed_version_id = upsert_feed_version(
        engine, resource, zip_sha256, archive_path, row_counts
    )
    validation_results = run_validations(engine, extract_dir)
    if args.strict:
        assert_valid(validation_results)
    print(
        json.dumps(
            {
                "feed_version_id": feed_version_id,
                "row_counts": row_counts,
                "validation": validation_results,
            },
            indent=2,
            sort_keys=True,
        )
    )


def cmd_validate(_: argparse.Namespace) -> None:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    results = run_validations(engine, settings.gtfs_extract_dir)
    assert_valid(results)
    print(json.dumps(results, indent=2, sort_keys=True))


def cmd_ingest_ridership(args: argparse.Namespace) -> None:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    apply_schema(engine)
    results = ingest_ridership(engine, force_download=args.force_download)
    if args.strict:
        failures = {
            key: value
            for key, value in results["validation"].items()
            if key.startswith("negative_") and value != 0
        }
        if failures:
            raise RuntimeError(f"Ridership validation failed: {failures}")
    print(json.dumps(results, indent=2, sort_keys=True))


def cmd_validate_ridership(_: argparse.Namespace) -> None:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    print(json.dumps(validate_ridership(engine), indent=2, sort_keys=True))


def cmd_ingest_bikeshare(args: argparse.Namespace) -> None:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    apply_schema(engine)
    if args.latest_year:
        available_years = [
            year for year in (resource_year(resource) for resource in bikeshare_resources()) if year
        ]
        years = [max(available_years)]
    else:
        years = [int(year) for year in args.years.split(",")] if args.years else None
    results = ingest_bikeshare(
        engine,
        years=years,
        force_download=args.force_download,
        chunksize=args.chunksize,
    )
    if args.strict:
        failures = {
            key: value
            for key, value in results["validation"].items()
            if key
            in {
                "nonpositive_duration_rows",
                "zero_coordinate_rows",
                "duplicate_trip_ids",
            }
            and value != 0
        }
        if failures:
            raise RuntimeError(f"Bike Share validation failed: {failures}")
    print(json.dumps(results, indent=2, sort_keys=True))


def cmd_validate_bikeshare(_: argparse.Namespace) -> None:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    print(json.dumps(validate_bikeshare(engine), indent=2, sort_keys=True))


def cmd_build_equity(args: argparse.Namespace) -> None:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    apply_schema(engine)
    results = build_equity_scores(engine, force_download=args.force_download)
    validation = validate_equity_scores(engine)
    print(json.dumps({"summary": results, "validation": validation}, indent=2, sort_keys=True))


def cmd_validate_equity(_: argparse.Namespace) -> None:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    print(json.dumps(validate_equity_scores(engine), indent=2, sort_keys=True))


def cmd_train_prediction_model(args: argparse.Namespace) -> None:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    apply_schema(engine)
    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = Path(__file__).resolve().parents[2] / output_path
    print(json.dumps(train_ridership_model(engine, output_path), indent=2, sort_keys=True))


def cmd_build_transit_graph(args: argparse.Namespace) -> None:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    apply_schema(engine)
    results = build_transit_graph_tables(
        engine,
        transfer_radius_m=args.transfer_radius_m,
        walking_mps=args.walking_mps,
        od_limit=args.od_limit,
    )
    validation = validate_transit_graph(engine)
    print(json.dumps({"summary": results, "validation": validation}, indent=2, sort_keys=True))


def cmd_validate_transit_graph(_: argparse.Namespace) -> None:
    settings = load_settings()
    engine = make_engine(settings.database_url)
    print(json.dumps(validate_transit_graph(engine), indent=2, sort_keys=True))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="transitlens-gtfs")
    subparsers = parser.add_subparsers(required=True)

    init_db = subparsers.add_parser("init-db")
    init_db.set_defaults(func=cmd_init_db)

    download = subparsers.add_parser("download")
    download.add_argument("--force", action="store_true")
    download.set_defaults(func=cmd_download)

    ingest = subparsers.add_parser("ingest")
    ingest.add_argument("--download", action="store_true", help="Download before ingesting.")
    ingest.add_argument("--force-download", action="store_true")
    ingest.add_argument("--chunksize", type=int, default=100_000)
    ingest.add_argument("--strict", action="store_true", help="Fail on validation errors.")
    ingest.set_defaults(func=cmd_ingest)

    validate = subparsers.add_parser("validate")
    validate.set_defaults(func=cmd_validate)

    ingest_riders = subparsers.add_parser("ingest-ridership")
    ingest_riders.add_argument("--force-download", action="store_true")
    ingest_riders.add_argument("--strict", action="store_true")
    ingest_riders.set_defaults(func=cmd_ingest_ridership)

    validate_riders = subparsers.add_parser("validate-ridership")
    validate_riders.set_defaults(func=cmd_validate_ridership)

    ingest_bikes = subparsers.add_parser("ingest-bikeshare")
    ingest_bikes.add_argument("--years", help="Comma-separated years to ingest, for example 2024,2025,2026.")
    ingest_bikes.add_argument("--latest-year", action="store_true", help="Ingest only the latest available annual resource.")
    ingest_bikes.add_argument("--force-download", action="store_true")
    ingest_bikes.add_argument("--chunksize", type=int, default=100_000)
    ingest_bikes.add_argument("--strict", action="store_true")
    ingest_bikes.set_defaults(func=cmd_ingest_bikeshare)

    validate_bikes = subparsers.add_parser("validate-bikeshare")
    validate_bikes.set_defaults(func=cmd_validate_bikeshare)

    build_equity = subparsers.add_parser("build-equity")
    build_equity.add_argument("--force-download", action="store_true")
    build_equity.set_defaults(func=cmd_build_equity)

    validate_equity = subparsers.add_parser("validate-equity")
    validate_equity.set_defaults(func=cmd_validate_equity)

    train_model = subparsers.add_parser("train-prediction-model")
    train_model.add_argument(
        "--output",
        default="backend/models/ridership_model.joblib",
        help="Output joblib model path.",
    )
    train_model.set_defaults(func=cmd_train_prediction_model)

    graph = subparsers.add_parser("build-transit-graph")
    graph.add_argument("--transfer-radius-m", type=int, default=250)
    graph.add_argument("--walking-mps", type=float, default=1.3)
    graph.add_argument("--od-limit", type=int, default=35)
    graph.set_defaults(func=cmd_build_transit_graph)

    validate_graph = subparsers.add_parser("validate-transit-graph")
    validate_graph.set_defaults(func=cmd_validate_transit_graph)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
