#!/usr/bin/env python3
"""Génère les fichiers source JSON des compendiums de Descripteurs (FR/EN).

Usage :
    python3 scripts/generate-descriptors.py

Écrit dans packs/descriptors-en/_source/*.json et packs/descriptors-fr/_source/*.json.
Pour compiler ensuite ces sources en pack LevelDB chargeable par Foundry :

    npx fvtt package pack -n descriptors-en --in packs/descriptors-en/_source --out /tmp/out-en
    cp /tmp/out-en/descriptors-en/* packs/descriptors-en/
    npx fvtt package pack -n descriptors-fr --in packs/descriptors-fr/_source --out /tmp/out-fr
    cp /tmp/out-fr/descriptors-fr/* packs/descriptors-fr/

(Le CLI place le résultat dans <out>/<nom-du-pack>/ ; il faut donc remonter son contenu
au niveau attendu par system.json, qui pointe directement vers packs/<nom-du-pack>/.)

Generates the source JSON files for the Descriptor compendiums (FR/EN).

Usage:
    python3 scripts/generate-descriptors.py

Writes to packs/descriptors-en/_source/*.json and packs/descriptors-fr/_source/*.json.
To then compile these sources into a LevelDB pack Foundry can load:

    npx fvtt package pack -n descriptors-en --in packs/descriptors-en/_source --out /tmp/out-en
    cp /tmp/out-en/descriptors-en/* packs/descriptors-en/
    npx fvtt package pack -n descriptors-fr --in packs/descriptors-fr/_source --out /tmp/out-fr
    cp /tmp/out-fr/descriptors-fr/* packs/descriptors-fr/

(The CLI puts the result under <out>/<pack-name>/, so its contents need to be moved up
to the level system.json expects, which points directly at packs/<pack-name>/.)
"""

import json
import os
import random
import re
import string

random.seed(20260914)


def make_id(seed_extra):
    """Identifiant Foundry stable et reproductible (16 caractères alphanumériques).
    Stable, reproducible Foundry id (16 alphanumeric characters)."""
    rnd = random.Random(seed_extra)
    return "".join(rnd.choice(string.ascii_letters + string.digits) for _ in range(16))


