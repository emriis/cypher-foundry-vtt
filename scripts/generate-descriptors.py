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


SKILL_OPTIONS_FR = {
    "Appealing": ["Persuasion"],
    "Bookish": ["Histoire", "Connaissances religieuses", "Identification", "Mathématiques"],
    "Brash": ["Piratage informatique", "Initiative"],
    "Calm": ["Persuasion"],
    "Cautious": ["Perception"],
    "Chaotic": ["Initiative"],
    "Charming": ["Persuasion"],
    "Clever": ["Tromperie", "Piratage informatique", "Persuasion", "Discernement des motivations"],
    "Compassionate": ["Soin"],
    "Creative": ["Représentation", "Édition"],
    "Empathic": ["Discernement des motivations"],
    "Fast": ["Initiative"],
    "Gloomy": ["Discernement des motivations"],
    "Graceful": ["Gymnastique"],
    "Guarded": ["Tromperie", "Discernement des motivations"],
    "Honorable": ["Persuasion"],
    "Inquisitive": ["Identification", "Collecte d'informations"],
    "Intelligent": ["Histoire", "Connaissances religieuses", "Identification", "Mathématiques"],
    "Intuitive": ["Discernement des motivations"],
    "Jovial": ["Représentation"],
    "Kind": ["Persuasion"],
    "Mechanical": ["Ingénierie", "Utilisation d'équipement lourd", "Exploitation de systèmes"],
    "Mysterious": ["Tromperie", "Furtivité"],
    "Mystical": ["Connaissances magiques", "Connaissances psychiques", "Connaissances religieuses"],
    "Perceptive": ["Perception", "Discernement des motivations"],
    "Resilient": ["Évasion"],
    "Rugged": ["Soins aux animaux", "Survie en plein air"],
    "Skeptical": ["Identification", "Discernement des motivations"],
    "Stealthy": ["Furtivité", "Vol à la tire", "Crochetage"],
    "Strong": ["Athlétisme"],
    "Strong-Willed": ["Persuasion"],
    "Tough": ["Athlétisme", "Soin", "Survie en plein air"],
    "Virtuous": ["Discernement des motivations"],
}

STAT_FR = {"might": "Puissance", "speed": "Célérité", "intellect": "Intellect"}

