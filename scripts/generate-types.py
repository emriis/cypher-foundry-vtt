#!/usr/bin/env python3
"""Generate bilingual Type compendium sources from the Reference Document index.

Descriptions are short original summaries; they are not copied from the reference.
"""

import json
import os
import random
import re
import string
import zipfile
import xml.etree.ElementTree as ET

random.seed(20260918)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "packs")

# name_en, name_fr, genre, subgenre, primary stats
TYPES = [
    ("Barbarian", "Barbare", "Fantasy", "Dungeon Fantasy", ["might", "speed"]),
    ("Bard", "Barde", "Fantasy", "Dungeon Fantasy", ["speed", "intellect"]),
    ("Cleric", "Clerc", "Fantasy", "Dungeon Fantasy", ["might", "intellect"]),
    ("Druid", "Druide", "Fantasy", "Dungeon Fantasy", ["might", "intellect"]),
    ("Fighter", "Combattant", "Fantasy", "Dungeon Fantasy", ["might", "speed"]),
    ("Mage", "Mage", "Fantasy", "Dungeon Fantasy", ["intellect"]),
    ("Monk", "Moine", "Fantasy", "Dungeon Fantasy", ["might", "speed"]),
    ("Necromancer", "Nécromancien", "Fantasy", "Dungeon Fantasy", ["intellect"]),
    ("Paladin", "Paladin", "Fantasy", "Dungeon Fantasy", ["might", "intellect"]),
    ("Ranger", "Rôdeur", "Fantasy", "Dungeon Fantasy", ["speed", "intellect"]),
    ("Rogue", "Roublard", "Fantasy", "Dungeon Fantasy", ["speed", "intellect"]),
    ("Archer", "Archer·ère", "Fantasy", "Swords & Sorcery", ["speed"]),
    ("Axe Fighter", "Combattant·e à la hache", "Fantasy", "Swords & Sorcery", ["might"]),
    ("Barbarian (Swords & Sorcery)", "Barbare (Sword & Sorcery)", "Fantasy", "Swords & Sorcery", ["might"]),
    ("Knife Fighter", "Combattant·e au Couteau", "Fantasy", "Swords & Sorcery", ["speed"]),
    ("Priest", "Prêtre·esse", "Fantasy", "Swords & Sorcery", ["intellect"]),
    ("Sorcerer", "Ensorceleur·euse", "Fantasy", "Swords & Sorcery", ["intellect"]),
    ("Sword Fighter", "Combattant·e à l’épée", "Fantasy", "Swords & Sorcery", ["might", "speed"]),
    ("Thief", "Voleur·euse", "Fantasy", "Swords & Sorcery", ["speed", "intellect"]),
    ("Two-Weapon Fighter", "Combattant·e à deux armes", "Fantasy", "Swords & Sorcery", ["speed"]),
    ("Witch", "Sorcier·ère", "Fantasy", "Swords & Sorcery", ["intellect"]),
    ("Archer (Epic Fantasy)", "Archer·ère (Fantasy épique)", "Fantasy", "Epic Fantasy", ["speed"]),
    ("Burglar", "Cambrioleur·euse", "Fantasy", "Epic Fantasy", ["speed", "intellect"]),
    ("Noble Warrior", "Noble guerrier·ère", "Fantasy", "Epic Fantasy", ["might", "intellect"]),
    ("Swashbuckler", "Bretteur·euse", "Fantasy", "Epic Fantasy", ["speed", "intellect"]),
    ("Warrior", "Guerrier·ère", "Fantasy", "Epic Fantasy", ["might", "speed"]),
    ("Wizard", "Magicien·ne", "Fantasy", "Epic Fantasy", ["intellect"]),
    ("Diplomat", "Diplomate", "Science Fiction", "Hard Science Fiction", ["intellect"]),
    ("Engineer", "Ingénieur·e", "Science Fiction", "Hard Science Fiction", ["intellect"]),
    ("Medic", "Toubib", "Science Fiction", "Hard Science Fiction", ["intellect"]),
    ("Noble (Hard Science Fiction)", "Noble (SF dure)", "Science Fiction", "Hard Science Fiction", ["intellect"]),
    ("Operative", "Opérateur·rice", "Science Fiction", "Hard Science Fiction", ["speed", "intellect"]),
    ("Pilot", "Pilote", "Science Fiction", "Hard Science Fiction", ["speed", "intellect"]),
    ("Soldier", "Soldat·e", "Science Fiction", "Hard Science Fiction", ["might", "speed"]),
    ("Android", "Androïde", "Science Fiction", "Space Opera", ["might", "intellect"]),
    ("Diplomat (Space Opera)", "Diplomate (de SF dure)", "Science Fiction", "Space Opera", ["intellect"]),
    ("Medic (Space Opera)", "Toubib (de SF dure)", "Science Fiction", "Space Opera", ["intellect"]),
    ("Noble", "Noble", "Science Fiction", "Space Opera", ["intellect"]),
    ("Psion", "Psion·ne", "Science Fiction", "Space Opera", ["intellect"]),
    ("Scoundrel", "Fripouille", "Science Fiction", "Space Opera", ["speed", "intellect"]),
    ("Soldier (Space Opera)", "Soldat·e (de SF dure)", "Science Fiction", "Space Opera", ["might", "speed"]),
    ("Starpilot", "Pilote spatial", "Science Fiction", "Space Opera", ["speed", "intellect"]),
    ("Tech", "Tech", "Science Fiction", "Space Opera", ["intellect"]),
    ("Trader", "Marchand·e", "Science Fiction", "Space Opera", ["intellect"]),
    ("Dealer", "Magouilleur·euse", "Science Fiction", "Postapocalypse", ["intellect", "speed"]),
    ("Heavy", "Bourrin·e", "Science Fiction", "Postapocalypse", ["might"]),
    ("Survivor", "Survivant·e", "Science Fiction", "Postapocalypse", ["might", "speed"]),
    ("Tender", "Soigneur", "Science Fiction", "Postapocalypse", ["intellect"]),
    ("Crimefighter (Rank 1)", "Justicier·ère", "Superheroes", "Superheroes", ["speed", "intellect"]),
    ("Vigilante (Rank 1)", "Vengeur·euse", "Superheroes", "Superheroes", ["might", "speed"]),
    ("Enhanced Hero (Rank 2)", "Héros·ïne Augmenté·e", "Superheroes", "Superheroes", ["might", "speed"]),
    ("Powerstar (Rank 2)", "Astropuissance", "Superheroes", "Superheroes", ["might", "intellect"]),
    ("Superhuman (Rank 3)", "Surhumain·e", "Superheroes", "Superheroes", ["might", "speed", "intellect"]),
    ("Powerhouse (Rank 4)", "Colosse", "Superheroes", "Superheroes", ["might"]),
    ("Living God (Rank 5)", "Dieu Vivant", "Superheroes", "Superheroes", ["might", "intellect"]),
]
TYPE_SOURCE_NAMES = {
    "Barbarian (Swords & Sorcery)": "Barbarian",
    "Archer (Epic Fantasy)": "Archer",
    "Soldier (Space Opera)": "Soldier",
    "Diplomat (Space Opera)": "Diplomat",
    "Medic (Space Opera)": "Medic",
    "Noble (Hard Science Fiction)": "Noble",
}
FRENCH_CHARACTER_BOOK_CHAPTERS = [
    "Chapitre 6 Fantasy 2dc92c8e8ea9804d9b76c93203450abf.md",
    "Chapitre 7 Science Fiction 31192c8e8ea98042a153d483563b8fd4.md",
    "Chapitre 8 Superheros 31192c8e8ea98065b99bfcbaf75c3acf.md",
]
FRENCH_TYPE_SOURCE_NAMES = {
    "Tender": "Secoureur·euse",
}
DEFAULT_TYPE_IMAGE = "icons/svg/upgrade.svg"

