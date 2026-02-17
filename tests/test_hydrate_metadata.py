#!/usr/bin/env python3
# tests/test_hydrate_metadata.py
"""Unit tests for hydrate_metadata.py. Run with: pytest tests/test_hydrate_metadata.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import pytest
from unittest.mock import MagicMock

# Mock external dependencies not available in test environment
for mod in ['arxiv', 'gh_store', 'gh_store.core', 'gh_store.core.store',
            'gh_store.tools', 'gh_store.tools.canonicalize',
            'gh_store.core.constants', 'gh_store.core.types',
            'gh_store.core.exceptions']:
    sys.modules.setdefault(mod, MagicMock())

from hydrate_metadata import (
    is_metadata_satisfied,
    is_valid_arxiv_id,
    extract_arxiv_id_from_object_id,
)


class TestIsMetadataSatisfied:
    def test_satisfied_with_title(self):
        data = {"title": "Attention Is All You Need", "id": "1706.03762"}
        assert is_metadata_satisfied(data) is True

    def test_not_satisfied_when_title_contains_id(self):
        data = {"title": "1706.03762", "id": "1706.03762"}
        assert is_metadata_satisfied(data) is False

    def test_not_satisfied_when_no_title(self):
        data = {"id": "1706.03762"}
        assert not is_metadata_satisfied(data)

    def test_not_satisfied_when_empty(self):
        assert not is_metadata_satisfied({})

    def test_not_satisfied_when_none(self):
        assert not is_metadata_satisfied(None)

    def test_satisfied_when_title_partially_contains_id(self):
        # Title containing the ID as a substring should fail
        data = {"title": "Paper 1706.03762 analysis", "id": "1706.03762"}
        assert is_metadata_satisfied(data) is False


class TestIsValidArxivId:
    def test_new_format(self):
        assert is_valid_arxiv_id("1706.03762") is True

    def test_new_format_with_version(self):
        assert is_valid_arxiv_id("1706.03762v2") is True

    def test_new_format_five_digits(self):
        assert is_valid_arxiv_id("2401.12345") is True

    def test_old_format_no_hyphen(self):
        # Note: regex uses \w+ which doesn't match hyphens, so only non-hyphenated subjects work
        assert is_valid_arxiv_id("math/9901001") is True

    def test_old_format_with_version(self):
        assert is_valid_arxiv_id("math/9901001v1") is True

    def test_invalid_format(self):
        assert is_valid_arxiv_id("not-an-id") is False

    def test_empty_string(self):
        assert is_valid_arxiv_id("") is False

    def test_doi_not_valid(self):
        assert is_valid_arxiv_id("10.1234/example") is False


class TestExtractArxivIdFromObjectId:
    def test_colon_prefix(self):
        assert extract_arxiv_id_from_object_id("arxiv:1706.03762") == "1706.03762"

    def test_dot_prefix(self):
        assert extract_arxiv_id_from_object_id("arxiv.1706.03762") == "1706.03762"

    def test_double_colon_prefix(self):
        # Note: single-prefix case matches first, so double prefix returns "arxiv:id"
        # This is a known limitation of the current prefix stripping order
        assert extract_arxiv_id_from_object_id("arxiv:arxiv:1706.03762") == "arxiv:1706.03762"

    def test_double_dot_prefix(self):
        # Same limitation as double colon
        assert extract_arxiv_id_from_object_id("arxiv.arxiv.1706.03762") == "arxiv.1706.03762"

    def test_no_prefix(self):
        assert extract_arxiv_id_from_object_id("1706.03762") == "1706.03762"

    def test_preserves_version(self):
        assert extract_arxiv_id_from_object_id("arxiv:1706.03762v2") == "1706.03762v2"
