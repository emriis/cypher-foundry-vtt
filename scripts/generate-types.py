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
    ("Soldier (Hard Science Fiction)", "Soldat·e (SF dure)", "Science Fiction", "Hard Science Fiction", ["might", "speed"]),
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
    ("Noble", "Noble (Space Opera)", "Science Fiction", "Space Opera", ["intellect"]),
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
    """Extract only unambiguous numeric/proficiency benefits from a Type section."""
    rules = {
        "poolBonuses": {"might": 0, "speed": 0, "intellect": 0},
        "edgeChoice": 0,
        "woundBonuses": {"minor": 0, "moderate": 0, "major": 0},
        "freeWeapons": False,
        "freeArmor": False,
        "skillOptions": [],
        "abilities": []
    }
    if not paragraphs:
        return rules
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
    section_start = next((i for i, value in enumerate(paragraphs) if value == marker), -1)
    section_end = len(paragraphs)
    if section_start >= 0:
        next_starts = [
            i for i, value in enumerate(paragraphs)
            if i > section_start and value in section_markers.values()
        ]
        section_end = min(next_starts, default=len(paragraphs))
    base_name = name.split(" (")[0]
    candidates = [
        i for i, value in enumerate(paragraphs)
        if section_start <= i < section_end and value == f"{base_name} Abilities"
    ]
    start = candidates[0] if candidates else -1
    if start < 0:
        return rules
    section = []
    for line in paragraphs[start:start + 140]:
        if line != f"{base_name} Abilities" and line.endswith(" Abilities"):
            break
        if line.endswith("Equipment Bundle"):
            break
        section.append(line)
    number_words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
    current_tier = 1
    for line in section:
        tier_match = re.search(r"At tier (\d+)", line, re.IGNORECASE)
        if tier_match:
            current_tier = int(tier_match.group(1))
        if line == "Enabler." and rules["abilities"]:
            rules["abilities"][-1]["enabler"] = True
            continue
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
        ability_match = re.match(r"^([A-Za-z][A-Za-z' -]+?)(?: \((\d+)\+ (Might|Speed|Intellect)\))?: (.+)$", line)
        if ability_match and not line.startswith(("Add ", "Able ", "Freely ", "Gain ")):
            ability = {
                "name": ability_match.group(1).strip(),
                "tier": current_tier,
                "enabler": False,
                "cost": {"stat": (ability_match.group(3) or "none").lower(), "amount": int(ability_match.group(2) or 0)},
                "description": ability_match.group(4).strip()
            }
            rules["abilities"].append(ability)
    rules["skillOptions"] = [skill.strip() for skill in rules["skillOptions"] if skill.strip()]
    return rules


def write_item(language, name, name_fr, genre, subgenre, stats, rules):
    localized_name = name if language == "en" else name_fr
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
        "type": "type", "img": "icons/svg/upgrade.svg", "system": {
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
            item = write_item(language, *entry, extract_rules(reference_paragraphs, entry[0], entry[3]))
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
