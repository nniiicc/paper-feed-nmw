#!/usr/bin/env python3
# tests/test_canonical_ids.py
"""
Test canonical ID extraction logic. Run with: pytest tests/test_canonical_ids.py
Production code is in scripts/zotero_sync.py
"""

import re
import hashlib
import pytest


# Local implementations matching zotero_sync.py for standalone testing
def extract_arxiv_id(data: dict) -> str | None:
    url = data.get('url', '') or ''
    arxiv_patterns = [
        r'arxiv\.org/abs/(\d{4}\.\d{4,5})',
        r'arxiv\.org/pdf/(\d{4}\.\d{4,5})',
        r'arxiv:(\d{4}\.\d{4,5})',
    ]
    for pattern in arxiv_patterns:
        match = re.search(pattern, url, re.IGNORECASE)
        if match:
            return match.group(1).split('v')[0]
    extra = data.get('extra', '') or ''
    match = re.search(r'arXiv[:\s]+(\d{4}\.\d{4,5})', extra, re.IGNORECASE)
    if match:
        return match.group(1).split('v')[0]
    return None


def normalize_doi(doi: str) -> str | None:
    if not doi:
        return None
    doi = doi.strip().lower()
    doi = re.sub(r'^https?://(dx\.)?doi\.org/', '', doi)
    if doi.startswith('doi:'):
        doi = doi[4:]
    return doi if doi else None


def generate_title_hash(title: str, first_author: str) -> str:
    normalized = f"{title.lower().strip()}|{first_author.lower().strip()}"
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


def get_canonical_id(paper_data: dict) -> tuple[str, str]:
    arxiv_id = paper_data.get('arxivId') or extract_arxiv_id(paper_data)
    if arxiv_id:
        return ('arxiv', arxiv_id)
    doi = normalize_doi(paper_data.get('doi') or paper_data.get('DOI', ''))
    if doi:
        return ('doi', doi)
    title = paper_data.get('title', '')
    authors = paper_data.get('authors', [])
    first_author = ''
    if authors:
        if isinstance(authors[0], dict):
            first_author = authors[0].get('lastName', '')
        else:
            first_author = str(authors[0]).split()[-1]
    if title:
        return ('hash', generate_title_hash(title, first_author))
    return ('key', paper_data.get('key', 'unknown'))


class TestArxivExtraction:
    def test_from_abs_url(self):
        data = {"url": "https://arxiv.org/abs/1706.03762", "authors": ["Vaswani"]}
        assert extract_arxiv_id(data) == "1706.03762"

    def test_from_pdf_url(self):
        data = {"url": "https://arxiv.org/pdf/1706.03762"}
        assert extract_arxiv_id(data) == "1706.03762"

    def test_from_extra_field(self):
        data = {"url": "", "extra": "arXiv: 1706.03762 [cs.CL]"}
        assert extract_arxiv_id(data) == "1706.03762"

    def test_strips_version(self):
        data = {"url": "https://arxiv.org/abs/1706.03762v3"}
        assert extract_arxiv_id(data) == "1706.03762"

    def test_no_arxiv_returns_none(self):
        data = {"url": "https://example.com", "extra": ""}
        assert extract_arxiv_id(data) is None


class TestDoiNormalization:
    def test_strips_doi_org_prefix(self):
        assert normalize_doi("https://doi.org/10.1234/example") == "10.1234/example"

    def test_strips_dx_doi_org_prefix(self):
        assert normalize_doi("https://dx.doi.org/10.1234/example") == "10.1234/example"

    def test_strips_doi_prefix(self):
        assert normalize_doi("doi:10.1234/example") == "10.1234/example"

    def test_lowercases(self):
        assert normalize_doi("10.1234/EXAMPLE") == "10.1234/example"

    def test_empty_returns_none(self):
        assert normalize_doi("") is None
        assert normalize_doi(None) is None


class TestCanonicalId:
    def test_prefers_arxiv(self):
        data = {"arxivId": "1706.03762", "doi": "10.1234/x", "title": "T", "authors": ["A"]}
        id_type, id_value = get_canonical_id(data)
        assert id_type == "arxiv"
        assert id_value == "1706.03762"

    def test_uses_doi_when_no_arxiv(self):
        data = {"DOI": "10.1234/example.2024.001", "title": "T", "authors": [{"lastName": "Smith"}]}
        id_type, _ = get_canonical_id(data)
        assert id_type == "doi"

    def test_falls_back_to_hash(self):
        data = {"title": "A Paper Without DOI or ArXiv", "authors": ["Alice Johnson"]}
        id_type, id_value = get_canonical_id(data)
        assert id_type == "hash"
        assert len(id_value) == 16

    def test_same_paper_different_sources_match(self):
        """Papers from URL vs extra field produce the same canonical ID."""
        paper_url = {"url": "https://arxiv.org/abs/1706.03762", "title": "T"}
        paper_extra = {"url": "", "extra": "arXiv: 1706.03762 [cs.CL]", "title": "T"}
        _, id1 = get_canonical_id(paper_url)
        _, id2 = get_canonical_id(paper_extra)
        assert id1 == id2

    def test_title_hash_case_insensitive(self):
        data1 = {"title": "A Paper Without DOI or ArXiv", "authors": ["Alice Johnson"]}
        data2 = {"title": "A Paper Without DOI or Arxiv", "authors": ["Alice Johnson"]}
        _, hash1 = get_canonical_id(data1)
        _, hash2 = get_canonical_id(data2)
        assert hash1 == hash2

    def test_dict_and_string_authors_match(self):
        data1 = {"title": "Test", "authors": [{"firstName": "John", "lastName": "Doe"}]}
        data2 = {"title": "Test", "authors": ["John Doe"]}
        _, hash1 = get_canonical_id(data1)
        _, hash2 = get_canonical_id(data2)
        assert hash1 == hash2
