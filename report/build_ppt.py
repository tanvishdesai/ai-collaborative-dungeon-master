# -*- coding: utf-8 -*-
"""Builds the Abhyaas capstone presentation (5-6 slides) with python-pptx."""
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IMGS = os.path.join(HERE, "imgs")
OUT = os.path.join(HERE, "Abhyaas_Presentation.pptx")

# ---- theme ----
BG = RGBColor(0x0B, 0x1B, 0x3A)        # deep navy
PANEL = RGBColor(0x13, 0x28, 0x50)      # slightly lighter navy panel
ACCENT = RGBColor(0x3B, 0x82, 0xF6)     # blue accent
ACCENT2 = RGBColor(0x60, 0xA5, 0xFA)    # lighter blue
WHITE = RGBColor(0xF3, 0xF6, 0xFC)
MUTE = RGBColor(0xAF, 0xBE, 0xD8)
FONT = "Segoe UI"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]


def slide():
    s = prs.slides.add_slide(BLANK)
    r = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SW, SH)
    r.fill.solid(); r.fill.fore_color.rgb = BG
    r.line.fill.background()
    r.shadow.inherit = False
    return s


def _set_font(run, size, bold, color, font=FONT):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = font


def textbox(s, l, t, w, h, anchor=MSO_ANCHOR.TOP):
    tb = s.shapes.add_textbox(l, t, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = 0; tf.margin_right = 0
    tf.margin_top = 0; tf.margin_bottom = 0
    return tf


def para(tf, text, size, bold=False, color=WHITE, align=PP_ALIGN.LEFT,
         first=False, space_before=0, space_after=6, bullet=False, level=0):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    p.level = level
    run = p.add_run()
    run.text = text
    _set_font(run, size, bold, color)
    if bullet:
        _bullet(p)
    else:
        _no_bullet(p)
    return p


def _no_bullet(p):
    pPr = p._p.get_or_add_pPr()
    for tag in ("a:buChar", "a:buAutoNum"):
        for e in pPr.findall(qn(tag)):
            pPr.remove(e)
    pPr.append(_el("a:buNone"))


def _bullet(p, color=ACCENT2):
    pPr = p._p.get_or_add_pPr()
    pPr.set("indent", str(-Inches(0.26)))
    pPr.set("marL", str(Inches(0.26)))
    buFont = _el("a:buFont"); buFont.set("typeface", "Arial")
    buChar = _el("a:buChar"); buChar.set("char", "•")
    pPr.append(buFont); pPr.append(buChar)


def _el(tag):
    from lxml import etree
    from pptx.oxml import parse_xml
    from pptx.oxml.ns import nsmap
    return parse_xml('<%s xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>' % tag)


def header(s, kicker, title):
    # accent bar
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.6), Inches(0.55), Inches(0.16), Inches(0.95))
    bar.fill.solid(); bar.fill.fore_color.rgb = ACCENT
    bar.line.fill.background(); bar.shadow.inherit = False
    tf = textbox(s, Inches(0.95), Inches(0.5), Inches(11.5), Inches(1.1))
    para(tf, kicker, 13, bold=True, color=ACCENT2, first=True, space_after=2)
    para(tf, title, 30, bold=True, color=WHITE, space_after=0)


def panel(s, l, t, w, h, color=PANEL):
    r = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, l, t, w, h)
    r.fill.solid(); r.fill.fore_color.rgb = color
    r.line.color.rgb = ACCENT; r.line.width = Pt(0.75)
    r.shadow.inherit = False
    try:
        r.adjustments[0] = 0.05
    except Exception:
        pass
    return r


def add_image_fit(s, path, l, t, w, h):
    """Place image within box (l,t,w,h) preserving aspect, centered."""
    iw, ih = Image.open(path).size
    box_r = w / h
    img_r = iw / ih
    if img_r > box_r:
        nw = w; nh = int(w / img_r)
    else:
        nh = h; nw = int(h * img_r)
    nl = l + (w - nw) // 2
    nt = t + (h - nh) // 2
    pic = s.shapes.add_picture(path, nl, nt, nw, nh)
    pic.line.color.rgb = ACCENT
    pic.line.width = Pt(1)
    return pic


