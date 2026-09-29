"""Text helpers shared by translation memory, tutor retrieval and speech scoring."""
import hashlib
import math
import unicodedata
from collections import Counter


def normalize(text: str) -> str:
    """Lower-case, strip punctuation/symbols but keep combining marks (matras) intact,
    so Devanagari / Bengali / Odia / Ol Chiki words are not split."""
    out = []
    for ch in text.lower():
        cat = unicodedata.category(ch)[0]
        out.append(" " if cat in ("P", "S") else ch)
    return " ".join("".join(out).split())


def text_hash(text: str) -> str:
    return hashlib.sha1(normalize(text).encode("utf-8")).hexdigest()


def features(text: str) -> Counter:
    """Word + character-trigram bag: works well for short sentences in any script."""
    n = normalize(text)
    f: Counter = Counter()
    for w in n.split():
        f["w:" + w] += 1.0
    padded = f" {n} "
    for i in range(len(padded) - 2):
        f["c:" + padded[i : i + 3]] += 0.4
    return f


class SimilarityIndex:
    """Tiny TF-IDF cosine index. Fine for thousands of rows; swap for pgvector /
    FAISS + a multilingual sentence encoder (LaBSE, IndicSBERT) at scale."""

    def __init__(self, texts: list[str]):
        self.docs = [features(t) for t in texts]
        df: Counter = Counter()
        for d in self.docs:
            df.update(d.keys())
        n = max(len(self.docs), 1)
        self.idf = {k: math.log((1 + n) / (1 + v)) + 1 for k, v in df.items()}
        self.vecs = [self._vec(d) for d in self.docs]

    def _vec(self, feats: Counter) -> dict:
        v = {k: c * self.idf.get(k, 1.0) for k, c in feats.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {k: x / norm for k, x in v.items()}

    def query(self, text: str, k: int = 3) -> list[tuple[int, float]]:
        q = self._vec(features(text))
        scored = []
        for i, vec in enumerate(self.vecs):
            small, big = (q, vec) if len(q) < len(vec) else (vec, q)
            s = sum(x * big.get(key, 0.0) for key, x in small.items())
            scored.append((i, s))
        scored.sort(key=lambda p: p[1], reverse=True)
        return scored[:k]
