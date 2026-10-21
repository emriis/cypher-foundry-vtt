"""PR4 OOXML callout extraction must preserve paragraph indexes and visual evidence."""
import json
import runpy
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

RUNNER = Path(__file__).resolve().parents[2] / "scripts/crd-audit/read-callouts.py"
EXTRACT = runpy.run_path(str(RUNNER))["extract"]
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def paragraph(text, style="", box=False):
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/>' if style or box else ""
    if box:
        ppr += '<w:pBdr><w:bottom w:val="single"/></w:pBdr>'
    if style or box:
        ppr += "</w:pPr>"
    return f"<w:p>{ppr}<w:r><w:t>{text}</w:t></w:r></w:p>"


class WordCalloutTests(unittest.TestCase):
    def test_label_style_box_and_tables_have_stable_provenance(self):
        styles = f'''<w:styles xmlns:w="{W}">
          <w:style w:type="paragraph" w:styleId="Sidebar">
            <w:name w:val="Sidebar box"/>
            <w:pPr><w:shd w:fill="CCCCCC"/></w:pPr>
          </w:style>
        </w:styles>'''
        body = (
            paragraph("Skills", "Heading1") +
            paragraph("GM intrusions: The sentry discovers your plans.") +
            paragraph("This is a boxed rule exception.", "Sidebar") +
            paragraph("A second boxed line.", "Sidebar") +
            "<w:tbl><w:tr><w:tc>" + paragraph("Table rule") + "</w:tc></w:tr></w:tbl>" +
            paragraph("A regular paragraph.")
        )
        xml = f'<w:document xmlns:w="{W}"><w:body>{body}</w:body></w:document>'
        with tempfile.TemporaryDirectory() as temp:
            docx = Path(temp) / "sample.docx"
            with ZipFile(docx, "w") as archive:
                archive.writestr("word/document.xml", xml)
                archive.writestr("word/styles.xml", styles)
            result = EXTRACT(docx)
        self.assertEqual(result["paragraphs"], 6)
        self.assertEqual(len(result["tables"]), 1)
        self.assertEqual(result["tables"][0]["paragraphStart"], 4)
        c = result["candidates"]
        self.assertEqual([x["paragraph"] for x in c], [1, 2, 3])
        self.assertEqual(c[0]["kind"], "gm-intrusion")
        self.assertEqual(c[0]["section"], "Skills")
        self.assertEqual(c[1]["kind"], "visually-marked")
        self.assertIn("style-box", c[1]["signals"])
        self.assertIn("callout-style", c[2]["signals"])
        self.assertEqual(result["candidateTypes"]["visually-marked"], 2)


if __name__ == "__main__":
    unittest.main()
