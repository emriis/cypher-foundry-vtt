"""Extract reproducible structural callout candidates from the supplied CRD DOCX.

Read-only, standard-library OOXML parser. A visual/sidebar label is a *candidate*,
not proof that an English pack should repeat a shared rule. The full raw source
is never embedded in the report; paragraph indexes match read-docx.py.
"""
import argparse
import collections
import hashlib
import json
import re
import runpy
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
N = {"w": W}
TAG = "{" + W + "}"

LABELS = (
    (re.compile(r"^\s*GM intrusions?\s*:", re.I), "gm-intrusion"),
    (re.compile(r"^\s*Genre themes?\s*:", re.I), "genre-themes"),
    (re.compile(r"^\s*(?:Example|Examples|For example)\s*:", re.I), "example"),
    (re.compile(r"^\s*(?:Note|Notes|Important|Remember|Tip|Tips)\s*:", re.I), "clarification"),
    (re.compile(r"^\s*(?:GM tips?|GM advice|GM guidance|Player advice)\s*:", re.I), "advice"),
)
VISUAL_STYLE = re.compile(r"callout|sidebar|side-bar|note|box|example|caption|quote", re.I)


def style_info(archive):
    if "word/styles.xml" not in archive.namelist():
        return {}
    tree = ET.fromstring(archive.read("word/styles.xml"))
    info = {}
    for node in tree.findall("w:style", N):
        name = node.find("w:name", N)
        based = node.find("w:basedOn", N)
        ppr = node.find("w:pPr", N)
        info[node.get(TAG + "styleId")] = {
            "name": (name.get(TAG + "val") if name is not None else "") or "",
            "based": (based.get(TAG + "val") if based is not None else "") or "",
            "boxed": ppr is not None and any(ppr.find("w:" + k, N) is not None
                for k in ("pBdr", "shd", "framePr")),
        }
    return info


def style_signals(style, styles):
    result = set()
    seen = set()
    while style and style not in seen:
        seen.add(style)
        meta = styles.get(style, {})
        if VISUAL_STYLE.search(style + " " + meta.get("name", "")):
            result.add("callout-style")
        if meta.get("boxed"):
            result.add("style-box")
        style = meta.get("based", "")
    return result


def ancestor_signals(element, parent):
    signals = set()
    current = element
    while current in parent:
        current = parent[current]
        if current.tag == TAG + "txbxContent":
            signals.add("textbox")
        if current.tag == TAG + "tc":
            signals.add("table-cell")
        if current.tag == TAG + "sdt":
            signals.add("content-control")
    return signals


def classify(text, signals):
    for matcher, kind in LABELS:
        if matcher.search(text):
            return kind
    if "textbox" in signals:
        return "textbox"
    if "callout-style" in signals or "style-box" in signals or "paragraph-box" in signals:
        return "visually-marked"
    return None


def extract(reference):
    path = Path(reference)
    original = runpy.run_path(str(Path(__file__).with_name("read-docx.py")))["read_reference"](str(path))
    with ZipFile(path) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
        styles = style_info(archive)
    body = document.find("w:body", N)
    paragraphs = body.findall(".//w:p", N)
    parent = {child: node for node in body.iter() for child in node}
    assert len(paragraphs) == len(original["paragraphs"]), "Word paragraph indexes changed"

    candidates = []
    styles_seen = collections.Counter()
    signals_seen = collections.Counter()
    type_seen = collections.Counter()
    tables = []
    for number, table in enumerate(body.findall(".//w:tbl", N)):
        content = [item for item in original["paragraphs"] if item["cell"] is not None and item["cell"][0] == number]
        tables.append({
            "table": number,
            "paragraphStart": content[0]["index"] if content else None,
            "paragraphEnd": content[-1]["index"] if content else None,
            "paragraphs": len(content),
            "firstCellExcerpt": content[0]["text"][:100] if content else "",
            "section": content[0]["section"] if content else "",
        })
    for entry, element in zip(original["paragraphs"], paragraphs):
        text = entry["text"].strip()
        if not text:
            continue
        style = entry["style"]
        styles_seen[style or "(default)"] += 1
        ppr = element.find("w:pPr", N)
        signals = style_signals(style, styles)
        if ppr is not None and any(ppr.find("w:" + k, N) is not None
            for k in ("pBdr", "shd", "framePr")):
            signals.add("paragraph-box")
        signals.update(ancestor_signals(element, parent))
        for signal in signals:
            signals_seen[signal] += 1
        kind = classify(text, signals)
        if not kind:
            continue
        type_seen[kind] += 1
        candidates.append({
            "paragraph": entry["index"],
            "section": entry["section"],
            "style": style,
            "cell": entry["cell"],
            "kind": kind,
            "signals": sorted(signals),
            "label": (entry["leadingLabel"] or "")[:90],
            "excerpt": text[:140],
            "textSha256": hashlib.sha256(" ".join(text.split()).encode()).hexdigest(),
        })
    return {
        "schemaVersion": 1,
        "referenceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "paragraphs": len(paragraphs),
        "paragraphStyles": dict(styles_seen.most_common()),
        "visualSignals": dict(signals_seen.most_common()),
        "candidateTypes": dict(type_seen.most_common()),
        "tables": tables,
        "candidates": candidates,
        "policy": "Candidate detection only; coverage decisions require exact source-backed evidence.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("reference")
    args = parser.parse_args()
    print(json.dumps(extract(args.reference), ensure_ascii=True))
