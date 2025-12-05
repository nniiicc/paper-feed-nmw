#!/usr/bin/env python3
"""
Import papers from browser history JSON into gh-store as GitHub Issues.

The original visit timestamp is preserved in the 'timestamp' field of the paper data,
even though the GitHub Issue created_at will be the current time.

Usage:
    python scripts/import_browser_history.py \
        --history-file data.json \
        --token $GITHUB_TOKEN \
        --repo nniiicc/paper-feed-nmw \
        --dry-run  # Remove to actually create issues

    # To limit the number of papers:
    python scripts/import_browser_history.py \
        --history-file data.json \
        --token $GITHUB_TOKEN \
        --repo nniiicc/paper-feed-nmw \
        --limit 10
"""

import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any, Callable

import fire
from loguru import logger
from github import GithubException

from gh_store.core.store import GitHubStore
from gh_store.core.exceptions import DuplicateUIDError

# GitHub label limit is 50 chars. UID prefix is "UID:paper:" (10 chars), leaving 40 for source.id
MAX_OBJECT_ID_LENGTH = 40


# URL patterns to extract paper IDs from various academic sources
PATTERNS: dict[str, tuple[str, Callable]] = {
    'arxiv': (r'arxiv\.org/(abs|pdf)/(\d+\.\d+)', lambda m: m.group(2)),
    'nature': (r'nature\.com/articles/([a-zA-Z0-9\-]+)', lambda m: m.group(1)),
    'tandfonline': (r'tandfonline\.com/doi/(abs|full|pdf)/([^\s?#]+)', lambda m: m.group(2)),
    'springer': (r'link\.springer\.com/article/([^\s?#]+)', lambda m: m.group(1)),
    'sciencedirect': (r'sciencedirect\.com/science/article/(abs/)?pii/([A-Z0-9]+)', lambda m: m.group(2)),
    'wiley': (r'onlinelibrary\.wiley\.com/doi/(abs|full|pdf)/([^\s?#]+)', lambda m: m.group(2)),
    'acm': (r'dl\.acm\.org/doi/(abs|pdf)/([^\s?#]+)', lambda m: m.group(2)),
    'ieee': (r'ieeexplore\.ieee\.org/(document|abstract)/(\d+)', lambda m: m.group(2)),
    'plos': (r'journals\.plos\.org/([a-z]+)/article\?id=([^\s&#]+)', lambda m: m.group(2)),
    'biorxiv': (r'(www\.)?(bio|med)rxiv\.org/content/([^\s?]+)', lambda m: m.group(3).replace('/v', '.v').rstrip('/')),
    'ssrn': (r'ssrn\.com/.*abstract_id[=]?(\d+)', lambda m: m.group(1)),
    'pubmed': (r'(pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov/pubmed)/(\d+)', lambda m: m.group(2)),
}


def extract_papers_from_history(history_file: str) -> list[dict[str, Any]]:
    """Extract unique academic papers from browser history JSON."""
    with open(history_file, 'r') as f:
        data = json.load(f)

    papers: dict[str, dict] = {}

    for entry in data:
        url = entry.get('url', '')
        title = entry.get('title', '')
        last_visit = entry.get('lastVisitTime', 0)

        for source, (pattern, id_extractor) in PATTERNS.items():
            match = re.search(pattern, url, re.IGNORECASE)
            if match:
                try:
                    paper_id = id_extractor(match)
                    key = f'{source}:{paper_id}'

                    # Convert timestamp (milliseconds since epoch)
                    visit_dt = datetime.fromtimestamp(last_visit / 1000, tz=timezone.utc) if last_visit else None

                    # Keep the most recent visit and best title
                    if key not in papers or last_visit > papers[key].get('lastVisitTime', 0):
                        existing_title = papers.get(key, {}).get('title')
                        best_title = title if title and (not existing_title or len(title) > len(existing_title)) else existing_title
                        papers[key] = {
                            'sourceId': source,
                            'paperId': paper_id,
                            'title': best_title,
                            'lastVisitTime': last_visit,
                            'timestamp': visit_dt.isoformat() if visit_dt else None,
                        }
                except Exception as e:
                    logger.warning(f"Error extracting paper from {url}: {e}")
                break

    # Convert to list and sort by visit time (oldest first for chronological import)
    paper_list = list(papers.values())
    paper_list.sort(key=lambda x: x.get('lastVisitTime', 0))

    return paper_list