def slugify(name):
    s = name.lower().replace("'", "").replace("-", " ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


SKILL_FR = {
    "Charm": "Charme",
    "Recognizing Motive": "Déceler les intentions",
    "History": "Histoire",
    "Philosophy": "Philosophie",
    "Psychology": "Psychologie",
    "Hacking": "Piratage",
    "Initiative": "Initiative",
    "Skilled Trade": "Métier qualifié",
    "Gathering Information": "Récolte d'informations",
    "Perception": "Perception",
    "Performance": "Représentation",
    "Deception": "Tromperie",
    "Animal Care": "Soin animalier",
    "Healing": "Soins",
    "Publishing": "Édition",
    "Gymnastics": "Gymnastique",
    "Disguise": "Déguisement",
    "Identifying": "Identification",
    "Chemistry": "Chimie",
    "Engineering": "Ingénierie",
    "Mathematics": "Mathématiques",
    "Athletics": "Athlétisme",
    "Escaping": "Évasion",
    "Outdoor Survival": "Survie en extérieur",
    "Heavy Equipment Operation": "Conduite d'engins lourds",
    "Systems Operation": "Utilisation de systèmes",
    "Stealth": "Discrétion",
    "Magic Lore": "Savoir magique",
    "Psychic Lore": "Savoir psychique",
    "Religious Lore": "Savoir religieux",
    "Intimidation": "Intimidation",
    "Pickpocketing": "Vol à la tire",
}

STAT_FR = {"might": "Puissance", "speed": "Célérité", "intellect": "Intellect"}

# (name_en, name_fr, [stats], [skills_en], flavor_en, flavor_fr)
# Le texte "flavor" est une reformulation originale, pas une reproduction du CRD — voir
# CRITICAL_COPYRIGHT_COMPLIANCE. Seules les données mécaniques (stat/compétences) suivent le CRD.
# The "flavor" text is an original rewrite, not a reproduction of the CRD — see
# CRITICAL_COPYRIGHT_COMPLIANCE. Only the mechanical data (stat/skills) follows the CRD.
DESCRIPTORS = [
    ("Appealing", "Séduisant(e)", ["intellect"], ["Charm", "Recognizing Motive"],
     "You have an easy, likeable charisma that puts strangers at ease and draws allies to your side.",
     "Tu dégages un charisme naturel et sympathique qui met les inconnus à l'aise et attire les alliés."),
    ("Bookish", "Studieux(se)", ["intellect"], ["History", "Philosophy", "Psychology"],
     "You have spent far more time with books and study than with physical pursuits, and it shows in how much you know.",
     "Tu as passé bien plus de temps dans les livres que dans l'effort physique, et cela se voit à l'étendue de ton savoir."),
    ("Brash", "Impétueux(se)", ["speed"], ["Hacking", "Initiative"],
     "You're bold, energetic, and a little irreverent — quick to act and quick to speak your mind.",
     "Tu es audacieux, plein d'énergie, un brin irrévérencieux — prompt à agir et à dire ce que tu penses."),
    ("Calm", "Calme", ["intellect"], ["Charm", "Skilled Trade"],
     "Little rattles you. You favor an inner stillness that lets you think clearly under pressure.",
     "Rien ne te déstabilise vraiment. Tu cultives une stabilité intérieure qui te permet de réfléchir clairement sous pression."),
    ("Cautious", "Prudent(e)", ["speed"], ["Gathering Information", "Perception"],
     "You study a situation carefully before committing to it, preferring preparation over recklessness.",
     "Tu étudies une situation avec soin avant de t'y engager, préférant la préparation à l'imprudence."),
    ("Chaotic", "Chaotique", ["speed"], ["Initiative", "Performance"],
     "Danger rarely fazes you, mostly because you don't dwell on consequences — you thrive on the unexpected.",
     "Le danger t'effraie rarement, surtout parce que tu ne t'attardes pas sur les conséquences — l'imprévu te stimule."),
    ("Charming", "Charmeur(se)", ["intellect"], ["Charm", "Deception"],
     "A smooth talker with an easy smile, you have a gift for getting people to see things your way.",
     "Beau parleur au sourire facile, tu as le don de faire voir les choses à ta manière."),
    ("Clever", "Malin(e)", ["intellect"], ["Deception", "Recognizing Motive"],
     "Quick-witted and observant, you size up people and situations almost instantly.",
     "Vif d'esprit et observateur, tu jauges les gens et les situations presque instantanément."),
    ("Compassionate", "Compatissant(e)", ["intellect"], ["Animal Care", "Healing"],
     "Helping others is what drives you, and you're at your best tending to someone else's wounds or troubles.",
     "Aider les autres, voilà ce qui te fait avancer, et tu es à ton meilleur quand tu soignes les blessures ou les soucis d'autrui."),
    ("Creative", "Créatif(ve)", ["intellect"], ["Performance", "Publishing"],
     "Ideas come easily to you, whether you write them down, perform them, or build them from scratch.",
     "Les idées te viennent facilement, que tu les couches sur le papier, les interprètes ou les construises de toutes pièces."),
    ("Empathic", "Empathique", ["intellect"], ["Gathering Information", "Recognizing Motive"],
     "You read people easily, picking up on moods and motives that others miss entirely.",
     "Tu lis les gens facilement, percevant des humeurs et des motivations qui échappent totalement aux autres."),
    ("Fast", "Rapide", ["speed"], ["Deception", "Initiative"],
     "Quick of foot, quick of hand, and quick of tongue, you simply do everything a beat faster than most.",
     "Rapide des pieds, des mains et de la langue, tu fais tout un cran plus vite que la moyenne des gens."),
    ("Gloomy", "Sombre", ["speed", "might"], ["History", "Recognizing Motive"],
     "You expect the worst as a matter of course, which means you're rarely disappointed when it happens.",
     "Tu t'attends au pire par principe, ce qui fait que tu es rarement déçu(e) quand cela arrive."),
    ("Graceful", "Gracieux(se)", ["speed"], ["Gymnastics", "Initiative"],
     "You move with a fluid, deliberate elegance, whether dancing, fighting, or simply crossing a room.",
     "Tu te déplaces avec une élégance fluide et posée, que ce soit en dansant, en combattant, ou en traversant simplement une pièce."),
    ("Guarded", "Réservé(e)", ["intellect"], ["Deception", "Disguise"],
     "You keep your true self behind a mask, preferring to keep others at a careful distance.",
     "Tu gardes ton vrai visage derrière un masque, préférant maintenir les autres à une distance prudente."),
    ("Honorable", "Honorable", ["might"], ["Charm", "Philosophy"],
     "Trustworthy and forthright, you try to do what's right even when it costs you something.",
     "Digne de confiance et droit(e), tu essaies de faire ce qui est juste, même quand cela te coûte quelque chose."),
    ("Inquisitive", "Curieux(se)", ["intellect"], ["Gathering Information", "Identifying"],
     "The unknown calls to you, and you take care to be prepared before you go looking for answers.",
     "L'inconnu t'appelle, et tu prends soin d'être préparé(e) avant de partir en quête de réponses."),
    ("Intelligent", "Intelligent(e)", ["intellect"], ["Chemistry", "Engineering", "Mathematics"],
     "Sharp-minded and quick to learn, you grasp complex ideas that leave others struggling.",
     "L'esprit vif et l'apprentissage rapide, tu saisis des idées complexes qui laissent les autres perplexes."),
    ("Intuitive", "Intuitif(ve)", ["intellect"], ["Psychology", "Recognizing Motive"],
     "You often sense what someone will do or say before they do it, as if a step ahead of the room.",
     "Tu sens souvent ce que quelqu'un va faire ou dire avant qu'il ne le fasse, comme si tu avais toujours un coup d'avance."),
    ("Jovial", "Jovial(e)", ["intellect"], ["Charm", "Performance"],
     "Cheerful and outgoing, you put people at ease with a joke and a warm smile.",
     "Enjoué(e) et sociable, tu mets les gens à l'aise avec une blague et un sourire chaleureux."),
    ("Kind", "Bienveillant(e)", ["intellect"], ["Charm", "Healing"],
     "You see things from other people's point of view easily, and treat them with patience because of it.",
     "Tu te mets facilement à la place des autres, et cela te rend patient(e) avec eux."),
    ("Mechanical", "Mécanicien(ne)", ["intellect"], ["Engineering", "Heavy Equipment Operation", "Systems Operation"],
     "You have a natural talent with machines of all kinds, understanding and repairing them with ease.",
     "Tu as un talent naturel avec les machines en tout genre, que tu comprends et répares avec aisance."),
    ("Mysterious", "Mystérieux(se)", ["intellect", "speed"], ["Deception", "Stealth"],
     "No one is quite sure where you came from or what you want, and you prefer to keep it that way.",
     "Personne ne sait vraiment d'où tu viens ni ce que tu veux, et tu préfères que ça reste ainsi."),
    ("Mystical", "Mystique", ["intellect"], ["Magic Lore", "Psychic Lore", "Religious Lore"],
     "You are attuned to the mysterious and the paranormal, drawn to ancient lore and hidden truths.",
     "Tu es en phase avec le mystérieux et le paranormal, attiré(e) par les savoirs anciens et les vérités cachées."),
    ("Perceptive", "Perspicace", ["intellect"], ["Perception", "Recognizing Motive"],
     "You miss very little, picking out small details that others walk right past.",
     "Rien ne t'échappe vraiment, tu repères les petits détails que les autres ignorent en passant à côté."),
    ("Resilient", "Résilient(e)", ["might"], ["Athletics", "Escaping"],
     "You're tougher than you look, able to take a beating and keep going without panic.",
     "Tu es plus coriace qu'il n'y paraît, capable d'encaisser sans jamais paniquer."),
    ("Rugged", "Robuste", ["might"], ["Animal Care", "Outdoor Survival"],
     "Years of living close to the land have left you weathered, capable, and at home in the wild.",
     "Des années passées près de la nature t'ont rendu(e) endurci(e), débrouillard(e), et à l'aise en pleine nature."),
    ("Skeptical", "Sceptique", ["intellect"], ["Identifying", "Recognizing Motive"],
     "You question what others take for granted, and that habit has served you well more than once.",
     "Tu remets en question ce que les autres tiennent pour acquis, et cette habitude t'a souvent été utile."),
    ("Stealthy", "Furtif(ve)", ["speed"], ["Pickpocketing", "Stealth"],
     "Quick and quiet, you know how to use shadows and distraction to move unseen and unheard.",
     "Rapide et silencieux(se), tu sais utiliser l'ombre et la distraction pour te déplacer sans être vu(e) ni entendu(e)."),
    ("Strong", "Fort(e)", ["might"], ["Athletics", "Intimidation"],
     "Physically powerful and well aware of it, you put your strength to good use in nearly everything you do.",
     "Physiquement puissant(e) et pleinement conscient(e) de l'être, tu mets ta force à profit dans presque tout ce que tu entreprends."),
    ("Strong-Willed", "Volontaire", ["intellect"], ["Charm", "Intimidation"],
     "No one talks you into anything you don't want to do — your resolve is as unshakable as your style.",
     "Personne ne te fait faire ce que tu ne veux pas — ta détermination est aussi inébranlable que ton style."),
    ("Tough", "Endurant(e)", ["might"], ["Athletics", "Outdoor Survival"],
     "You shrug off punishment that would slow down most people, and keep moving forward regardless.",
     "Tu encaisses des coups qui ralentiraient la plupart des gens, et tu continues d'avancer malgré tout."),
    ("Virtuous", "Vertueux(se)", ["might"], ["Philosophy", "Religious Lore"],
     "You live by a code and hold yourself to it every day, correcting course whenever you slip.",
     "Tu vis selon un code que tu t'efforces de respecter chaque jour, te corrigeant dès que tu t'en écartes."),
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "packs")


def main():
    os.makedirs(f"{BASE}/descriptors-en/_source", exist_ok=True)
    os.makedirs(f"{BASE}/descriptors-fr/_source", exist_ok=True)

    for name_en, name_fr, stats, skills_en, flavor_en, flavor_fr in DESCRIPTORS:
        slug = slugify(name_en)
        skills_fr = [SKILL_FR[s] for s in skills_en]

        # EN
        doc_id = make_id(f"en-{slug}")
        stats_txt = " or ".join(s.capitalize() for s in stats)
        skills_txt = (", ".join(skills_en[:-1]) + " or " + skills_en[-1]) if len(skills_en) > 1 else skills_en[0]
        doc_en = {
            "_id": doc_id,
            "_key": f"!items!{doc_id}",
            "name": name_en,
            "type": "descriptor",
            "img": "icons/svg/aura.svg",
            "system": {
                "statOptions": stats,
                "statAmount": 2,
                "skillOptions": skills_en + [""] * (4 - len(skills_en)),
                "description": (
                    f"<p>{flavor_en}</p>"
                    f"<p><em>You gain +2 to your {stats_txt} Pool, and training in {skills_txt}.</em></p>"
                )
            },
            "folder": None,
            "sort": 0,
            "ownership": {"default": 0},
            "flags": {
                "cypher": {
                    "sourceLicense": "Built under the Cypher Open License using content from the "
                                      "Cypher Reference Document (CRD)."
                }
            }
        }
        with open(f"{BASE}/descriptors-en/_source/{slug}.json", "w", encoding="utf-8") as f:
            json.dump(doc_en, f, ensure_ascii=False, indent=2)
            f.write("\n")

        # FR
        doc_id_fr = make_id(f"fr-{slug}")
        stats_fr_txt = " ou ".join(STAT_FR[s] for s in stats)
        skills_fr_txt = (", ".join(skills_fr[:-1]) + " ou " + skills_fr[-1]) if len(skills_fr) > 1 else skills_fr[0]
        doc_fr = {
            "_id": doc_id_fr,
            "_key": f"!items!{doc_id_fr}",
            "name": name_fr,
            "type": "descriptor",
            "img": "icons/svg/aura.svg",
            "system": {
                "statOptions": stats,
                "statAmount": 2,
                "skillOptions": skills_fr + [""] * (4 - len(skills_fr)),
                "description": (
                    f"<p>{flavor_fr}</p>"
                    f"<p><em>Tu gagnes +2 à ta Réserve de {stats_fr_txt}, "
                    f"et un entrainement en {skills_fr_txt}.</em></p>"
                )
            },
            "folder": None,
            "sort": 0,
            "ownership": {"default": 0},
            "flags": {
                "cypher": {
                    "sourceLicense": "Construit sous la Cypher Open License à partir du contenu "
                                      "du Cypher Reference Document (CRD)."
                }
            }
        }
        with open(f"{BASE}/descriptors-fr/_source/{slug}.json", "w", encoding="utf-8") as f:
            json.dump(doc_fr, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print(f"Generated {len(DESCRIPTORS)} descriptors x 2 languages = {len(DESCRIPTORS) * 2} files")


if __name__ == "__main__":
    main()