GENRE_LABELS = {
    "en": {"Fantasy": "Fantasy", "Science Fiction": "Science Fiction", "Superheroes": "Superheroes"},
    "fr": {"Fantasy": "Fantasy", "Science Fiction": "Science-fiction", "Superheroes": "Super-héros"}
}
SUBGENRE_LABELS = {
    "en": {
        "Dungeon Fantasy": "Dungeon Fantasy", "Swords & Sorcery": "Swords & Sorcery",
        "Epic Fantasy": "Epic Fantasy", "Hard Science Fiction": "Hard Science Fiction",
        "Space Opera": "Space Opera", "Postapocalypse": "Postapocalypse", "Superheroes": "Superheroes"
    },
    "fr": {
        "Dungeon Fantasy": "Dungeon Fantasy", "Swords & Sorcery": "Épées & Sorcellerie",
        "Epic Fantasy": "Fantasy épique", "Hard Science Fiction": "Science-fiction dure",
        "Space Opera": "Space Opera", "Postapocalypse": "Postapocalyptique", "Superheroes": "Super-héros"
    }
}


def stable_id(language, slug):
    rnd = random.Random(f"{language}-{slug}")
    return "".join(rnd.choice(string.ascii_letters + string.digits) for _ in range(16))


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def type_image_path(name):
    image_slug = re.sub(r"-rank-\d+$", "", slugify(name))
    filename = f"{image_slug}.webp"
    if os.path.isfile(os.path.join(ROOT, "assets", "types", filename)):
        return f"systems/cypher/assets/types/{filename}"
    return DEFAULT_TYPE_IMAGE


