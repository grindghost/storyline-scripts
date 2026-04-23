"""
Script: storyline-srt-slidexml-generator
Date: 2026-04-23
Auteur: grindghost

Outil Tkinter pour générer automatiquement des textBox Storyline dans un `slide.xml`
à partir d'un fichier `.srt` (timecodes + texte), en clonant un bloc modèle déjà stylé.

Contexte d'utilisation:
- un fichier `.story` peut être renommé en `.zip`, puis exploré/modifié (XML/JSON);
- ce script agit sur `story/slides/slide.xml` extrait d'un projet Storyline;
- le XML modifié peut ensuite être réintégré dans l'archive et rouvert dans Storyline.
"""

import copy
import os
import random
import re
import string
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import uuid
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape as xml_escape


# Parsing des segments SRT (index, début, fin, texte multiligne).
SRT_PATTERN = re.compile(
    r"\s*(\d+)\s*\n"
    r"(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\s*\n"
    r"(.*?)(?=\n{2,}|\Z)",
    re.DOTALL,
)

ALT_SUFFIX_PATTERN = re.compile(r"^(.*?)(\d+)$")
DATA_ACC_PATTERN_SINGLE = re.compile(r"(\[data-acc-text=')([^']+)('])")
DATA_ACC_PATTERN_DOUBLE = re.compile(r'(\[data-acc-text=")([^"]+)("\])')


def new_uuid() -> str:
    return str(uuid.uuid4())


def random_morph_key(length: int = 11) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def srt_time_to_ms(value: str) -> int:
    hh, mm, rest = value.split(":")
    ss, ms = rest.split(",")
    return (
        int(hh) * 3600 * 1000
        + int(mm) * 60 * 1000
        + int(ss) * 1000
        + int(ms)
    )


def parse_srt(path: str):
    with open(path, "r", encoding="utf-8-sig") as f:
        raw = f.read().replace("\r\n", "\n").replace("\r", "\n")

    matches = list(SRT_PATTERN.finditer(raw))
    if not matches:
        raise ValueError("Impossible de parser le fichier .srt. Vérifie son format.")

    cues = []
    for match in matches:
        index, start, end, text = match.groups()
        text = text.strip()
        if not text:
            continue

        start_ms = srt_time_to_ms(start)
        end_ms = srt_time_to_ms(end)
        if end_ms < start_ms:
            raise ValueError(f"Le segment #{index} a une fin antérieure au début.")

        cues.append(
            {
                "index": int(index),
                "start_ms": start_ms,
                "end_ms": end_ms,
                "dur_ms": max(0, end_ms - start_ms),
                "text": text,
            }
        )

    if not cues:
        raise ValueError("Aucun segment texte valide n'a été trouvé dans le .srt.")

    return cues


def embedded_rich_text_from_plain(text: str, style_attrs=None) -> str:
    style_attrs = style_attrs or {"FontFamily": "Arial", "FontSize": "18"}
    style_string = " ".join(
        f'{key}="{xml_escape(str(value))}"' for key, value in style_attrs.items()
    )

    lines = text.splitlines() or [text]
    blocks = []
    for line in lines:
        escaped_line = xml_escape(line)
        blocks.append(
            "    <Block>\n"
            f"      <Span Text=\"{escaped_line}\">\n"
            f"        <Style {style_string} />\n"
            "      </Span>\n"
            "    </Block>"
        )

    return (
        '<Document xmlns:xsd="http://www.w3.org/2001/XMLSchema" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n'
        '  <Content>\n'
        f'{chr(10).join(blocks)}\n'
        '  </Content>\n'
        '</Document>'
    )


def update_existing_embedded_text(xml_text: str, plain_text: str) -> str:
    """
    Garde autant que possible la structure/style existants (fmt simple, styles par Span),
    et remplace seulement le texte des Span. Si le parsing échoue, on retombe sur un rendu minimal.
    """
    if not xml_text or not xml_text.strip():
        return embedded_rich_text_from_plain(plain_text)

    try:
        embedded_root = ET.fromstring(xml_text)
        spans = embedded_root.findall(".//Span")
        lines = plain_text.splitlines() or [plain_text]

        if not spans:
            return embedded_rich_text_from_plain(plain_text)

        if len(lines) == 1:
            spans[0].attrib["Text"] = lines[0]
            for extra in spans[1:]:
                extra.attrib["Text"] = ""
        else:
            blocks = embedded_root.findall(".//Block")
            if blocks and len(blocks) == len(lines):
                for block, line in zip(blocks, lines):
                    block_spans = block.findall(".//Span")
                    if block_spans:
                        block_spans[0].attrib["Text"] = line
                        for extra in block_spans[1:]:
                            extra.attrib["Text"] = ""
                for extra_block in blocks[len(lines):]:
                    for span in extra_block.findall(".//Span"):
                        span.attrib["Text"] = ""
            else:
                spans[0].attrib["Text"] = plain_text.replace("\n", " ")
                for extra in spans[1:]:
                    extra.attrib["Text"] = ""

        return ET.tostring(embedded_root, encoding="unicode")
    except ET.ParseError:
        return embedded_rich_text_from_plain(plain_text)


