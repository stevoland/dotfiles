#!/usr/bin/env python3
"""Print candidate UNHINGED_POSTSCRIPT_FRAGMENTS from recent OpenCode reasoning summaries."""

import argparse
import json
import re
import subprocess
import sys
from urllib.parse import urlencode


SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+|(?<=[.!?][\"”’'])\s+")
PAGE_SIZE = 5


def exclamation_fragment(summary: str) -> str | None:
    """Keep an exclamation-ending sentence and its immediate predecessor, if present."""
    sentences = SENTENCE_BREAK.split(re.sub(r"\s+", " ", summary).strip())
    for index, sentence in enumerate(sentences):
        if sentence.rstrip("\"”’'").endswith("!"):
            return " ".join(sentences[max(0, index - 1) : index + 1])
    return None


def reasoning_fragments(message: dict) -> list[str]:
    """Extract one candidate per completed reasoning summary, never from replies or tools."""
    if message.get("type") != "assistant":
        return []
    result = []
    for part in message.get("content", []):
        if part.get("type") != "reasoning":
            continue
        if part.get("time", {}).get("completed") is None and message.get("time", {}).get("completed") is None:
            continue
        fragment = exclamation_fragment(part.get("text", ""))
        if fragment:
            result.append(fragment)
    return result


def api_get(path: str) -> dict:
    response = subprocess.run(["opencode", "api", "get", path], capture_output=True, text=True, check=True)
    return json.loads(response.stdout)


def pages(path: str, *, page_size: int = PAGE_SIZE, message_type: str | None = None):
    cursor = None
    while True:
        query = {"limit": page_size}
        if message_type:
            query["type"] = message_type
        if cursor:
            query["cursor"] = cursor
        try:
            page = api_get(f"{path}?{urlencode(query)}")
        except json.JSONDecodeError:
            if page_size == 1:
                raise
            # Large assistant tool results can make the CLI truncate a page; retry one message at a time.
            page_size = 1
            continue
        items = page["data"]
        if not items:
            return
        yield from items
        cursor = page.get("cursor", {}).get("next")
        if not cursor:
            return


def collect_fragments(*, session_limit: int, fragment_limit: int) -> tuple[list[str], int, int]:
    """Walk recently updated sessions until enough distinct exclamation snippets are found."""
    fragments = []
    seen = set()
    inspected = 0
    skipped = 0
    for session in pages("/api/session"):
        if inspected >= session_limit or len(fragments) >= fragment_limit:
            break
        inspected += 1
        try:
            messages = pages(f"/api/session/{session['id']}/message", message_type="assistant")
            for message in messages:
                for fragment in reasoning_fragments(message):
                    if fragment in seen:
                        continue
                    seen.add(fragment)
                    fragments.append(fragment)
                    if len(fragments) >= fragment_limit:
                        break
                if len(fragments) >= fragment_limit:
                    break
        except (json.JSONDecodeError, subprocess.CalledProcessError, KeyError) as error:
            # The CLI can truncate very large assistant messages. Skip that session, not the whole search.
            skipped += 1
            print(f"Skipping session {session['id']}: {type(error).__name__}", file=sys.stderr)
    return fragments, inspected, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sessions", type=int, default=100, help="recently updated sessions to inspect (default: 100)")
    parser.add_argument("--count", type=int, default=30, help="distinct fragments to extract (default: 30)")
    args = parser.parse_args()
    if args.sessions < 1 or args.count < 1:
        parser.error("--sessions and --count must be positive")

    fragments, inspected, skipped = collect_fragments(session_limit=args.sessions, fragment_limit=args.count)
    print("export const UNHINGED_POSTSCRIPT_FRAGMENTS = [")
    for fragment in fragments:
        print(f"  {json.dumps(fragment, ensure_ascii=False)},")
    print("] as const")
    print(f"Found {len(fragments)}/{args.count} fragments in {inspected} sessions ({skipped} skipped).", file=sys.stderr)
    return 0 if len(fragments) == args.count else 1


if __name__ == "__main__":
    sys.exit(main())