# ======================================================================
# SLIDE 1 — TITLE
# ======================================================================
s = slide()
# decorative accent image on the right as a band
try:
    bg = os.path.join(IMGS, "Gemini_Generated_Image_cs64sacs64sacs64.png")
    pic = s.shapes.add_picture(bg, Inches(8.7), 0, height=SH)
    # dark overlay to keep text readable / blend
    ov = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(8.4), 0, Inches(5.0), SH)
    ov.fill.solid(); ov.fill.fore_color.rgb = BG
    ov.line.fill.background(); ov.shadow.inherit = False
    ov.fill.transparency = 0  # solid; we instead gradient-fade via smaller strip
except Exception:
    pass
# left accent bar
bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(2.35), Inches(2.2), Inches(0.14))
bar.fill.solid(); bar.fill.fore_color.rgb = ACCENT
bar.line.fill.background(); bar.shadow.inherit = False

tf = textbox(s, Inches(0.9), Inches(2.6), Inches(11.2), Inches(3.0))
para(tf, "Abhyaas", 60, bold=True, color=WHITE, first=True, space_after=0)
para(tf, "AI Placement Practice Simulator", 30, bold=True, color=ACCENT2, space_after=14)
para(tf, "Realistic AI-driven practice for campus placement panel interviews & group discussions",
     18, bold=False, color=MUTE, space_after=0)

tf2 = textbox(s, Inches(0.9), Inches(6.4), Inches(11.2), Inches(0.7))
para(tf2, "Capstone Project  |  LDRP-ITR  —  Information Technology Department",
     15, bold=True, color=WHITE, first=True, space_after=2)
para(tf2, "Author: [Student Name]   |   Guide: [Guide Name]", 12, color=MUTE, space_after=0)

# ======================================================================
# SLIDE 2 — PROBLEM & MOTIVATION
# ======================================================================
s = slide()
header(s, "PROBLEM & MOTIVATION", "The two rounds students can't rehearse")
tf = textbox(s, Inches(0.95), Inches(1.85), Inches(11.4), Inches(0.9))
para(tf, "Panel interviews and group discussions decide most placement offers — yet they are the "
     "hardest rounds to practise, because each one needs several people in the room.",
     16, color=MUTE, first=True, space_after=0)

# two problem cards
cw = Inches(5.6); ch = Inches(1.6); gap = Inches(0.2)
lx = Inches(0.95)
panel(s, lx, Inches(2.9), cw, ch)
tf = textbox(s, lx + Inches(0.3), Inches(3.05), cw - Inches(0.6), ch - Inches(0.3), MSO_ANCHOR.MIDDLE)
para(tf, "Practice can't scale", 17, bold=True, color=ACCENT2, first=True, space_after=4)
para(tf, "Faculty hours are finite, so individual mock panels are rare and handed out unevenly across a batch.",
     14, color=WHITE, space_after=0)

panel(s, lx + cw + gap, Inches(2.9), cw, ch)
tf = textbox(s, lx + cw + gap + Inches(0.3), Inches(3.05), cw - Inches(0.6), ch - Inches(0.3), MSO_ANCHOR.MIDDLE)
para(tf, "Decisive rounds are multi-person", 17, bold=True, color=ACCENT2, first=True, space_after=4)
para(tf, "A panel needs a panel and a discussion needs a group — a student alone the night before a drive has neither.",
     14, color=WHITE, space_after=0)

panel(s, lx, Inches(4.75), Inches(11.4), Inches(2.15))
tf = textbox(s, lx + Inches(0.35), Inches(4.95), Inches(10.7), Inches(1.8))
para(tf, "Why existing AI tools fall short", 17, bold=True, color=ACCENT2, first=True, space_after=8)
for b in [
    "Single-player by design (Yoodli, Google Interview Warmup, Final Round AI) — they can't stage a panel or a discussion.",
    "No memory — disconnected questions, none of the follow-up pressure where a real interview turns uncomfortable.",
    "A pure-LLM system has no reliable sense of turn, stage or score, so behaviour drifts and can't be audited.",
    "Feedback is a vague impression, not a per-competency read a student can act on.",
]:
    para(tf, b, 14, color=WHITE, bullet=True, space_after=5)

