#!/usr/bin/env python3
"""Minimal example for the OpenAI Codex Python SDK."""

from __future__ import annotations

import argparse
import sys
from typing import Any


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a prompt with the OpenAI Codex Python SDK")
    parser.add_argument(
        "--prompt",
        default="Explain this repository in three bullets.",
        help="Prompt to send to the Codex thread",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the prompt and exit without contacting Codex",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="Authenticate with a Codex API key instead of browser login",
    )
    parser.add_argument(
        "--auth-only",
        action="store_true",
        help="Authenticate and exit without sending a prompt",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        from openai_codex import Codex
    except ImportError as exc:  # pragma: no cover - exercised in environments without the dependency
        print(
            "The openai-codex package is not installed. Run: python3 -m pip install -r requirements.txt",
            file=sys.stderr,
        )
        return 2

    if args.dry_run:
        print("Dry run enabled. The SDK would run this prompt:")
        print(args.prompt)
        print("\nRemove --dry-run to execute it when Codex authentication is available.")
        return 0

    with Codex() as codex:
        if args.api_key:
            try:
                codex.login_api_key(args.api_key)
            except Exception as exc:  # pragma: no cover - exercised when the key is invalid
                print(f"API-key authentication failed: {exc}", file=sys.stderr)
                return 4
        elif args.auth_only:
            print("Authentication requested. The SDK is ready to use the configured auth flow.")
            return 0

        if args.auth_only:
            print("Authentication completed. You can now run the example without --auth-only.")
            return 0

        try:
            thread = codex.thread_start()
            result = thread.run(args.prompt)
        except RuntimeError as exc:
            error_message = str(exc)
            if "401" in error_message or "Unauthorized" in error_message or "authentication" in error_message.lower():
                print(
                    "Authentication failed. Please sign in with Codex before running this example.",
                    file=sys.stderr,
                )
                print(
                    "Examples: python3 -m pip install -r examples/codex-python/requirements.txt",
                    file=sys.stderr,
                )
                print(
                    "Then authenticate with the Codex SDK or set your API key before retrying.",
                    file=sys.stderr,
                )
                return 3
            raise

        if getattr(result, "final_response", None):
            print(result.final_response)
        else:
            print("No final response was produced.")

        collected_items = getattr(result, "collected_items", None)
        if collected_items:
            print("\nCollected items:")
            for item in collected_items:
                print(f"- {item}")

        usage = getattr(result, "usage", None) or getattr(result, "token_usage", None)
        if usage is not None:
            print(f"\nUsage: {usage}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