def genre_folder_id(language, genre):
    return stable_id(language, f"genre-{slugify(genre)}")


def subgenre_folder_id(language, genre, subgenre):
    return stable_id(language, f"subgenre-{slugify(genre)}-{slugify(subgenre)}")


def make_genre_folder(language, genre, sort):
    folder_id = genre_folder_id(language, genre)
    return {
        "_id": folder_id,
        "_key": f"!folders!{folder_id}",
        "name": GENRE_LABELS[language][genre],
        "type": "Item",
        "folder": None,
        "sorting": "a",
        "sort": sort,
        "description": "",
        "flags": {}
    }


def make_subgenre_folder(language, genre, subgenre, sort):
    folder_id = subgenre_folder_id(language, genre, subgenre)
    return {
        "_id": folder_id,
        "_key": f"!folders!{folder_id}",
        "name": SUBGENRE_LABELS[language][subgenre],
        "type": "Item",
        "folder": genre_folder_id(language, genre),
        "sorting": "a",
        "sort": sort,
        "description": "",
        "flags": {}
    }


def read_reference_paragraphs():
    reference = os.environ.get(
        "CYPHER_REFERENCE_DOCUMENT",
        os.path.join(ROOT, "docs", "local", "Cypher-Reference-Document-2026-07-29.docx")
    )
    if not os.path.exists(reference):
        raise FileNotFoundError(f"Cypher Reference Document not found: {reference}")
    with zipfile.ZipFile(reference) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    return ["".join(node.text or "" for node in paragraph.findall(".//w:t", namespace)).strip()
            for paragraph in root.findall(".//w:body/w:p", namespace)]


def extract_rules(paragraphs, name, subgenre):
    """Extract Type mechanics from the authoritative CRD section."""
    rules = {
        "poolBonuses": {"might": 0, "speed": 0, "intellect": 0},
        "edgeChoice": 0,
        "woundBonuses": {"minor": 0, "moderate": 0, "major": 0},
        "freeWeapons": False,
        "freeArmor": False,
        "skillOptions": [],
        "abilities": []
    }
    section_markers = {
        "Dungeon Fantasy": "Dungeon Fantasy",
        "Swords & Sorcery": "Swords & Sorcery",
        "Epic Fantasy": "Epic Fantasy",
        "Hard Science Fiction": "Hard Science Fiction",
        "Space Opera": "Space Opera",
        "Postapocalypse": "Postapocalypse",
        "Superheroes": "Superheroes Genre"
    }
    marker = section_markers.get(subgenre)
    section_start = next((index for index, value in enumerate(paragraphs) if value == marker), -1)
    section_end = min(
        (index for index, value in enumerate(paragraphs)
         if index > section_start and value in section_markers.values()),
        default=len(paragraphs)
    )
    base_name = name.split(" (")[0]
    start = next(
        (index for index, value in enumerate(paragraphs[section_start:section_end], section_start)
         if value == f"{base_name} Abilities"),
        -1
    )
    if start < 0:
        return rules
    section = paragraphs[start:next(
        (index for index in range(start + 1, section_end) if paragraphs[index].endswith("Equipment Bundle")),
        section_end
    )]
    number_words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
    current_ability = None
    for line in section:
        if not line:
            continue
        if line != f"{base_name} Abilities" and line.endswith(" Abilities"):
            break
        if current_ability and re.match(r"^Effort\s*:", line, re.IGNORECASE):
            current_ability["description"] = f"{current_ability['description']} {line}".strip()
            continue
        if current_ability and line.rstrip(".") == "Enabler":
            current_ability["enabler"] = True
            continue
        ability_match = re.match(r"^([A-Za-z][A-Za-z' -]+?)(?: \((\d+)\+?\s+(Might|Speed|Intellect)\))?: (.+)$", line)
        if ability_match and not line.startswith(("Add ", "Able ", "Freely ", "Gain ")):
            current_ability = {
                "name": ability_match.group(1).strip(),
                "tier": 1,
                "enabler": False,
                "cost": {"stat": (ability_match.group(3) or "none").lower(), "amount": int(ability_match.group(2) or 0)},
                "description": ability_match.group(4).strip(),
            }
            if current_ability["description"].rstrip(".").endswith("Enabler"):
                current_ability["enabler"] = True
                current_ability["description"] = re.sub(r"\s*Enabler\.?$", "", current_ability["description"]).rstrip()
            rules["abilities"].append(current_ability)
            continue
        if current_ability and line.rstrip(".").endswith("Enabler"):
            current_ability["enabler"] = True
            line = re.sub(r"\s*Enabler\.?$", "", line).rstrip()
        match = re.search(r"\+(\d+) to (Might|Speed|Intellect) Pool", line)
        if match:
            rules["poolBonuses"][match.group(2).lower()] += int(match.group(1))
        match = re.search(r"\+(\d+) Edge in Pool of your choice", line)
        if match:
            rules["edgeChoice"] += int(match.group(1))
        for number, severity in re.findall(r"(\d+|one|two|three|four|five) more (minor|moderate|major) wounds?", line, re.IGNORECASE):
            rules["woundBonuses"][severity.lower()] += int(number) if number.isdigit() else number_words[number.lower()]
        if "Freely use all weapons" in line:
            rules["freeWeapons"] = True
        if "Freely use" in line and "armor" in line:
            rules["freeArmor"] = True
        match = re.search(r"Trained in (.+)", line)
        if match:
            rules["skillOptions"].extend(re.split(r" or |, ", match.group(1).rstrip(".")))
        if current_ability and line:
            current_ability["description"] = f"{current_ability['description']} {line}".strip()
    rules["skillOptions"] = [skill.strip() for skill in rules["skillOptions"] if skill.strip()]
    return rules