# ======================================================================
# SLIDE 3 — SOLUTION / KEY FEATURES
# ======================================================================
s = slide()
header(s, "THE SOLUTION", "Two real rounds, on demand — measured")
# left: features
lx = Inches(0.95); ftop = Inches(1.95); fw = Inches(6.0)
tf = textbox(s, lx, ftop, fw, Inches(5.0))
feats = [
    ("Panel Interview mode", "Rotating panel of three AI personas — HR Manager, Technical Lead, Senior Manager."),
    ("Group Discussion mode", "Participants argue a topic under an AI moderator that keeps it fair and scores each person."),
    ("Memory-aware follow-ups", "Each persona remembers earlier answers and probes them for real interview pressure."),
    ("Escalating difficulty", "Questions get harder as the session goes on, just like the real thing."),
    ("Scored feedback reports", "Per-competency scores (1–5) with justifications + objective engine-computed metrics."),
    ("Real-time multiplayer", "Live for everyone connected via Convex reactive queries — no separate socket layer."),
]
first = True
for title, desc in feats:
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    first = False
    p.space_after = Pt(9)
    p.alignment = PP_ALIGN.LEFT
    r1 = p.add_run(); r1.text = title + "  "
    _set_font(r1, 15, True, ACCENT2)
    r2 = p.add_run(); r2.text = "— " + desc
    _set_font(r2, 13.5, False, WHITE)
    _bullet(p)

# right: dashboard screenshot in a panel
px = Inches(7.25); pt = Inches(1.95); pw = Inches(5.4); ph = Inches(4.6)
panel(s, px, pt, pw, ph)
add_image_fit(s, os.path.join(IMGS, "screenshot_dashboard.png"),
              px + Inches(0.15), pt + Inches(0.15), pw - Inches(0.3), ph - Inches(0.65))
cap = textbox(s, px, pt + ph - Inches(0.45), pw, Inches(0.4), MSO_ANCHOR.MIDDLE)
para(cap, "Dashboard — session setup", 12, bold=True, color=MUTE, align=PP_ALIGN.CENTER, first=True, space_after=0)

# ======================================================================
# SLIDE 4 — ARCHITECTURE
# ======================================================================
s = slide()
header(s, "ARCHITECTURE", "Engine owns state — the LLM only writes")
tf = textbox(s, Inches(0.95), Inches(1.8), Inches(11.4), Inches(0.7))
para(tf, "A deterministic session engine owns all canonical state and flow (turns, stages, difficulty, scoring). "
     "The LLM is confined to writing questions, prompts and feedback prose — it never mutates canonical state.",
     15, color=MUTE, first=True, space_after=0)

# diagram: three boxes with arrows
dy = Inches(2.75); bh = Inches(1.35); bw = Inches(3.35)
b1x = Inches(0.95); b2x = Inches(4.99); b3x = Inches(9.03)


def dbox(x, title, lines, fill, tcolor=WHITE):
    r = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, dy, bw, bh)
    r.fill.solid(); r.fill.fore_color.rgb = fill
    r.line.color.rgb = ACCENT; r.line.width = Pt(1.25); r.shadow.inherit = False
    tf = r.text_frame; tf.word_wrap = True
    tf.margin_left = Inches(0.15); tf.margin_right = Inches(0.15)
    para(tf, title, 15, bold=True, color=tcolor, first=True, align=PP_ALIGN.CENTER, space_after=3)
    for ln in lines:
        para(tf, ln, 11.5, color=tcolor, align=PP_ALIGN.CENTER, space_after=1)
    return r


dbox(b1x, "Frontend", ["Next.js (App Router) + TypeScript", "Tailwind CSS · reactive UI"], PANEL)
dbox(b2x, "Session Engine (Convex)", ["Deterministic: turns, stages,", "difficulty, scoring, wrap-up"], RGBColor(0x1E, 0x3A, 0x6E))
dbox(b3x, "LLM — writes prose only", ["Gemini (Groq / NVIDIA fallback)", "questions · prompts · feedback"], PANEL)


def arrow(x1, x2, label):
    a = s.shapes.add_shape(MSO_SHAPE.LEFT_RIGHT_ARROW, x1, dy + Inches(0.5), x2 - x1, Inches(0.35))
    a.fill.solid(); a.fill.fore_color.rgb = ACCENT2
    a.line.fill.background(); a.shadow.inherit = False


arrow(b1x + bw, b2x, "")
arrow(b2x + bw, b3x, "")
# note under middle box
tf = textbox(s, b2x - Inches(0.3), dy + bh + Inches(0.12), bw + Inches(0.6), Inches(0.5))
para(tf, "Owns canonical state — the LLM never touches it", 12, bold=True, color=ACCENT2,
     align=PP_ALIGN.CENTER, first=True, space_after=0)