# (name_en, name_fr, [stats], [skills_en], flavor_en, flavor_fr)
# Le texte "flavor" est une reformulation originale, pas une reproduction du CRD — voir
# CRITICAL_COPYRIGHT_COMPLIANCE. Seules les données mécaniques (stat/compétences) suivent le CRD.
# The "flavor" text is an original rewrite, not a reproduction of the CRD — see
# CRITICAL_COPYRIGHT_COMPLIANCE. Only the mechanical data (stat/skills) follows the CRD.
DESCRIPTORS = [
    ("Appealing", "Attrayant·e", ["intellect"], ["Charm", "Recognizing Motive"],
     "You have an easy, likeable charisma that puts strangers at ease and draws allies to your side.",
     "Tu es naturellement attirant·e et charismatique. Les gens t'apprécient, veulent t'aider et devenir ton ami·e."),
    ("Bookish", "Studieux·se", ["intellect"], ["History", "Philosophy", "Psychology"],
     "You have spent far more time with books and study than with physical pursuits, and it shows in how much you know.",
     "Tu as passé ta vie à des activités intellectuelles. Tu maîtrises le monde universitaire mais as peu d'expérience physique."),
    ("Brash", "Audacieux·se", ["speed"], ["Hacking", "Initiative"],
     "You're bold, energetic, and a little irreverent — quick to act and quick to speak your mind.",
     "Tu as un tempérament affirmé et une grande confiance en toi. Certain·es te trouvent courageux·se, d'autres prétentieux·se."),
    ("Calm", "Serein·e", ["intellect"], ["Charm", "Skilled Trade"],
     "Little rattles you. You favor an inner stillness that lets you think clearly under pressure.",
     "Tu restes calme et posé·e face au stress et à l'adversité. Ta sérénité rassure ton entourage."),
    ("Cautious", "Prudent·e", ["speed"], ["Gathering Information", "Perception"],
     "You study a situation carefully before committing to it, preferring preparation over recklessness.",
     "Tu ne te lances jamais tête baissée. Tu prends le temps de tout analyser avant d'agir."),
    ("Chaotic", "Impulsif·ve", ["speed"], ["Initiative", "Performance"],
     "Danger rarely fazes you, mostly because you don't dwell on consequences — you thrive on the unexpected.",
     "Le danger ne t'effraie guère. Tu aimes semer la surprise juste pour voir ce qui va se produire."),
    ("Charming", "Charmeur·euse", ["intellect"], ["Charm", "Deception"],
     "A smooth talker with an easy smile, you have a gift for getting people to see things your way.",
     "Tu as un don pour la parole et un charme irrésistible. Tu sais convaincre les autres de faire ce que tu veux."),
    ("Clever", "Rusé·e", ["intellect"], ["Deception", "Recognizing Motive"],
     "Quick-witted and observant, you size up people and situations almost instantly.",
     "Tu es vif·ve d'esprit et tu as le sens de la répartie. Tu comprends les gens, ce qui te permet de les duper."),
    ("Compassionate", "Bienveillant·e", ["intellect"], ["Animal Care", "Healing"],
     "Helping others is what drives you, and you're at your best tending to someone else's wounds or troubles.",
     "Aider les autres est ta vocation. Ta générosité naturelle apporte de la joie à autrui."),
    ("Creative", "Créatif·ve", ["intellect"], ["Performance", "Publishing"],
     "Ideas come easily to you, whether you write them down, perform them, or build them from scratch.",
     "Tu es créatif·ve : tu écris, composes, sculptes, conçois, dessines ou inventes des récits qui captivent les autres."),
    ("Empathic", "Empathique", ["intellect"], ["Gathering Information", "Recognizing Motive"],
     "You read people easily, picking up on moods and motives that others miss entirely.",
     "Tu sais décrypter les signaux non verbaux et percevoir les émotions d'autrui. Tu gères bien les situations sociales."),
    ("Fast", "Rapide", ["speed"], ["Deception", "Initiative"],
     "Quick of foot, quick of hand, and quick of tongue, you simply do everything a beat faster than most.",
     "Tu es vif·ve comme l'éclair. Rapide de corps, de mains, de pensée et de parole."),
    ("Gloomy", "Pessimiste", ["speed", "might"], ["History", "Recognizing Motive"],
     "You expect the worst as a matter of course, which means you're rarely disappointed when it happens.",
     "Tu t'attends souvent au pire. Il t'est plus facile d'anticiper les problèmes et d'être surpris quand les choses se passent bien."),
    ("Graceful", "Gracieux·se", ["speed"], ["Gymnastics", "Initiative"],
     "You move with a fluid, deliberate elegance, whether dancing, fighting, or simply crossing a room.",
     "Tu as un sens de l'équilibre parfait. Tes mouvements sont empreints de grâce et d'élégance."),
    ("Guarded", "Méfiant·e", ["intellect"], ["Deception", "Disguise"],
     "You keep your true self behind a mask, preferring to keep others at a careful distance.",
     "Tu dissimules ta véritable nature et rechignes à laisser quiconque entrevoir qui tu es vraiment."),
    ("Honorable", "Honorable", ["might"], ["Charm", "Philosophy"],
     "Trustworthy and forthright, you try to do what's right even when it costs you something.",
     "Tu es digne de confiance, juste et franc·he. Tu t'efforces d'agir avec droiture et de traiter les autres correctement."),
    ("Inquisitive", "Curieux·se", ["intellect"], ["Gathering Information", "Identifying"],
     "The unknown calls to you, and you take care to be prepared before you go looking for answers.",
     "Tu ressens un appel profond à explorer, découvrir de nouveaux peuples et lieux. Tu prends des précautions pour être prêt·e."),
    ("Intelligent", "Intelligent·e", ["intellect"], ["Chemistry", "Engineering", "Mathematics"],
     "Sharp-minded and quick to learn, you grasp complex ideas that leave others struggling.",
     "Tu as une excellente mémoire et comprends facilement des concepts complexes."),
    ("Intuitive", "Intuitif·ve", ["intellect"], ["Psychology", "Recognizing Motive"],
     "You often sense what someone will do or say before they do it, as if a step ahead of the room.",
     "Tu éprouves souvent une étrange fascination pour le fait de savoir ce que quelqu'un va dire ou comment les événements vont se dérouler."),
    ("Jovial", "Passionné·e", ["intellect"], ["Charm", "Performance"],
     "Cheerful and outgoing, you put people at ease with a joke and a warm smile.",
     "Tu vis les émotions de façon intense. Tes passions guident tes actions et les autres voient en toi quelqu'un de profondément sincère."),
    ("Kind", "Aimable", ["intellect"], ["Charm", "Healing"],
     "You see things from other people's point of view easily, and treat them with patience because of it.",
     "Tu te mets facilement à la place des autres. Tu appliques le vieux proverbe : on attrape plus facilement les mouches avec du miel."),
    ("Mechanical", "Mécanicien·ne", ["intellect"], ["Engineering", "Heavy Equipment Operation", "Systems Operation"],
     "You have a natural talent with machines of all kinds, understanding and repairing them with ease.",
     "Tu as un don pour les machines. Tu sais les comprendre, les réparer et parfois en créer de nouvelles."),
    ("Mysterious", "Mystérieux·se", ["intellect", "speed"], ["Deception", "Stealth"],
     "No one is quite sure where you came from or what you want, and you prefer to keep it that way.",
     "La silhouette sombre qui rôde silencieusement dans un coin ? C'est toi. Personne ne sait d'où tu viens ni quelles sont tes motivations."),
    ("Mystical", "Mystique", ["intellect"], ["Magic Lore", "Psychic Lore", "Religious Lore"],
     "You are attuned to the mysterious and the paranormal, drawn to ancient lore and hidden truths.",
     "Tu te considères en harmonie avec le mystérieux et le paranormal. Tu connais des traditions anciennes et perçois des phénomènes surnaturels."),
    ("Perceptive", "Observateur·rice", ["intellect"], ["Perception", "Recognizing Motive"],
     "You miss very little, picking out small details that others walk right past.",
     "Tu es très perspicace. Tu remarques les moindres détails et sais tirer des conclusions pertinentes."),
    ("Resilient", "Résilient·e", ["might"], ["Athletics", "Escaping"],
     "You're tougher than you look, able to take a beating and keep going without panic.",
     "Tu es plus résistant·e que la plupart. Tu encaisses les coups et tu sais comment te sortir d'une mauvaise passe."),
    ("Rugged", "Sauvage", ["might"], ["Animal Care", "Outdoor Survival"],
     "Years of living close to the land have left you weathered, capable, and at home in the wild.",
     "Tu es un·e amoureux·se de la nature, habitué·e à vivre dehors et à affronter les éléments."),
    ("Skeptical", "Sceptique", ["intellect"], ["Identifying", "Recognizing Motive"],
     "You question what others take for granted, and that habit has served you well more than once.",
     "Tu as un esprit critique face aux affirmations qu'on considère souvent comme acquises."),
    ("Stealthy", "Furtif·ve", ["speed"], ["Pickpocketing", "Stealth"],
     "Quick and quiet, you know how to use shadows and distraction to move unseen and unheard.",
     "Tu es furtif·ve, insaisissable et rapide. Tu sais utiliser les ombres et les abris pour rester invisible et inaudible."),
    ("Strong", "Fort·e", ["might"], ["Athletics", "Intimidation"],
     "Physically powerful and well aware of it, you put your strength to good use in nearly everything you do.",
     "Tu es extrêmement fort·e physiquement. Tu exploites ces qualités à merveille, que ce soit au combat ou lors de prouesses athlétiques."),
    ("Strong-Willed", "Têtu·e", ["intellect"], ["Charm", "Intimidation"],
     "No one talks you into anything you don't want to do — your resolve is as unshakable as your style.",
     "Tu es déterminé·e, volontaire et indépendant·e. Personne ne peut te convaincre de quoi que ce soit si tu n'en as pas envie."),
    ("Tough", "Robuste", ["might"], ["Athletics", "Outdoor Survival"],
     "You shrug off punishment that would slow down most people, and keep moving forward regardless.",
     "Tu es fort·e et peux encaisser des coups violents. Tu continues d'avancer sans te soucier des douleurs qui mettraient d'autres hors d'état."),
    ("Virtuous", "Vertueux·se", ["might"], ["Philosophy", "Religious Lore"],
     "You live by a code and hold yourself to it every day, correcting course whenever you slip.",
     "Faire ce qui est juste est pour toi un véritable mode de vie. Tu suis un code de conduite auquel tu te tiens quotidiennement."),
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "packs")


def main():
    os.makedirs(f"{BASE}/descriptors-en/_source", exist_ok=True)
    os.makedirs(f"{BASE}/descriptors-fr/_source", exist_ok=True)

    for name_en, name_fr, stats, skills_en, flavor_en, flavor_fr in DESCRIPTORS:
        slug = slugify(name_en)
        skills_fr = SKILL_OPTIONS_FR[name_en]

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