def extract_style_from_embedded_text(text_value: str):
    if not text_value or not text_value.strip():
        return {"FontFamily": "Arial", "FontSize": "18"}

    try:
        embedded_root = ET.fromstring(text_value)
        style_el = embedded_root.find(".//Style")
        if style_el is not None and style_el.attrib:
            return dict(style_el.attrib)
    except ET.ParseError:
        pass

    return {"FontFamily": "Arial", "FontSize": "18"}


IGNORE_GUID_REFRESH_TAGS = {"text", "fmtText", "plain", "loc", "bounds", "resize", "margins", "textMargin", "alt"}


def refresh_ids_recursively(elem: ET.Element):
    if elem.tag not in IGNORE_GUID_REFRESH_TAGS:
        if "g" in elem.attrib:
            elem.attrib["g"] = new_uuid()
        if "verG" in elem.attrib:
            elem.attrib["verG"] = new_uuid()

    for attr_name in ("copiedG", "assetG", "layoutG", "stateG", "trigG", "actionG", "varG", "defVarG"):
        if attr_name in elem.attrib and elem.attrib[attr_name] != "00000000-0000-0000-0000-000000000000":
            elem.attrib[attr_name] = new_uuid()

    for child in list(elem):
        refresh_ids_recursively(child)


def find_template_textbox(shape_list: ET.Element, marker_text: str):
    candidates = []
    for textbox in shape_list.findall("textBox"):
        plain = (textbox.findtext("plain") or "").strip()
        rich = textbox.findtext("text") or ""
        if plain == marker_text or marker_text in rich:
            return textbox
        candidates.append(textbox)

    if candidates:
        return candidates[0]
    return None


def next_shape_id(shape_list: ET.Element) -> int:
    max_id = 0
    for child in list(shape_list):
        raw_id = child.attrib.get("id")
        if raw_id and str(raw_id).isdigit():
            max_id = max(max_id, int(raw_id))
    return max_id + 1


def parse_alt_series(alt_text: str):
    alt_text = (alt_text or "").strip()
    if not alt_text:
        return None, None

    match = ALT_SUFFIX_PATTERN.match(alt_text)
    if not match:
        return alt_text, None

    prefix, number = match.groups()
    return prefix, int(number)


def set_textbox_timing(textbox: ET.Element, start_ms: int, dur_ms: int):
    tm_props = textbox.find("tmProps")
    if tm_props is not None:
        tm_props.attrib["cur"] = "0"

    tm_ctx = textbox.find("./tmCtxLst/txtTmCtx")
    if tm_ctx is None:
        tm_ctx_lst = textbox.find("tmCtxLst")
        if tm_ctx_lst is None:
            tm_ctx_lst = ET.SubElement(textbox, "tmCtxLst", {"version": "2"})
        tm_ctx = ET.SubElement(tm_ctx_lst, "txtTmCtx")

    tm_ctx.attrib.update(
        {
            "g": new_uuid(),
            "verG": new_uuid(),
            "start": str(start_ms),
            "dur": str(max(0, dur_ms)),
            "min": "125",
            "max": "0",
            "hasMax": "false",
            "alwysShw": "false",
            "untilEnd": "false",
            "assetStart": "0",
            "name": "",
        }
    )


def set_textbox_text(textbox: ET.Element, plain_text: str, style_attrs=None):
    text_el = textbox.find("text")
    current_rich = text_el.text if text_el is not None else ""
    updated_rich = update_existing_embedded_text(current_rich, plain_text)
    if text_el is None:
        text_el = ET.SubElement(textbox, "text")
    text_el.text = updated_rich

    fmt_text_el = textbox.find("fmtText")
    if fmt_text_el is not None:
        fmt_text_el.text = update_existing_embedded_text(fmt_text_el.text or "", plain_text)

    plain_el = textbox.find("plain")
    if plain_el is None:
        plain_el = ET.SubElement(textbox, "plain")
    plain_el.text = plain_text

    morph_key = textbox.find("./propBag/prop[key='morphKey']/val/str")
    if morph_key is not None:
        morph_key.text = random_morph_key()


def set_textbox_alt(textbox: ET.Element, alt_text: str):
    alt_el = textbox.find("alt")
    if alt_el is None:
        alt_el = ET.SubElement(textbox, "alt")
    alt_el.text = alt_text