# stack row + screenshot
sy = Inches(4.95)
panel(s, Inches(0.95), sy, Inches(6.3), Inches(2.05))
tf = textbox(s, Inches(1.25), sy + Inches(0.18), Inches(5.8), Inches(1.7))
para(tf, "Stack", 15, bold=True, color=ACCENT2, first=True, space_after=6)
for b in [
    "Frontend: Next.js (App Router), TypeScript, Tailwind CSS",
    "Backend: Convex — schema, queries, mutations, actions, scheduling",
    "Auth: @convex-dev/auth (email + password)",
    "AI: Google Gemini with Groq / NVIDIA fallbacks",
]:
    para(tf, b, 13, color=WHITE, bullet=True, space_after=4)

px = Inches(7.45); pw = Inches(5.2); ph = Inches(2.05)
panel(s, px, sy, pw, ph)
add_image_fit(s, os.path.join(IMGS, "screenshot_session.png"),
              px + Inches(0.15), sy + Inches(0.15), pw - Inches(0.3), ph - Inches(0.5))
cap = textbox(s, px, sy + ph - Inches(0.38), pw, Inches(0.35), MSO_ANCHOR.MIDDLE)
para(cap, "Live panel interview session", 11, bold=True, color=MUTE, align=PP_ALIGN.CENTER, first=True, space_after=0)

# ======================================================================
# SLIDE 5 — RESULTS / FEEDBACK REPORT
# ======================================================================
s = slide()
header(s, "RESULTS", "Objective, rubric-scored feedback")
# left text
lx = Inches(0.95)
tf = textbox(s, lx, Inches(1.95), Inches(6.0), Inches(5.0))
para(tf, "At session end each candidate gets a report a plain chatbot cannot produce:",
     15, color=MUTE, first=True, space_after=10)
for b in [
    "Per-competency scores (1–5) each with a written justification",
    "Highlighted strengths and concrete areas to improve",
    "Overall score (0–100) and a narrative summary",
]:
    para(tf, b, 14.5, color=WHITE, bullet=True, space_after=7)
para(tf, "Objective engine-computed metrics", 15, bold=True, color=ACCENT2, space_before=8, space_after=6)
for b in [
    "Questions answered",
    "Competencies covered / total",
    "Average answer length (words)",
]:
    para(tf, b, 14.5, color=WHITE, bullet=True, space_after=6)

# right screenshot (report is taller ~ portrait-ish)
px = Inches(7.25); pt = Inches(1.9); pw = Inches(5.4); ph = Inches(4.9)
panel(s, px, pt, pw, ph)
add_image_fit(s, os.path.join(IMGS, "screenshot_report.png"),
              px + Inches(0.15), pt + Inches(0.15), pw - Inches(0.3), ph - Inches(0.6))
cap = textbox(s, px, pt + ph - Inches(0.42), pw, Inches(0.35), MSO_ANCHOR.MIDDLE)
para(cap, "Scored feedback report", 12, bold=True, color=MUTE, align=PP_ALIGN.CENTER, first=True, space_after=0)

# ======================================================================
# SLIDE 6 — CONCLUSION & FUTURE WORK
# ======================================================================
s = slide()
header(s, "CONCLUSION & FUTURE WORK", "What we built, and what's next")
panel(s, Inches(0.95), Inches(1.95), Inches(5.6), Inches(4.9))
tf = textbox(s, Inches(1.25), Inches(2.15), Inches(5.0), Inches(4.5))
para(tf, "Summary", 17, bold=True, color=ACCENT2, first=True, space_after=8)
for b in [
    "The two hardest rounds to rehearse — panel interview & group discussion — simulated realistically.",
    "A deterministic engine paired with an LLM kept to prose keeps sessions consistent and auditable.",
    "Multi-person practice, interviewers that remember, optional résumé grounding, live for all.",
    "Objective, per-competency feedback plus hard metrics — evidence, not just a transcript.",
]:
    para(tf, b, 14, color=WHITE, bullet=True, space_after=8)

panel(s, Inches(6.75), Inches(1.95), Inches(5.6), Inches(4.9))
tf = textbox(s, Inches(7.05), Inches(2.15), Inches(5.0), Inches(4.5))
para(tf, "Future Work", 17, bold=True, color=ACCENT2, first=True, space_after=8)
for b in [
    "Voice & video analysis to judge delivery and body language",
    "Richer analytics and a cohort-readiness dashboard for the placement cell",
    "More interview domains and target roles",
    "Mobile experience",
    "A larger before-and-after study to quantify improvement over repeated practice",
]:
    para(tf, b, 14, color=WHITE, bullet=True, space_after=9)

prs.save(OUT)
print("SAVED:", OUT, "slides:", len(prs.slides._sldIdLst))