def strip_markdown(value):
    """Return Markdown text without presentation markup."""
    value = re.sub(r"!?\[([^\]]+)\]\([^)]*\)", r"\1", value)
    return re.sub(r"[*_`$]", "", value).strip()


def read_french_character_book():
    """Read the French Character Book used exclusively for Type localization."""
    lines = []
    base = os.path.join(ROOT, "docs", "local", "character_book")
    for filename in FRENCH_CHARACTER_BOOK_CHAPTERS:
        path = os.path.join(base, filename)
        if not os.path.exists(path):
            raise FileNotFoundError(f"French Character Book chapter not found: {path}")
        with open(path, encoding="utf-8") as source:
            lines.extend(source.read().splitlines())
    return lines


def localized_french_abilities(lines, type_name):
    """Extract localized ability text without deriving mechanics from Markdown."""
    name_pattern = re.escape(type_name.casefold().replace("’", "'"))
    start = next(
        (index for index, line in enumerate(lines)
         if line.startswith("###") and "capacit" in strip_markdown(line).casefold()
         and re.search(name_pattern, strip_markdown(line).casefold().replace("’", "'"))),
        -1,
    )
    if start < 0:
        return []
    end = next(
        (index for index in range(start + 1, len(lines))
         if lines[index].startswith("###") and "ensemble d'équipement" in strip_markdown(lines[index]).casefold().replace("’", "'")),
        len(lines),
    )
    abilities = []
    current = None
    in_aside = False
    for raw_line in lines[start + 1:end]:
        if raw_line.lstrip().startswith("<aside"):
            in_aside = True
            continue
        if raw_line.lstrip().startswith("</aside"):
            in_aside = False
            continue
        if in_aside or raw_line.lstrip().startswith("<"):
            continue
        raw_line = raw_line.lstrip("- ")
        line = strip_markdown(raw_line)
        if not line:
            continue
        match = re.match(r"^\*\*(.+?)(?: \(\d+\+?\s+Intellect\))?\s*:\*\*\s*(.+)$", raw_line)
        if match:
            current = {"name": match.group(1).strip(), "description": match.group(2).strip(), "enabler": False}
            abilities.append(current)
            continue
        if current and line.casefold().rstrip(".") == "facilitateur":
            current["enabler"] = True
            continue
        if current:
            current["description"] = f"{current['description']} {line}".strip()
    return abilities