def update_trigger_js_targets(textbox: ET.Element, alt_text: str):
    for trig in textbox.findall("./trigLst/trig"):
        other = trig.find("./data/other")
        if other is None:
            continue

        js_code = other.attrib.get("js", "")
        if not js_code:
            continue

        js_code = DATA_ACC_PATTERN_SINGLE.sub(rf"\1{alt_text}\3", js_code)
        js_code = DATA_ACC_PATTERN_DOUBLE.sub(rf"\1{alt_text}\3", js_code)
        other.attrib["js"] = js_code


def update_slide_duration(root: ET.Element, total_ms: int):
    total_ms = max(total_ms, 1000)

    root_tm_props = root.find("tmProps")
    if root_tm_props is not None:
        current_min = int(root_tm_props.attrib.get("min", "0") or "0")
        root_tm_props.attrib["min"] = str(max(current_min, total_ms))

    pan_tm_props = root.find("./panTime/tmProps")
    if pan_tm_props is not None:
        current_min = int(pan_tm_props.attrib.get("min", "0") or "0")
        pan_tm_props.attrib["min"] = str(max(current_min, total_ms))


def indent_xml(elem, level=0):
    indent_str = "  "
    i = "\n" + level * indent_str
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = i + indent_str
        for child in elem:
            indent_xml(child, level + 1)
        if not elem[-1].tail or not elem[-1].tail.strip():
            elem[-1].tail = i
    if level and (not elem.tail or not elem.tail.strip()):
        elem.tail = i


class StorylineSrtApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Storyline SRT → slide.xml")
        self.root.geometry("760x450")

        self.slide_path = tk.StringVar()
        self.srt_path = tk.StringVar()
        self.output_path = tk.StringVar()
        self.marker_text = tk.StringVar(value="texte_1")
        self.remove_template = tk.BooleanVar(value=True)
        self.status_text = tk.StringVar(value="Sélectionne un slide.xml et un .srt.")

        self.build_ui()

    def build_ui(self):
        frame = ttk.Frame(self.root, padding=16)
        frame.pack(fill="both", expand=True)
        frame.columnconfigure(1, weight=1)

        ttk.Label(frame, text="slide.xml source").grid(row=0, column=0, sticky="w", pady=(0, 6))
        ttk.Entry(frame, textvariable=self.slide_path).grid(row=0, column=1, sticky="ew", padx=8, pady=(0, 6))
        ttk.Button(frame, text="Parcourir", command=self.pick_slide).grid(row=0, column=2, pady=(0, 6))

        ttk.Label(frame, text="Fichier .srt").grid(row=1, column=0, sticky="w", pady=6)
        ttk.Entry(frame, textvariable=self.srt_path).grid(row=1, column=1, sticky="ew", padx=8, pady=6)
        ttk.Button(frame, text="Parcourir", command=self.pick_srt).grid(row=1, column=2, pady=6)

        ttk.Label(frame, text="Fichier de sortie").grid(row=2, column=0, sticky="w", pady=6)
        ttk.Entry(frame, textvariable=self.output_path).grid(row=2, column=1, sticky="ew", padx=8, pady=6)
        ttk.Button(frame, text="Choisir", command=self.pick_output).grid(row=2, column=2, pady=6)

        ttk.Label(frame, text="Texte repère du bloc modèle").grid(row=3, column=0, sticky="w", pady=6)
        ttk.Entry(frame, textvariable=self.marker_text).grid(row=3, column=1, sticky="ew", padx=8, pady=6)

        ttk.Checkbutton(
            frame,
            text="Supprimer le bloc modèle après génération",
            variable=self.remove_template,
        ).grid(row=4, column=0, columnspan=3, sticky="w", pady=(8, 12))

        help_text = (
            "Fonctionnement : le script cherche un textBox modèle dans le slide.xml, idéalement celui dont le texte\n"
            "correspond au repère ci-dessus (par défaut : 'texte_1'). Il clone ensuite ce bloc pour chaque segment\n"
            "du .srt, conserve son style/position/trigger/alt, puis remplace le texte, le timing et la cible anim-par-X."
        )
        ttk.Label(frame, text=help_text, justify="left").grid(row=5, column=0, columnspan=3, sticky="w", pady=(0, 12))

        ttk.Button(frame, text="Générer le slide.xml", command=self.run_conversion).grid(row=6, column=0, columnspan=3, sticky="ew", pady=(8, 12))

        status_box = ttk.LabelFrame(frame, text="État")
        status_box.grid(row=7, column=0, columnspan=3, sticky="nsew")
        status_box.columnconfigure(0, weight=1)
        frame.rowconfigure(7, weight=1)

        self.status_label = ttk.Label(status_box, textvariable=self.status_text, justify="left")
        self.status_label.grid(row=0, column=0, sticky="nw", padx=10, pady=10)

    def pick_slide(self):
        path = filedialog.askopenfilename(
            title="Choisir le slide.xml",
            filetypes=[("Fichiers XML", "*.xml"), ("Tous les fichiers", "*.*")],
        )
        if path:
            self.slide_path.set(path)
            if not self.output_path.get().strip():
                base, ext = os.path.splitext(path)
                self.output_path.set(f"{base}_from_srt{ext or '.xml'}")

    def pick_srt(self):
        path = filedialog.askopenfilename(
            title="Choisir le fichier .srt",
            filetypes=[("Sous-titres SRT", "*.srt"), ("Tous les fichiers", "*.*")],
        )
        if path:
            self.srt_path.set(path)

    def pick_output(self):
        path = filedialog.asksaveasfilename(
            title="Choisir le fichier de sortie",
            defaultextension=".xml",
            filetypes=[("Fichiers XML", "*.xml"), ("Tous les fichiers", "*.*")],
        )
        if path:
            self.output_path.set(path)

    def run_conversion(self):
        # Pipeline:
        # 1) lire le .srt
        # 2) charger le slide.xml
        # 3) cloner un textBox modèle pour chaque cue
        # 4) réécrire texte/timing/alt/JS
        # 5) ajuster la durée de slide puis sauvegarder
        slide_path = self.slide_path.get().strip()
        srt_path = self.srt_path.get().strip()
        output_path = self.output_path.get().strip()
        marker_text = self.marker_text.get().strip() or "texte_1"

        if not slide_path or not os.path.isfile(slide_path):
            messagebox.showerror("Erreur", "Sélectionne un slide.xml valide.")
            return
        if not srt_path or not os.path.isfile(srt_path):
            messagebox.showerror("Erreur", "Sélectionne un fichier .srt valide.")
            return
        if not output_path:
            messagebox.showerror("Erreur", "Choisis un fichier de sortie.")
            return

        try:
            cues = parse_srt(srt_path)
            tree = ET.parse(slide_path)
            root = tree.getroot()
            shape_list = root.find("shapeLst")
            if shape_list is None:
                raise ValueError("Aucun <shapeLst> trouvé dans le slide.xml.")

            template = find_template_textbox(shape_list, marker_text)
            if template is None:
                raise ValueError(
                    "Aucun textBox modèle trouvé. Ajoute un bloc texte modèle dans le slide ou change le texte repère."
                )

            style_attrs = extract_style_from_embedded_text(template.findtext("text") or "")
            template_alt = template.findtext("alt") or ""
            alt_prefix, alt_start_num = parse_alt_series(template_alt)
            insert_index = list(shape_list).index(template)
            next_id = next_shape_id(shape_list)
            created = []

            for i, cue in enumerate(cues):
                new_box = copy.deepcopy(template)
                refresh_ids_recursively(new_box)
                new_box.attrib["id"] = str(next_id)
                new_box.attrib["zOrder"] = str(next_id - 1)
                next_id += 1

                next_start = cues[i + 1]["start_ms"] if i + 1 < len(cues) else cue["end_ms"]
                effective_end = min(cue["end_ms"], next_start)
                effective_dur = max(0, effective_end - cue["start_ms"])

                set_textbox_text(new_box, cue["text"], style_attrs=style_attrs)
                set_textbox_timing(new_box, cue["start_ms"], effective_dur)

                if alt_prefix is not None and alt_start_num is not None:
                    alt_text = f"{alt_prefix}{alt_start_num + i}"
                    set_textbox_alt(new_box, alt_text)
                    update_trigger_js_targets(new_box, alt_text)

                created.append(new_box)
                shape_list.insert(insert_index + i + 1, new_box)

            if self.remove_template.get():
                shape_list.remove(template)

            last_end = max(cue["end_ms"] for cue in cues)
            update_slide_duration(root, last_end)
            indent_xml(root)
            tree.write(output_path, encoding="utf-8", xml_declaration=True)

            alt_info = (
                f"\nAlt/JS incrémentés depuis : {template_alt}"
                if template_alt else
                "\nAucun alt de série détecté sur le bloc modèle."
            )
            self.status_text.set(
                f"Succès : {len(created)} blocs créés.\n"
                f"Fichier généré : {output_path}\n"
                f"Bloc modèle utilisé : '{marker_text}'\n"
                f"Durée minimale de slide ajustée à : {last_end} ms"
                f"{alt_info}"
            )
            messagebox.showinfo("Terminé", "Le slide.xml a été généré avec succès.")

        except Exception as exc:
            self.status_text.set(f"Erreur : {exc}")
            messagebox.showerror("Erreur", str(exc))


if __name__ == "__main__":
    root = tk.Tk()
    try:
        from tkinter import TkVersion  # noqa: F401
    except Exception:
        pass
    app = StorylineSrtApp(root)
    root.mainloop()
