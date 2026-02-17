#!/usr/bin/env python3
# tests/test_process_pdf.py
"""Unit tests for process_pdf.py. Run with: pytest tests/test_process_pdf.py"""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import pytest

# process_pdf.py imports llamero which may not be installed locally.
# Mock it before importing the module under test.
from unittest.mock import MagicMock
sys.modules.setdefault('llamero', MagicMock())
sys.modules.setdefault('llamero.utils', MagicMock())

from process_pdf import (
    remove_extra_whitespace,
    remove_gibberish,
    sanitize_markdown,
    get_feature_path,
)


class TestRemoveExtraWhitespace:
    def test_collapses_triple_newlines(self):
        text = "hello\n\n\nworld"
        assert remove_extra_whitespace(text) == "hello\n\nworld"

    def test_collapses_many_newlines(self):
        text = "hello\n\n\n\n\n\nworld"
        assert remove_extra_whitespace(text) == "hello\n\nworld"

    def test_preserves_double_newlines(self):
        text = "hello\n\nworld"
        assert remove_extra_whitespace(text) == "hello\n\nworld"

    def test_preserves_single_newlines(self):
        text = "hello\nworld"
        assert remove_extra_whitespace(text) == "hello\nworld"

    def test_empty_string(self):
        assert remove_extra_whitespace("") == ""


class TestRemoveGibberish:
    def test_normal_text_preserved(self):
        text = "This is a normal sentence about machine learning."
        assert remove_gibberish(text) == text

    def test_removes_texitsha1_lines(self):
        text = "Good line\ntexitsha1_base64baddata\nAnother good line"
        result = remove_gibberish(text)
        assert "texitsha1_base64" not in result
        assert "Good line" in result
        assert "Another good line" in result

    def test_removes_texit_lines(self):
        text = "Good line\nsome texit> junk\nAnother good line"
        result = remove_gibberish(text)
        assert "texit>" not in result

    def test_preserves_short_lines(self):
        # Short lines should not be removed even with unusual sparsity
        text = "a b c d e"
        assert remove_gibberish(text) == text

    def test_empty_string(self):
        assert remove_gibberish("") == ""

    def test_multiline_output(self):
        lines = ["Line one.", "Line two.", "Line three."]
        text = "\n".join(lines)
        result = remove_gibberish(text)
        assert result == text


class TestSanitizeMarkdown:
    def test_combined_cleanup(self):
        text = "Hello\n\n\n\nWorld\ntexitsha1_base64junk\nEnd"
        result = sanitize_markdown(text)
        assert "texitsha1_base64" not in result
        assert "\n\n\n" not in result
        assert "Hello" in result
        assert "End" in result


class TestGetFeaturePath:
    def test_creates_directory_and_returns_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            result = get_feature_path(base, "markdown-grobid", "paper123", ".md")
            assert result == base / "features" / "markdown-grobid" / "paper123.md"
            assert result.parent.exists()

    def test_different_feature_types(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            md_path = get_feature_path(base, "markdown-grobid", "paper1", ".md")
            tei_path = get_feature_path(base, "tei-xml-grobid", "paper1", ".xml")
            assert md_path.parent != tei_path.parent
            assert md_path.suffix == ".md"
            assert tei_path.suffix == ".xml"

    def test_idempotent_directory_creation(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            # Call twice - should not error
            get_feature_path(base, "markdown-grobid", "paper1", ".md")
            get_feature_path(base, "markdown-grobid", "paper2", ".md")