def localize_french_rules(rules, character_book, type_name):
    """Replace only human-readable French ability fields, preserving CRD mechanics."""
    localized = localized_french_abilities(character_book, type_name)
    for ability, translation in zip(rules["abilities"], localized):
        ability["name"] = translation["name"]
        ability["description"] = translation["description"]
        ability["enabler"] = translation["enabler"]
    return rules


def write_item(language, name, name_fr, genre, subgenre, stats, rules, display_name, display_name_fr, image):
    localized_name = display_name if language == "en" else display_name_fr
    genre_label = GENRE_LABELS[language][genre]
    subgenre_label = SUBGENRE_LABELS[language][subgenre]
    if language == "en":
        description = f"<p>A {subgenre} Type focused on {localized_name.lower()} archetypal play, with clear room for a character's own story and abilities.</p><p><em>Genre: {genre_label}. Subgenre: {subgenre_label}. Primary Pools: {', '.join(stats)}.</em></p>"
    else:
        stat_labels = {"might": "Puissance", "speed": "Célérité", "intellect": "Intellect"}
        description = f"<p>Un Type de {subgenre_label} centré sur l'archétype {localized_name.lower()}, tout en laissant la place à l'histoire et aux capacités propres du personnage.</p><p><em>Genre : {genre_label}. Sous-genre : {subgenre_label}. Réserves principales : {', '.join(stat_labels[s] for s in stats)}.</em></p>"
    slug = slugify(name)
    item_id = stable_id(language, slug)
    return {
        "_id": item_id, "_key": f"!items!{item_id}", "name": localized_name,
        "type": "type", "img": image, "system": {
            "tier": 1, "genre": genre, "subgenre": subgenre,
            **rules, "statOptions": stats,
            "description": description
        }, "folder": (
            subgenre_folder_id(language, genre, subgenre)
            if subgenre != genre else genre_folder_id(language, genre)
        ), "sort": 0,
        "ownership": {"default": 0},
        "flags": {"cypher": {"sourceLicense": (
            "Résumé original basé sur le Cypher Reference Document ; construit sous la Cypher Open License."
            if language == "fr" else
            "Original summary based on the Cypher Reference Document; built under the Cypher Open License."
        )}}
    }


def main():
    reference_paragraphs = read_reference_paragraphs()
    french_character_book = read_french_character_book()
    genres = list(dict.fromkeys(entry[2] for entry in TYPES))
    subgenres = list(dict.fromkeys(
        (entry[2], entry[3]) for entry in TYPES if entry[2] != entry[3]
    ))
    for language in ("en", "fr"):
        target = os.path.join(BASE, f"types-{language}", "_source")
        os.makedirs(target, exist_ok=True)
        for index, genre in enumerate(genres):
            folder = make_genre_folder(language, genre, (index + 1) * 100000)
            with open(os.path.join(target, f"genre-{slugify(genre)}.json"), "w", encoding="utf-8") as output:
                json.dump(folder, output, ensure_ascii=False, indent=2)
                output.write("\n")
        for index, (genre, subgenre) in enumerate(subgenres):
            folder = make_subgenre_folder(language, genre, subgenre, (index + 1) * 100000)
            filename = f"subgenre-{slugify(genre)}-{slugify(subgenre)}.json"
            with open(os.path.join(target, filename), "w", encoding="utf-8") as output:
                json.dump(folder, output, ensure_ascii=False, indent=2)
                output.write("\n")
        for entry in TYPES:
            source_entry = next(
                (candidate for candidate in TYPES if candidate[0] == TYPE_SOURCE_NAMES.get(entry[0], entry[0])),
                entry,
            )
            rules = extract_rules(reference_paragraphs, source_entry[0], source_entry[3])
            if language == "fr":
                source_name = FRENCH_TYPE_SOURCE_NAMES.get(source_entry[0], source_entry[1])
                rules = localize_french_rules(rules, french_character_book, source_name)
            item = write_item(
                language,
                *entry[:4],
                source_entry[4],
                rules,
                source_entry[0],
                source_entry[1],
                type_image_path(source_entry[0]),
            )
            with open(os.path.join(target, f"{slugify(entry[0])}.json"), "w", encoding="utf-8") as output:
                json.dump(item, output, ensure_ascii=False, indent=2)
                output.write("\n")
    source_count = (len(TYPES) + len(genres) + len(subgenres)) * 2
    print(
        f"Generated {len(TYPES)} types, {len(genres)} genre folders, and "
        f"{len(subgenres)} subgenre folders x 2 languages = {source_count} files"
    )


if __name__ == "__main__":
    main()
