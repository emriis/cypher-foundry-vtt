"""Read a private CRD without copying its archive or changing local references.

This optional local-audit adapter uses Python's standard XML/ZIP libraries.
It emits paragraphs, table cells, and section locators to the Node auditor;
runtime code and CI do not depend on Python or the private document.
"""

import json
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}
TAG = "{" + WORD_NS + "}"


def paragraph_text(paragraph):
    """Preserve punctuation and treat Word line breaks/tabs as whitespace."""
    return "".join(
        node.text or "" if node.tag == TAG + "t" else " "
        for node in paragraph.iter()
        if node.tag in {TAG + "t", TAG + "br", TAG + "tab"}
    )


def read_reference(file_path):
    with ZipFile(file_path) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
    body = document.find("w:body", NS)
    if body is None:
        raise ValueError("The CRD document has no Word body")

    paragraphs = []
    sections = {}
    # Cell membership helps distinguish a table note from the following Item.
    cells = {
        id(paragraph): [table_index, row_index, cell_index]
        for table_index, table in enumerate(body.findall(".//w:tbl", NS))
        for row_index, row in enumerate(table.findall("w:tr", NS))
        for cell_index, cell in enumerate(row.findall("w:tc", NS))
        for paragraph in cell.findall(".//w:p", NS)
    }
    for index, paragraph in enumerate(body.findall(".//w:p", NS)):
        text = paragraph_text(paragraph)
        style_node = paragraph.find("w:pPr/w:pStyle", NS)
        style = style_node.get(TAG + "val", "") if style_node is not None else ""
        if style.startswith("Heading") and style[-1:].isdigit():
            level = int(style[-1])
            sections = {key: value for key, value in sections.items() if key < level}
            sections[level] = text
        paragraphs.append({
            "index": index,
            "text": text,
            "style": style,
            "section": " / ".join(sections.values()),
            "cell": cells.get(id(paragraph)),
            "leadingLabel": "".join(
                paragraph_text(run)
                for run in paragraph.findall("w:r", NS)
                if run.find("w:rPr/w:b", NS) is not None
                or run.find("w:rPr/w:i", NS) is not None
            ).split(":", 1)[0],
        })
    return {"version": "2026-07-29", "paragraphs": paragraphs}


if __name__ == "__main__":
    # ASCII JSON survives Windows pipe encodings without changing CRD Unicode.
    print(json.dumps(read_reference(sys.argv[1]), ensure_ascii=True))