def shorten_id_if_needed(source_id: str, paper_id: str) -> str:
    """Shorten paper ID if it would exceed GitHub's label length limit."""
    full_id = f"{source_id}.{paper_id}"
    if len(full_id) <= MAX_OBJECT_ID_LENGTH:
        return paper_id

    # Use hash to create a shorter unique ID, preserving source prefix
    # Keep first part of ID for readability + hash suffix
    hash_suffix = hashlib.sha256(paper_id.encode()).hexdigest()[:12]
    # Calculate how much of the original ID we can keep
    # source_id + "." + truncated_id + "_" + hash = MAX_OBJECT_ID_LENGTH
    max_prefix_len = MAX_OBJECT_ID_LENGTH - len(source_id) - 1 - 1 - 12
    truncated = paper_id[:max_prefix_len] + "_" + hash_suffix
    return truncated


def create_paper_object(store: GitHubStore, paper: dict, dry_run: bool = True) -> bool:
    """Create a paper object in gh-store."""
    # Shorten ID if needed to fit GitHub's 50-char label limit
    shortened_paper_id = shorten_id_if_needed(paper['sourceId'], paper['paperId'])
    object_id = f"paper:{paper['sourceId']}.{shortened_paper_id}"

    # Build the paper data matching the existing format
    # Always store the original (full) paper ID in the data
    paper_data = {
        'sourceId': paper['sourceId'],
        'paperId': paper['paperId'],  # Original full ID
        'timestamp': paper['timestamp'],  # Original visit date
        'rating': 'novote',
        'tags': [],
        'sourceType': 'browser_history',
    }

    # Add title if we have one (will be enriched later by hydrate_metadata)
    if paper.get('title'):
        # Clean up common title suffixes
        title = paper['title']
        for suffix in [' - ScienceDirect', ' | Nature', ' | Scientific Data',
                       ' - Wiley Online Library', ' | IEEE Xplore', ' :: SSRN']:
            if title.endswith(suffix):
                title = title[:-len(suffix)]
        paper_data['title'] = title

    if dry_run:
        logger.info(f"[DRY RUN] Would create: {object_id}")
        logger.debug(f"  Data: {json.dumps(paper_data, indent=2)}")
        return True

    # Retry logic for transient errors (like label race conditions)
    max_retries = 5
    for attempt in range(max_retries):
        try:
            store.create(object_id=object_id, data=paper_data, extra_labels=["TODO:hydrate-metadata"])
            logger.info(f"Created: {object_id}")
            return True
        except DuplicateUIDError:
            logger.warning(f"Skipping duplicate: {object_id}")
            return False
        except GithubException as e:
            # Handle label already_exists race condition (422 validation error)
            if e.status == 422:
                error_str = str(e)
                if "already_exists" in error_str:
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 1.0
                        logger.warning(f"Label already exists (race condition), retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                        continue
                    else:
                        # On final attempt, the label exists - try one more create
                        # (the label existing shouldn't block issue creation)
                        logger.warning(f"Label exists after {max_retries} attempts, trying final create...")
                        try:
                            store.create(object_id=object_id, data=paper_data, extra_labels=["TODO:hydrate-metadata"])
                            logger.info(f"Created: {object_id}")
                            return True
                        except DuplicateUIDError:
                            logger.warning(f"Skipping duplicate: {object_id}")
                            return False
                        except Exception:
                            pass
            logger.error(f"Error creating {object_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error creating {object_id}: {e}")
            return False

    return False


def import_history(
    history_file: str,
    token: str,
    repo: str,
    dry_run: bool = True,
    limit: int | None = None,
    offset: int = 0,
):
    """
    Import papers from browser history into gh-store.

    Args:
        history_file: Path to the browser history JSON file
        token: GitHub personal access token
        repo: GitHub repository (owner/repo)
        dry_run: If True, only print what would be created
        limit: Maximum number of papers to import (None for all)
        offset: Number of papers to skip from the beginning
    """
    logger.info(f"Loading browser history from {history_file}")
    papers = extract_papers_from_history(history_file)
    logger.info(f"Found {len(papers)} unique papers")

    # Apply offset and limit
    if offset:
        papers = papers[offset:]
        logger.info(f"Skipping first {offset} papers, {len(papers)} remaining")

    if limit:
        papers = papers[:limit]
        logger.info(f"Limiting to {limit} papers")

    if dry_run:
        logger.warning("DRY RUN MODE - No issues will be created")
        store = None
    else:
        store = GitHubStore(token=token, repo=repo, config_path=None)

    created = 0
    skipped = 0
    errors = 0

    for i, paper in enumerate(papers):
        logger.info(f"Processing {i+1}/{len(papers)}: {paper['sourceId']}.{paper['paperId']}")
        result = create_paper_object(store, paper, dry_run=dry_run)
        if result:
            created += 1
        else:
            skipped += 1

        # Small delay between API calls to avoid rate limits and race conditions
        if not dry_run:
            time.sleep(0.3)

    logger.info(f"Done! Created: {created}, Skipped: {skipped}, Errors: {errors}")

    if dry_run:
        logger.warning("This was a dry run. Run with --dry-run=False to create issues.")


if __name__ == "__main__":
    fire.Fire(import_history)
