#!/usr/bin/env python3
# tests/test_import_browser_history.py
"""Unit tests for import_browser_history.py. Run with: pytest tests/test_import_browser_history.py"""

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import pytest
from unittest.mock import MagicMock

# Mock external dependencies not available in test environment
for mod in ['gh_store', 'gh_store.core', 'gh_store.core.store',
            'gh_store.core.exceptions', 'github']:
    sys.modules.setdefault(mod, MagicMock())

from import_browser_history import (
    extract_papers_from_history,
    shorten_id_if_needed,
    PATTERNS,
    MAX_OBJECT_ID_LENGTH,
)


class TestExtractPapersFromHistory:
    def _write_history(self, entries):
        """Write entries to a temp file and return the path."""
        f = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        json.dump(entries, f)
        f.close()
        return f.name

    def test_arxiv_url(self):
        history = [{"url": "https://arxiv.org/abs/2401.12345", "title": "Test Paper", "lastVisitTime": 1000000}]
        papers = extract_papers_from_history(self._write_history(history))
        assert len(papers) == 1
        assert papers[0]["sourceId"] == "arxiv"
        assert papers[0]["paperId"] == "2401.12345"

    def test_arxiv_pdf_url(self):
        history = [{"url": "https://arxiv.org/pdf/2401.12345", "title": "Test", "lastVisitTime": 1000000}]
        papers = extract_papers_from_history(self._write_history(history))
        assert len(papers) == 1
        assert papers[0]["paperId"] == "2401.12345"

    def test_nature_url(self):
        history = [{"url": "https://www.nature.com/articles/s41586-024-07487-w", "title": "Nature Paper", "lastVisitTime": 1000000}]
        papers = extract_papers_from_history(self._write_history(history))
        assert len(papers) == 1
        assert papers[0]["sourceId"] == "nature"
        assert papers[0]["paperId"] == "s41586-024-07487-w"

    def test_biorxiv_url(self):
        history = [{"url": "https://www.biorxiv.org/content/10.1101/2024.01.01.123456v1", "title": "Bio", "lastVisitTime": 1000000}]
        papers = extract_papers_from_history(self._write_history(history))
        assert len(papers) == 1
        assert papers[0]["sourceId"] == "biorxiv"

    def test_deduplicates_by_source_and_id(self):
        history = [
            {"url": "https://arxiv.org/abs/2401.12345", "title": "First visit", "lastVisitTime": 1000000},
            {"url": "https://arxiv.org/abs/2401.12345", "title": "Second visit with better title", "lastVisitTime": 2000000},
        ]
        papers = extract_papers_from_history(self._write_history(history))
        assert len(papers) == 1
        # Should keep the longer (better) title from the most recent visit
        assert papers[0]["title"] == "Second visit with better title"

    def test_empty_history(self):
        papers = extract_papers_from_history(self._write_history([]))
        assert len(papers) == 0

    def test_non_academic_urls_ignored(self):
        history = [
            {"url": "https://google.com", "title": "Google", "lastVisitTime": 1000000},
            {"url": "https://twitter.com/user", "title": "Twitter", "lastVisitTime": 1000000},
        ]
        papers = extract_papers_from_history(self._write_history(history))
        assert len(papers) == 0

    def test_sorted_by_visit_time(self):
        history = [
            {"url": "https://arxiv.org/abs/2401.00002", "title": "Later", "lastVisitTime": 2000000},
            {"url": "https://arxiv.org/abs/2401.00001", "title": "Earlier", "lastVisitTime": 1000000},
        ]
        papers = extract_papers_from_history(self._write_history(history))
        assert papers[0]["paperId"] == "2401.00001"  # Oldest first
        assert papers[1]["paperId"] == "2401.00002"


class TestShortenIdIfNeeded:
    def test_short_id_unchanged(self):
        result = shorten_id_if_needed("arxiv", "2401.12345")
        assert result == "2401.12345"

    def test_long_id_shortened(self):
        long_id = "10.1101/2024.01.01.123456789012345678901234567890"
        result = shorten_id_if_needed("nature", long_id)
        # Result should fit within MAX_OBJECT_ID_LENGTH when combined with source
        full = f"nature.{result}"
        assert len(full) <= MAX_OBJECT_ID_LENGTH
        # Should contain a hash suffix
        assert "_" in result

    def test_shortened_id_is_deterministic(self):
        long_id = "a" * 50
        r1 = shorten_id_if_needed("src", long_id)
        r2 = shorten_id_if_needed("src", long_id)
        assert r1 == r2

    def test_boundary_length_not_shortened(self):
        # Exactly at the limit should not be shortened
        source = "src"
        # source.paper_id should be exactly MAX_OBJECT_ID_LENGTH
        paper_id = "x" * (MAX_OBJECT_ID_LENGTH - len(source) - 1)
        result = shorten_id_if_needed(source, paper_id)
        assert result == paper_id


class TestUrlPatterns:
    """Test that URL patterns correctly extract paper IDs."""

    @pytest.mark.parametrize("url,expected_source", [
        ("https://arxiv.org/abs/2401.12345", "arxiv"),
        ("https://www.nature.com/articles/s41586-024-07487-w", "nature"),
        ("https://www.sciencedirect.com/science/article/pii/S0001234567890", "sciencedirect"),
        ("https://ieeexplore.ieee.org/document/9876543", "ieee"),
        ("https://pubmed.ncbi.nlm.nih.gov/12345678", "pubmed"),
    ])
    def test_pattern_matches_source(self, url, expected_source):
        import re
        matched = False
        for source, (pattern, _) in PATTERNS.items():
            if re.search(pattern, url, re.IGNORECASE):
                assert source == expected_source
                matched = True
                break
        assert matched, f"No pattern matched {url}"
