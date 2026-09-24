# -*- coding: utf-8 -*-
"""
Generates the Abhyaas project report (back pages, Chapters 1-6) as a .docx that
matches the institutional format shown in the StrideX reference report:
Times New Roman, chapter divider pages, blue-shaded bordered tables,
figure placeholders, and an "LDRP-ITR / IT Department" footer with page numbers.
"""
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_LINE_SPACING, WD_TAB_LEADER
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

SHORT = "Abhyaas"
FONT = "Times New Roman"
HEAD_BLUE = "B8CCE4"   # table header shading (light blue, like the reference)

doc = Document()

# ---- base style ----
normal = doc.styles["Normal"]
normal.font.name = FONT
normal.font.size = Pt(12)
normal.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.15

# ---- page geometry ----
sec = doc.sections[0]
sec.page_height = Inches(11.69)   # A4
sec.page_width = Inches(8.27)
sec.top_margin = Inches(1.0)
sec.bottom_margin = Inches(1.0)
sec.left_margin = Inches(1.25)
sec.right_margin = Inches(1.0)
CONTENT_WIDTH = sec.page_width - sec.left_margin - sec.right_margin  # ~6.02"


def set_run(run, size=12, bold=False, italic=False, color=None):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    r = run._element
    r.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    return run


def _field(paragraph, instr):
    """Insert a Word field (e.g. PAGE) into a paragraph."""
    run = paragraph.add_run()
    fldChar1 = OxmlElement("w:fldChar"); fldChar1.set(qn("w:fldCharType"), "begin")
    instrText = OxmlElement("w:instrText"); instrText.set(qn("xml:space"), "preserve")
    instrText.text = instr
    fldChar2 = OxmlElement("w:fldChar"); fldChar2.set(qn("w:fldCharType"), "end")
    run._r.append(fldChar1); run._r.append(instrText); run._r.append(fldChar2)
    set_run(run, size=11)


# ---- header ----
hp = sec.header.paragraphs[0]
hp.text = ""
set_run(hp.add_run(SHORT), size=11)
hp.alignment = WD_ALIGN_PARAGRAPH.LEFT

# ---- footer: "LDRP-ITR" + right-aligned page number, then "IT Department" ----
sec.footer.is_linked_to_previous = False
fp = sec.footer.paragraphs[0]
fp.text = ""
tab_stops = fp.paragraph_format.tab_stops
tab_stops.add_tab_stop(CONTENT_WIDTH, WD_TAB_ALIGNMENT.RIGHT)
set_run(fp.add_run("LDRP-ITR"), size=11)
fp.add_run("\t")
_field(fp, "PAGE")
fp2 = sec.footer.add_paragraph()
set_run(fp2.add_run("IT Department"), size=11)


def body(text, justify=True, space_after=8):
    p = doc.add_paragraph()
    set_run(p.add_run(text), size=12)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY if justify else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(space_after)
    return p


def bullet(parts, size=12, space_after=4):
    """parts: str, or (lead_bold, rest) tuple."""
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(space_after)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if isinstance(parts, tuple):
        lead, rest = parts
        set_run(p.add_run(lead + ": "), size=size, bold=True)
        set_run(p.add_run(rest), size=size)
    else:
        set_run(p.add_run(parts), size=size)
    return p


def labeled(label, text, size=12, space_after=4):
    """A non-bulleted 'Label:' line then indented content used inside sub-sections."""
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    set_run(p.add_run(label + ": "), size=size, bold=True)
    set_run(p.add_run(text), size=size)
    return p


def sublabel(text, size=12):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(2)
    set_run(p.add_run(text), size=size, bold=True)
    return p


def chapter(num, title, sections):
    """Chapter divider page: big heading + list of section titles, then a page break."""
    if num > 1:
        doc.add_page_break()
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(18)
    p.paragraph_format.space_before = Pt(6)
    set_run(p.add_run(f"{num}"), size=16, bold=True)
    p.add_run("\t")
    set_run(p.add_run(title), size=16, bold=True)
    p.paragraph_format.tab_stops.add_tab_stop(Inches(0.5))
    _outline(p, 0)
    for sn, st in sections:
        sp = doc.add_paragraph()
        sp.paragraph_format.space_after = Pt(8)
        set_run(sp.add_run(f"{sn}  "), size=13, bold=True)
        set_run(sp.add_run(st), size=13, bold=True)
    doc.add_page_break()


def section(num, title):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(8)
    set_run(p.add_run(f"{num}. {title}"), size=14, bold=True)
    _outline(p, 1)
    return p


def subsection(num, title):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(4)
    set_run(p.add_run(f"{num}. {title}"), size=12.5, bold=True)
    _outline(p, 2)
    return p


def _set_cell_border(cell):
    tcPr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        e = OxmlElement(f"w:{edge}")
        e.set(qn("w:val"), "single"); e.set(qn("w:sz"), "4")
        e.set(qn("w:space"), "0"); e.set(qn("w:color"), "000000")
        borders.append(e)
    tcPr.append(borders)


def _shade_cell(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hexcolor)
    tcPr.append(shd)


def _cell_text(cell, text, bold=False, size=10.5, align=None):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.space_before = Pt(2)
    if align:
        p.alignment = align
    set_run(p.add_run(text), size=size, bold=bold)


def table(headers, rows, caption, widths=None, caption_num=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        _cell_text(hdr[i], h, bold=True, size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER)
        _shade_cell(hdr[i], HEAD_BLUE)
        _set_cell_border(hdr[i])
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            _cell_text(cells[i], val, size=10.5)
            _set_cell_border(cells[i])
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Inches(w)
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_before = Pt(4)
    cap.paragraph_format.space_after = Pt(12)
    set_run(cap.add_run(caption), size=11, bold=True)
    _tbl_n[0] += 1
    _bookmark(cap, f"tblbm{_tbl_n[0]}")
    return t


import os
IMGS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "imgs")


def figure(img_filename, caption, width=6.0):
    """Embed a centered image scaled to `width` inches, with a bold caption below."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run()
    run.add_picture(os.path.join(IMGS, img_filename), width=Inches(width))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_before = Pt(2)
    cap.paragraph_format.space_after = Pt(12)
    set_run(cap.add_run(caption), size=11, bold=True)
    _fig_n[0] += 1
    _bookmark(cap, f"figbm{_fig_n[0]}")


# system rows shared by every Convex table
SYS = [
    ("_id", "ID (auto)", "PRIMARY KEY, Auto-generated", "Unique document identifier."),
    ("_creationTime", "Number (auto)", "Auto-generated", "Unix timestamp of record creation."),
]

# ======================================================================
# FRONT MATTER  (title, certificate, acknowledgement, abstract, TOC, LoF, LoT)
# ======================================================================
CENTER = WD_ALIGN_PARAGRAPH.CENTER
_fig_n = [0]
_tbl_n = [0]
_bm_seq = [0]

FIG_ENTRIES = [
    ("Figure 4.1", "Entity-Relationship Diagram"),
    ("Figure 4.2", "Class Diagram"),
    ("Figure 4.3", "Use Case Diagram"),
    ("Figure 4.4", "Sequence Diagram"),
    ("Figure 4.5", "Activity Diagram"),
    ("Figure 4.6.1", "Context-Level-0 Data Flow Diagram"),
    ("Figure 4.6.2", "Context-Level-1 Data Flow Diagram"),
    ("Figure 6.1", "Dashboard (creating a session)"),
    ("Figure 6.2", "Live panel interview session"),
    ("Figure 6.3", "Rubric-scored feedback report"),
]
TBL_ENTRIES = [
    ("Table 1", "sessions table schema"),
    ("Table 2", "participants table schema"),
    ("Table 3", "profiles table schema"),
    ("Table 4", "personas table schema"),
    ("Table 5", "personaMemories table schema"),
    ("Table 6", "sessionState table schema"),
    ("Table 7", "transcript table schema"),
    ("Table 8", "responses table schema"),
    ("Table 9", "feedbackReports table schema"),
]


def _outline(p, lvl):
    pPr = p._p.get_or_add_pPr()
    o = OxmlElement("w:outlineLvl"); o.set(qn("w:val"), str(lvl))
    pPr.append(o)


def _bookmark(paragraph, name):
    _bm_seq[0] += 1
    bid = str(_bm_seq[0])
    start = OxmlElement("w:bookmarkStart"); start.set(qn("w:id"), bid); start.set(qn("w:name"), name)
    end = OxmlElement("w:bookmarkEnd"); end.set(qn("w:id"), bid)
    paragraph._p.insert(0, start)
    paragraph._p.append(end)


def _field_run(paragraph, instr, placeholder="", size=12):
    run = paragraph.add_run()
    b = OxmlElement("w:fldChar"); b.set(qn("w:fldCharType"), "begin")
    i = OxmlElement("w:instrText"); i.set(qn("xml:space"), "preserve"); i.text = instr
    s = OxmlElement("w:fldChar"); s.set(qn("w:fldCharType"), "separate")
    t = OxmlElement("w:t"); t.set(qn("xml:space"), "preserve"); t.text = placeholder
    e = OxmlElement("w:fldChar"); e.set(qn("w:fldCharType"), "end")
    for el in (b, i, s, t, e):
        run._r.append(el)
    set_run(run, size=size)
    return run


def _pgnum(section, fmt=None, start=None):
    sectPr = section._sectPr
    pg = sectPr.find(qn("w:pgNumType"))
    if pg is None:
        pg = OxmlElement("w:pgNumType"); sectPr.append(pg)
    if fmt:
        pg.set(qn("w:fmt"), fmt)
    if start is not None:
        pg.set(qn("w:start"), str(start))


def fc(text, size=12, bold=True, before=0, after=6, italic=False):
    p = doc.add_paragraph(); p.alignment = CENTER
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    set_run(p.add_run(text), size=size, bold=bold, italic=italic)
    return p


def gap(n=1):
    for _ in range(n):
        doc.add_paragraph()


def dot_row(left, bookmark):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.tab_stops.add_tab_stop(
        CONTENT_WIDTH, WD_TAB_ALIGNMENT.RIGHT, leader=WD_TAB_LEADER.DOTS)
    set_run(p.add_run(left), size=12)
    p.add_run("\t")
    _field_run(p, f" PAGEREF {bookmark} \\h ", "1")


# front-matter section: clean title page, lower-roman page numbers
sec.different_first_page_header_footer = True
_pgnum(sec, fmt="lowerRoman", start=1)

# ---- Title page ----
gap(2)
fc("ABHYAAS", size=28, after=4)
fc("An AI-Powered Placement Interview and Group Discussion Practice Simulator",
   size=15, after=18)
fc("A PROJECT REPORT", size=13, after=4)
fc("Submitted by", size=12, bold=False, after=4)
fc("TANVISH DESAI  (Enrollment No. ____________)", size=13, after=14)
fc("in partial fulfillment for the award of the degree of", size=12, bold=False, after=4)
fc("BACHELOR OF ENGINEERING", size=14, after=4)
fc("in", size=12, bold=False, after=4)
fc("Information Technology", size=13, after=18)
fc("[ Institute logo ]", size=11, bold=False, italic=True, after=18)
fc("LDRP Institute of Technology and Research, Gandhinagar", size=13, after=2)
fc("Kadi Sarva Vishwavidyalaya", size=13, after=16)
fc("[Month] 2026", size=12, bold=False)
doc.add_page_break()

# ---- Certificate ----
fc("LDRP Institute of Technology and Research, Gandhinagar", size=13, after=2)
fc("CE-IT Department", size=13, after=18)
fc("CERTIFICATE", size=16, after=16)
cp = doc.add_paragraph(); cp.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
cp.paragraph_format.line_spacing = 1.5
set_run(cp.add_run("This is to certify that the Project Work entitled "), size=12)
set_run(cp.add_run('"Abhyaas: An AI-Powered Placement Interview and Group Discussion '
                   'Practice Simulator" '), size=12, bold=True)
set_run(cp.add_run(
    "has been carried out by Tanvish Desai (Enrollment No. ____________) under my guidance in "
    "fulfilment of the degree of Bachelor of Engineering in Information Technology, Semester-7 "
    "of Kadi Sarva Vishwavidyalaya during the academic year 2026-2027."), size=12)
gap(4)
for a, b in [("____________________", "____________________"),
             ("Name of Guide", "Name of HOD"),
             ("Internal Guide", "Head of the Department")]:
    r = doc.add_paragraph()
    r.paragraph_format.space_after = Pt(2)
    r.paragraph_format.tab_stops.add_tab_stop(CONTENT_WIDTH, WD_TAB_ALIGNMENT.RIGHT)
    set_run(r.add_run(a), size=12)
    r.add_run("\t")
    set_run(r.add_run(b), size=12)
doc.add_page_break()

# ---- Acknowledgement ----
fc("ACKNOWLEDGEMENT", size=16, after=14)
for para in [
    "I would like to thank everyone who helped me see this project through.",
    "My deepest thanks go to my internal guide, [Guide Name], whose steady guidance, honest "
    "feedback and encouragement shaped this work from a rough idea into a finished system. I am "
    "equally grateful to [HOD Name], Head of the Information Technology Department, and to the "
    "faculty of LDRP Institute of Technology and Research for the knowledge and the environment "
    "that made the project possible.",
    "I am also thankful to the panel members whose review after the first presentation pushed me "
    "to step back and rebuild the project around a real problem. That feedback changed the "
    "direction of the work for the better.",
    "Finally, I thank my family and friends for their patience and support, and my classmates who "
    "tried the tool and gave me the candid reactions that helped me improve it.",
]:
    body(para)
gap(1)
nm = doc.add_paragraph(); nm.alignment = WD_ALIGN_PARAGRAPH.RIGHT
nm.paragraph_format.space_after = Pt(0)
set_run(nm.add_run("Tanvish Desai"), size=12, bold=True)
nm2 = doc.add_paragraph(); nm2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
set_run(nm2.add_run("Enrollment No. ____________"), size=12)
doc.add_page_break()

# ---- Abstract ----
fc("ABSTRACT", size=16, after=14)
for para in [
    "Campus placements often turn on two rounds that students find almost impossible to rehearse "
    "on their own: the panel interview and the group discussion. Both need several people and a "
    "kind of pressure that adapts as you speak, and a placement cell cannot give every student "
    "repeated mock rounds with faculty playing the interviewers. This project, Abhyaas, is a "
    "real-time web application that stands in for that panel, or for the moderator of a group "
    "discussion, so a student can practise on demand and as often as they like.",
    "Abhyaas is built as a hybrid system. A deterministic rules engine owns everything that "
    "decides the shape of a session: whose turn it is, which stage it has reached, how far the "
    "difficulty has climbed and when to score an answer. A large language model, Google's Gemini, "
    "is kept strictly to writing text, the questions, the follow-ups and the feedback, and is "
    "never allowed to change the session's state. This split keeps the model from drifting and "
    "makes each session consistent and measurable. The interviewer personas remember a "
    "candidate's earlier answers and press on them, and every session ends with a rubric-scored "
    "report that grades each competency, explains the score, and reports objective numbers the "
    "engine tracked directly. The system is built on Next.js and Convex, with live multiplayer "
    "delivered through reactive queries rather than a separate socket layer.",
]:
    body(para)
kw = doc.add_paragraph()
kw.paragraph_format.space_before = Pt(6)
set_run(kw.add_run("Keywords: "), size=12, bold=True)
set_run(kw.add_run("placement preparation, mock interview, group discussion, large language "
                   "models, multi-agent simulation, deterministic engine, real-time web "
                   "application."), size=12)
doc.add_page_break()

# ---- Table of Contents ----
fc("TABLE OF CONTENTS", size=16, after=12)
_toc_p = doc.add_paragraph()
_field_run(_toc_p, ' TOC \\o "1-3" \\h \\z \\u ',
           "Select this text and press F9 (or right-click > Update Field) to build the contents.")
doc.add_page_break()

# ---- List of Figures ----
fc("LIST OF FIGURES", size=16, after=12)
for _i, (_lab, _title) in enumerate(FIG_ENTRIES, 1):
    dot_row(f"{_lab}    {_title}", f"figbm{_i}")
doc.add_page_break()

# ---- List of Tables ----
fc("LIST OF TABLES", size=16, after=12)
for _i, (_lab, _title) in enumerate(TBL_ENTRIES, 1):
    dot_row(f"{_lab}    {_title}", f"tblbm{_i}")

# ---- begin main body (new section, arabic page numbers restarting at 1) ----
body_sec = doc.add_section(WD_SECTION.NEW_PAGE)
body_sec.different_first_page_header_footer = False  # header/footer on every body page
body_sec.page_height = Inches(11.69)
body_sec.page_width = Inches(8.27)
body_sec.top_margin = Inches(1.0)
body_sec.bottom_margin = Inches(1.0)
body_sec.left_margin = Inches(1.25)
body_sec.right_margin = Inches(1.0)
_pgnum(body_sec, fmt="decimal", start=1)

# ======================================================================
# CHAPTER 1 — INTRODUCTION
# ======================================================================
chapter(1, "INTRODUCTION", [
    ("1.1.", "INTRODUCTION"),
    ("1.2.", "AIMS AND OBJECTIVE OF THE WORK"),
    ("1.3.", "BRIEF LITERATURE REVIEW"),
    ("1.4.", "PROBLEM DEFINITION"),
    ("1.5.", "PLAN OF THE WORK"),
])

section("1.1", "Introduction")
body("Abhyaas takes its name from the Sanskrit word for practice. It is a real-time web "
     "application where students can rehearse the two campus-placement rounds that usually decide "
     "whether an offer comes through: the panel interview and the group discussion. These also "
     "happen to be the two rounds a student can barely prepare for alone. A panel interview needs "
     "several interviewers and a group discussion needs a group, and no placement cell can put "
     "every student through repeated mock rounds with faculty standing in as the panel. Abhyaas "
     "fills that gap. It plays the panel, or the moderator of a discussion, so a student can "
     "practise whenever they want and as often as they want.")
body("There are two modes. In a panel interview, one candidate sits across from a small panel of "
     "AI interviewers: an HR manager, a technical lead and a senior manager. Each one has its own "
     "temperament, each asks the kind of question its role would ask, and each builds on what the "
     "candidate has already said. The questions get harder as the interview goes on, much as they "
     "do in the real thing. In a group discussion, a few participants argue a topic while an AI "
     "moderator keeps it balanced and on time and scores each person separately. Anyone else can "
     "drop in as a silent observer.")
body("The design is deliberately split in two. A rules engine holds all the authority. It decides "
     "whose turn it is, which stage the session has reached, how far the difficulty has climbed "
     "and when to score an answer. The language model, Google's Gemini, is only ever asked to "
     "write text (a question, a follow-up, a paragraph of feedback) and is never allowed to change "
     "the state of the session. Keeping the model on that short leash is what stops it drifting or "
     "contradicting itself, and it is also what makes a session something we can measure.")
body("When a session ends, every candidate gets a written report. It scores them one to five on "
     "each competency and explains each score, lists what they did well and what to work on, and "
     "adds a few hard numbers the engine tracked along the way: how many questions were answered, "
     "how many competencies were actually covered, and the average length of an answer. A tool "
     "built on a plain chatbot cannot produce numbers like those. Everything runs on Next.js and "
     "Convex, and the live updates come straight from Convex's reactive queries, so we never "
     "needed a separate real-time socket layer.")

section("1.2", "Aims and Objective of the Work")

subsection("1.2.1", "Aims of “Abhyaas”")
body("The idea behind Abhyaas is easy to state: make real placement practice something a student "
     "can get on demand, that feels close to the actual round, and that they can repeat as often "
     "as they like. A few concrete aims follow from that.")
body("It should reproduce the rounds that actually matter, a genuine panel and a genuine moderated "
     "discussion, rather than a one-on-one chat. The interviewers should remember what a candidate "
     "said earlier and press on it, since that follow-up pressure is most of what makes an "
     "interview hard. Difficulty should build over a session instead of sitting flat. The feedback "
     "at the end should be structured and consistent, not a vague impression, and it should be "
     "backed by numbers the system can stand behind. And the whole thing has to scale, so a "
     "placement cell can offer it to a full batch without booking faculty time for every attempt.")
body("Put plainly, the aim is to turn interview prep from something scarce and subjectively graded "
     "into something a student can pick up at any hour and get an honest read from.")

subsection("1.2.2", "Objectives of “Abhyaas”")
body("To meet those aims, the project set out to do a specific set of things:")
for t in [
    "Build a rules engine that owns the flow of a session, its turn order, stage, difficulty, "
    "scoring and wrap-up, so the model can never invent the state.",
    "Simulate a panel interview by rotating three AI personas that ask role-specific questions "
    "grounded in the candidate's profile and in what they have already answered.",
    "Simulate a group discussion, with an AI moderator running the turns, keeping things fair and "
    "on topic, and scoring each participant.",
    "Keep Gemini to writing questions, follow-ups and feedback, and assemble every prompt from the "
    "persona, the profile, the recent transcript and that persona's own memory.",
    "Give each interviewer a per-candidate memory, so a later question can reach back to an earlier "
    "answer.",
    "Produce a report at the end: one to five on each competency with a reason, plus strengths, "
    "fixes and an overall score.",
    "Track the numbers the engine is actually in a position to measure, such as answers given, "
    "competencies covered and average answer length.",
    "Make all of it work live for everyone in the room through Convex's reactive queries.",
    "Let a candidate optionally upload a résumé, so the panel can ask about their real projects "
    "and experience.",
    "Put the whole thing behind a login, so every session and report belongs to a real user.",
]:
    bullet(t)
body("Taken together, these turn placement practice into something a student can do on demand and "
     "get measured, honest feedback from.")

section("1.3", "Brief Literature Review")
body("The design of Abhyaas is grounded in existing research across simulation-based training, "
     "language-model agents with memory, and hybrid neuro-symbolic systems that pair a language "
     "model with a deterministic state engine.")

subsection("1.3.1", "Simulation-Based & Deliberate Practice")
body("Skills improve through deliberate practice: doing the thing over and over, in a safe "
     "setting, with feedback each time. That idea is well established in the training literature, "
     "and simulation-based teaching has been shown to improve communication and confidence [6]. "
     "There is also early evidence that an AI can play the practice partner: a small randomised "
     "trial found AI-driven role-play training held up about as well as role-play with a person, "
     "and left participants more confident [7]. Abhyaas leans directly on this. It gives students "
     "a low-stakes place to run the "
     "exact rounds that decide placements, again and again, with a report each time.")

subsection("1.3.2", "Language-Model Agents with Memory")
body("For the interviewers to feel real, they have to remember. Park and colleagues [1] showed "
     "how a memory stream with retrieval lets language-model agents stay consistent over time, "
     "and the CoALA framework [2] gives a clean vocabulary for talking "
     "about it, separating episodic from semantic memory. Abhyaas uses a modest version of the "
     "idea. Each persona keeps its own record of the questions it asked a candidate and the "
     "answers it got, and that record is pulled back in when the next question is written, so the "
     "panel probes earlier answers instead of firing off unrelated ones.")

subsection("1.3.3", "Hybrid Neuro-Symbolic Systems")
body("The split between the engine and the model is not arbitrary. STORY2GAME [3] makes the "
     "case for it directly: let the language model write the narrative, but let a symbolic engine "
     "own the state transitions, because a model left to track state on its own tends to "
     "hallucinate the world into contradiction. Abhyaas draws the same line. The model writes the "
     "questions and the feedback; the engine decides whose turn it is, what stage the session is "
     "in and how the score adds up. Work on evaluating role-play agents, such as CharacterEval [4] "
     "and CoSER [5], also shaped the competency dimensions in the report. None of this "
     "is new machine learning. The contribution is in the wiring: state-grounding, per-user "
     "memory, live multiplayer and persistence, put together for a training problem that actually "
     "gets assessed.")

section("1.4", "Problem Definition")
body("Placement preparation has a few stubborn problems, and Abhyaas is aimed squarely at them. "
     "The first is scale. A placement cell only has so many faculty hours, so individual mock "
     "panels are rare and handed out unevenly. The second is that the rounds that matter most "
     "cannot really be practised alone: a panel needs a panel, a discussion needs a group, and a "
     "student sitting by themselves the night before a drive has neither.")
body("The tools that do exist only go so far. Yoodli, Google Interview Warmup, Final Round AI and "
     "the rest are built around a single candidate and a single interviewer, so they cannot stage "
     "a panel or a discussion at all. They also tend to ask one disconnected question after "
     "another; they do not hold on to an earlier answer and come back to it, which is exactly "
     "where a real interview turns uncomfortable. And a system run entirely by a language model "
     "has no reliable sense of turn order, stage or score, so its behaviour wanders and its "
     "judgement cannot be checked. Where feedback is offered at all, it is usually a loose "
     "impression rather than a clear, per-competency read a student can act on.")

section("1.5", "Plan of the Work")
body("The work ran in five phases.")

sublabel("Phase 1: Requirement Analysis and Redefinition")
body("This phase was really about getting the problem right. We took the earlier review feedback "
     "seriously and rebuilt the project around a genuine, well-bounded problem with clear "
     "stakeholders. We looked at the interview tools already out there, read up on deliberate "
     "practice, agent memory and hybrid systems, and settled on the two modes and the "
     "engine-versus-model split that the rest of the work would follow.")

sublabel("Phase 2: System Design")
body("Next came the shape of the system: the Convex schema (sessions, participants, profiles, "
     "personas, persona memories, session state, transcript, responses and feedback reports) "
     "with the indexes it would need, the rules engine that would advance turns and stages and "
     "push up the difficulty, and the screens for the dashboard, lobby, profile setup, live "
     "session and report.")

sublabel("Phase 3: Implementation")
body("With the design in place we built the session lifecycle (create, join, ready, start), the "
     "per-session seeding of the panel or moderator, and the engine itself: submitting an answer, "
     "moving to the next question or round, escalating difficulty and saving the report. The AI "
     "layer went in alongside it, assembling a prompt from the persona, profile, recent transcript "
     "and memory and calling Gemini, with fallback providers behind it. This phase also added "
     "résumé parsing and the login and read models for the live transcript and reports.")

sublabel("Phase 4: Testing and Validation")
body("We then checked that the engine behaved the same way every time. Turn order, stage "
     "progression and difficulty all had to hold up across sessions, a session had to run cleanly "
     "from start to a saved report, the engine's numbers had to come out right, and updates had "
     "to reach every connected participant at once.")

sublabel("Phase 5: Deployment and Evaluation")
body("Finally the frontend went to Vercel and the backend to Convex in production. A small "
     "before-and-after study is planned to see whether scores actually improve over repeated "
     "practice, and we kept a running list of extensions for later, including voice and video "
     "analysis, cohort dashboards and more interview domains.")

# ======================================================================
# CHAPTER 2 — TECHNOLOGY AND LITERATURE REVIEW
# ======================================================================
chapter(2, "TECHNOLOGY AND LITERATURE REVIEW", [
    ("2.1.", "TECHNOLOGIES"),
    ("2.2.", "LITERATURE REVIEW"),
    ("2.3.", "PROBLEM STATEMENT & GAPS"),
    ("2.4.", "THE ROLE OF THE SIMULATION ENGINE"),
])

section("2.1", "Technologies")

subsection("2.1.1", "Frontend Technologies (Client-Side)")
for parts in [
    ("Next.js (v15.4)", "The React framework used to build the web application with the App "
     "Router. It provides file-based routing (dashboard, lobby, join, and live session/report "
     "pages), server and client components, and a production build optimised for deployment on "
     "Vercel."),
    ("React (v19.1)", "The underlying UI library. Its component model and hooks drive the "
     "declarative, reactive interface used throughout the application."),
    ("TypeScript (v5.7)", "A statically-typed superset of JavaScript used across the entire "
     "codebase. It type-checks the whole project at compile time, including the auto-generated, "
     "type-safe Convex API, which caught a lot of mistakes early."),
    ("Tailwind CSS (v3.4)", "A utility-first CSS framework used for styling the dashboard, lobby, "
     "session, and report interfaces consistently and responsively."),
    ("react-markdown (v10.1)", "Renders the model-generated questions and feedback prose as "
     "formatted rich text in the transcript and report views."),
]:
    bullet(parts)

subsection("2.1.2", "Backend Technologies (Server-Side)")
for parts in [
    ("Convex (v1.43)", "A real-time Backend-as-a-Service that serves as the complete backend "
     "infrastructure. Convex provides reactive queries (the useQuery hook re-renders the UI "
     "automatically whenever underlying data changes), mutations (transactional server-side "
     "writes with validation), actions (for calling external services such as the LLM), a "
     "strongly-typed schema, scheduled functions, and auto-generated TypeScript types, all "
     "without a server to manage."),
    ("Convex Actions & Scheduler", "The AI calls run inside Convex Node actions scheduled by the "
     "engine, so question generation and feedback generation happen asynchronously and never "
     "block the interactive session."),
    ("Convex Auth (@convex-dev/auth v0.0.94)", "Provides authentication using the Password "
     "provider (email and password), issuing sessions that tie every practice session and "
     "feedback report to an identified user."),
]:
    bullet(parts)

subsection("2.1.3", "Database System")
for parts in [
    ("Convex Document Database", "A serverless, real-time document database that stores data as "
     "JSON-like documents within tables. Each document has a system-generated _id field and a "
     "_creationTime timestamp. The schema is enforced in code (convex/schema.ts) and holds nine "
     "application tables (sessions, participants, profiles, personas, personaMemories, "
     "sessionState, transcript, responses and feedbackReports) plus the authentication tables, "
     "each indexed for the lookups the app makes by session, user or persona."),
]:
    bullet(parts)

subsection("2.1.4", "AI & Language-Model Services")
for parts in [
    ("Google Gemini (@google/genai v2.15)", "The main language model, and the only thing "
     "generating natural language: interview questions, follow-ups, the moderator's prompts and "
     "the feedback. It never touches the session's state."),
    ("Fallback Providers (openai SDK v7.3)", "The OpenAI-compatible SDK is used to reach fallback "
     "inference providers (Groq / NVIDIA) so that question and feedback generation degrades "
     "gracefully if the primary provider is unavailable."),
    ("Prompt Grounding", "Every prompt is put together by the backend from the current persona, "
     "the candidate's profile, the recent transcript and that persona's memory, which keeps the "
     "output grounded."),
    ("unpdf (v1.8)", "Extracts text from an optionally-uploaded résumé so the interviewer can "
     "ground its questions in the candidate’s actual background."),
]:
    bullet(parts)

section("2.2", "Literature Review")

subsection("2.2.1", "Contextual Background")
body("Campus placements carry a lot of weight, and the two rounds that carry the most, the panel "
     "interview and the group discussion, are the hardest to rehearse. Both need several people "
     "in the room and a kind of pressure that adapts as you speak. The training literature is "
     "fairly settled on how skills like these improve: through deliberate practice, structured "
     "repetition with feedback in a safe setting, which simulation-based training puts to work for "
     "communication-heavy skills [6]. More recently, a pilot randomised trial found AI-driven "
     "role-play was about as effective as role-play with a person and left learners more "
     "confident [7], which is encouraging for the idea of an AI standing in as a practice "
     "partner.")

subsection("2.2.2", "Existing Solutions & Market Analysis")
body("Several tools already work in this space, but each stops short. Yoodli coaches an individual "
     "on things like pace and filler words, but it is one person talking to one coach; there is "
     "no panel and no group. Google Interview Warmup offers practice questions and a transcript, "
     "but again a single interviewer, shallow scoring and no memory of what you said a moment ago. "
     "Final Round AI and Interviewing.io run mock interviews and live coaching, but one-to-one, "
     "whether with a scheduled human or a lone AI. Hyperbound and Second Nature build AI role-play "
     "too, though for corporate sales teams rather than students. What none of them do is stage a "
     "multi-person panel or discussion, with interviewers that remember and probe, and hand back "
     "an objective, rubric-based score. That gap is where Abhyaas sits.")

section("2.3", "Problem Statement & Gaps")
body("Pulling those threads together, the gaps are clear enough. Practice does not scale, because "
     "faculty time is finite. The decisive rounds are multi-person, yet the tools are "
     "single-person. Those tools have no memory, so the follow-up pressure of a real interview "
     "never shows up. A model left in charge of its own state is inconsistent and impossible to "
     "audit. And the feedback, when there is any, is a subjective impression rather than a "
     "per-competency picture a student can use. Abhyaas is built to close each of these in turn.")

section("2.4", "The Role of the Simulation Engine (The Project’s Contribution)")
body("The engine is really the heart of the contribution. By putting a deterministic engine in "
     "charge of the whole flow, Abhyaas turns what would be an open-ended chat into something "
     "governed and measurable. The same engine drives both experiences, the rotating panel and "
     "the moderated discussion, which is the multi-person practice the single-player tools skip. "
     "Each persona carries a memory of what a candidate said and pulls it back to ask a sharper "
     "follow-up, so the interview keeps its pressure.")
body("Because the model only writes and the engine owns turn order, stage and difficulty, there is "
     "no state for the model to hallucinate, and a session stays consistent and checkable. That "
     "same ownership is what lets the engine report real numbers, competencies covered, answers "
     "given, average answer length, so practice produces evidence and not just a transcript. And "
     "all of it happens live for everyone connected, straight from Convex's reactive queries, "
     "with no separate socket layer to run.")

# ======================================================================
# CHAPTER 3 — SYSTEM REQUIREMENTS STUDY
# ======================================================================
chapter(3, "SYSTEM REQUIREMENTS STUDY", [
    ("3.1.", "USER CHARACTERISTICS"),
    ("3.2.", "HARDWARE AND SOFTWARE REQUIREMENTS"),
    ("3.3.", "ASSUMPTIONS AND DEPENDENCIES"),
])

section("3.1", "User Characteristics")
body("Abhyaas has three kinds of users.")

subsection("3.1.1", "Job-Seeking Students (Primary Users)")
body("Students are the main users, and the reason the tool exists at all. They are usually in "
     "their final or pre-final year, getting ready for placement drives, and they need no special "
     "technical skill because the interface walks them through it. They tend to come back "
     "repeatedly, especially in the weeks before a drive. A student can create a session and pick "
     "the mode, the role or topic, the difficulty and the number of questions; join as a "
     "candidate, discussant or observer; upload a résumé if they want the questions to fit their "
     "background; answer in a live interview or take part in a discussion; and read a scored, "
     "per-competency report at the end.")

subsection("3.1.2", "Training & Placement Cell / Trainers (Secondary Users)")
body("Placement staff are the ones who would put Abhyaas in front of a batch. They are "
     "comfortable with web tools and reports and use it around placement season, mainly to let "
     "students practise on their own without spending faculty interview time, and to look over "
     "the objective reports that come out of it.")

subsection("3.1.3", "Faculty / Mentors (Tertiary Users)")
body("Mentors use the reports to steer their coaching. They dip in as needed, guided by how a "
     "mentee is progressing rather than on any fixed schedule.")

section("3.2", "Hardware and Software Requirements")

subsection("3.2.1", "Hardware Requirements")
body("Abhyaas is a web application with a fully managed cloud backend, so hardware requirements "
     "are specific to the end-user device.")
sublabel("Client-Side (User Device)")
for t in [
    "Device: any modern laptop, desktop, or tablet with a current web browser (Chrome, Edge, "
    "Firefox, or Safari).",
    "Processor: dual-core 1.5 GHz or faster.",
    "RAM: minimum 4 GB.",
    "Internet Connection: broadband or 4G/5G (mandatory for real-time synchronisation).",
    "Input: keyboard for typing answers.",
]:
    bullet(t)
sublabel("Server-Side (Cloud Infrastructure)")
for t in [
    "Fully managed by Convex’s cloud infrastructure and Vercel’s hosting.",
    "No dedicated server hardware is required from the development team.",
    "Convex handles auto-scaling, database hosting, and serverless function execution; Vercel "
    "serves the frontend.",
]:
    bullet(t)

subsection("3.2.2", "Software Requirements")
sublabel("Development Environment")
for t in [
    "Operating System: Windows 10/11, macOS, or Linux.",
    "Code Editor: Visual Studio Code / Cursor IDE.",
    "Runtime: Node.js (v18+ LTS) with npm.",
    "Backend CLI: Convex CLI (npx convex dev).",
]:
    bullet(t)
sublabel("Technology Stack (Runtime Environment)")
for t in [
    "Frontend Framework: Next.js (v15.4) with React (v19.1).",
    "Language: TypeScript (v5.7).",
    "Styling: Tailwind CSS (v3.4).",
    "Backend: Convex (v1.43).",
    "Authentication: Convex Auth (@convex-dev/auth v0.0.94), Password provider.",
    "AI: Google Gemini (@google/genai v2.15) with OpenAI-compatible fallback providers "
    "(openai SDK v7.3).",
    "Résumé Parsing: unpdf (v1.8).",
]:
    bullet(t)

section("3.3", "Assumptions and Dependencies")

subsection("3.3.1", "Assumptions")
body("A handful of assumptions sit behind the design:")
for t in [
    "Everyone in a session is online for its whole duration, since the live experience depends on "
    "a steady connection.",
    "Practice happens by typing. Voice and video analysis are out of scope for now, and are noted "
    "as future work.",
    "Participants answer honestly. The practice is only worth as much as the effort put into it.",
    "Users are signed in, so every session and report is tied to a real account.",
    "The model provider is reachable, with fallback providers there to cover the odd outage.",
]:
    bullet(t)

subsection("3.3.2", "Dependencies")
body("And a few external services the project leans on:")
for t in [
    "Convex, which handles all the backend work, storage, real-time queries and scheduling. If it "
    "went down, sessions could not run.",
    "The Gemini API key for generating questions and feedback, with the OpenAI-compatible "
    "fallbacks softening a provider outage.",
    "Convex Auth, for creating accounts and issuing sessions.",
    "Vercel, which builds and serves the Next.js frontend.",
    "Node.js and the npm packages listed above, for development and builds.",
]:
    bullet(t)

# ======================================================================
# CHAPTER 4 — SYSTEM DIAGRAMS
# ======================================================================
chapter(4, "SYSTEM DIAGRAMS", [
    ("4.1.", "ENTITY-RELATIONSHIP DIAGRAM"),
    ("4.2.", "CLASS DIAGRAM"),
    ("4.3.", "USE CASE DIAGRAM"),
    ("4.4.", "SEQUENCE DIAGRAM"),
    ("4.5.", "ACTIVITY DIAGRAM"),
    ("4.6.", "DATA FLOW DIAGRAM"),
])

section("4.1", "Entity-Relationship Diagram")
body("An entity-relationship diagram (ERD) lays out a database design: the entities, their "
     "attributes, and how they relate to one another.")
body("The Abhyaas ERD centres on the Session entity. A Session has many Participants (each a User "
     "in a seat: candidate, discussant, or observer) and many Profiles (one per participant). A "
     "Session is seeded with several Personas (the AI interview panel or the GD moderator); each "
     "Persona owns many PersonaMemories (per-participant question-and-answer records). A Session "
     "has one SessionState (the authoritative flow record), a Transcript of many entries, many "
     "Responses (scored answers), and, on completion, a FeedbackReport per candidate. A User can "
     "host or join many Sessions.")
figure("Gemini_Generated_Image_cs64sacs64sacs64.png", "Fig4.1: Entity-Relationship Diagram")

section("4.2", "Class Diagram")
body("A class diagram is a UML representation that depicts the structure and relationships of the "
     "classes and modules within a software system. The Abhyaas class diagram is organised around "
     "the Convex backend modules and the Next.js frontend.")
body("The backend modules include sessions (session lifecycle), participants and profiles, "
     "personas and scenarioSeeder (seeding the panel/moderator from role presets), sessionEngine "
     "(the deterministic engine: initializeSession, applyGeneratedQuestion, submitAnswer, "
     "advance/finalise), ai / aiHelpers / promptBuilder / aiProviders (LLM question and feedback "
     "generation with fallbacks), and the transcript and reports read models. The frontend "
     "includes the dashboard, lobby, join, profile-setup, and live session/report pages, backed "
     "by the useQuery/useMutation Convex hooks. Static reference data (target roles, the "
     "interview panel, the GD moderator, and rubrics) lives in lib/rolePresets.")
figure("Gemini_Generated_Image_ej9oj7ej9oj7ej9o.png", "Fig4.2: Class Diagram")

section("4.3", "Use Case Diagram")
body("A use case diagram depicts the interactions between actors and the system. The actors in "
     "Abhyaas are the Candidate/Participant (primary), the Observer, the LLM Provider (system "
     "actor), and the Convex Backend (system actor).")
body("Use cases include: Sign Up / Sign In, Create Session, Join Session, Set Up Profile, Upload "
     "Résumé, Ready Up, Start Session, Answer Question (panel interview), Participate in Group "
     "Discussion, Receive Follow-up Question (grounded in memory), View Live Transcript, Observe "
     "Session, and View Feedback Report. System-actor use cases include Generate Question, "
     "Generate Feedback Report (LLM Provider), and Persist State / Compute Metrics (Convex "
     "Backend).")
figure("Gemini_Generated_Image_92b09u92b09u92b0.png", "Fig4.3: Use Case Diagram")

section("4.4", "Sequence Diagram")
body("A sequence diagram shows the order of messages passed between objects over time. Two flows "
     "matter most here.")
body("The first is starting a session and getting a question. When the host presses Start, the "
     "scenario seeder sets up the panel and the engine initialises the session state. The engine "
     "then schedules a question: the prompt builder gathers the persona, the profile, the recent "
     "transcript and the persona's memory, Gemini turns that into a question, and the engine "
     "writes it back and opens the turn. Every connected client sees the update through a reactive "
     "query.")
body("The second flow is answering and moving on. A participant submits an answer. The engine "
     "records it, stores it in that persona's memory, then decides on its own whether to ask the "
     "next question, move to the next round or finish, nudging the difficulty up as it goes. Once "
     "the session is over, it asks Gemini to score each participant against the rubric and marks "
     "the session complete.")
figure("Gemini_Generated_Image_btwuc3btwuc3btwu.png", "Fig4.4: Sequence Diagram")

section("4.5", "Activity Diagram")
body("An activity diagram follows the flow of control from one step to the next. In Abhyaas a user "
     "signs in, then creates or joins a session. They set up a profile, optionally uploading a "
     "résumé, and ready up. The host starts the session, at which point the engine seeds the "
     "personas, sets up the state and asks the model for the first question. The participant "
     "answers, the engine records the answer and stores it in the persona's memory, and then it "
     "checks whether any questions or rounds are left. If there are, it raises the difficulty and "
     "loops back for the next question. If not, it generates the feedback report, finalises the "
     "session and shows the scored report.")
figure("Gemini_Generated_Image_55fmhh55fmhh55fm.png", "Fig4.5: Activity Diagram")

section("4.6", "Data Flow Diagram")
body("A Data Flow Diagram (DFD) depicts the flow of data within a system, using symbols to "
     "illustrate how data moves from input sources through processes to output destinations.")

subsection("4.6.1", "Context-Level-0 DFD")
body("The Context-Level-0 DFD shows the entire Abhyaas system as a single process. External "
     "entities are: the Participant (provides credentials, session settings, profile, optional "
     "résumé, and typed answers; receives live questions, transcript, and a feedback report); "
     "the LLM Provider (receives grounded prompts, returns question and feedback text); and the "
     "Convex Cloud (stores and returns sessions, participants, personas, memory, transcript, "
     "responses, and reports).")
figure("Gemini_Generated_Image_vruonbvruonbvruo.png", "Fig4.6.1: Context-Level-0 Data Flow Diagram")

subsection("4.6.2", "Context-Level-1 DFD")
body("The Level-1 DFD breaks the system into its major processes: 1.0 Authentication & User "
     "Management, 2.0 Session Lifecycle, 3.0 Profile & Résumé Handling, 4.0 Persona Seeding, "
     "5.0 Question Generation (LLM), 6.0 Answer Processing & Engine Advancement, 7.0 Difficulty "
     "Escalation, and 8.0 Feedback & Metrics Generation, with the Convex data stores (Users, "
     "Sessions, Personas, PersonaMemories, SessionState, Transcript, Responses, FeedbackReports) "
     "at the centre.")
figure("Gemini_Generated_Image_q4t1w7q4t1w7q4t1.png", "Fig4.6.2: Context-Level-1 Data Flow Diagram")

# ======================================================================
# CHAPTER 5 — DATA DICTIONARY
# ======================================================================
chapter(5, "DATA DICTIONARY", [
    ("5.1.", "OVERVIEW"),
    ("5.2.", "DATABASE SCHEMA"),
    ("5.3.", "DATA INTEGRITY AND INDEXING"),
])

section("5.1", "Overview")
body("Abhyaas uses Convex, a serverless real-time document database, to store and manage all "
     "application data. Unlike traditional relational databases (MySQL, PostgreSQL), Convex stores "
     "data as JSON-like documents within defined tables. The schema is enforced through a "
     "TypeScript schema definition file (convex/schema.ts), and all interactions with the "
     "database are performed through type-safe serverless functions (queries, mutations, and "
     "actions). Convex handles CRUD operations with real-time synchronisation, so any data change "
     "is instantly reflected across all connected clients. Every document automatically receives "
     "a system-generated _id (primary key) and a _creationTime timestamp.")

section("5.2", "Database Schema")
body("The application schema consists of nine tables that handle session management, "
     "participants and profiles, the AI personas and their memory, the authoritative session "
     "state, the transcript, scored responses, and the final feedback reports. The most "
     "important tables are documented below.")
COLS = ["Column Name", "Data Type", "Constraints", "Description"]
W = [1.35, 1.25, 1.5, 1.92]

subsection("5.2.1", "Table: sessions")
body("Stores each practice session, whether a panel interview or a group discussion, along with "
     "its configuration and current status.")
table(COLS, SYS + [
    ("code", "String", "NOT NULL, indexed", "Short human-readable code used to join the session."),
    ("hostUserId", "ID (users)", "NOT NULL", "The user who created and hosts the session."),
    ("status", "Enum", "NOT NULL", "waiting | active | completed."),
    ("mode", "Enum", "NOT NULL", "panel_interview | group_discussion."),
    ("targetRole", "String", "NOT NULL", "The role the practice is aimed at (e.g. Software Engineer)."),
    ("topic", "String", "NOT NULL", "GD topic, or interview focus note."),
    ("difficulty", "Enum", "NOT NULL", "easy | medium | hard (sets the base difficulty)."),
    ("questionCount", "Number", "NOT NULL", "Interview: number of questions; GD: number of rounds."),
], "Table 1: sessions Table Schema", W)

subsection("5.2.2", "Table: participants")
body("Links users to a session and records their seat and readiness in the lobby.")
table(COLS, SYS + [
    ("sessionId", "ID (sessions)", "NOT NULL, indexed", "The session the participant belongs to."),
    ("userId", "ID (users)", "NOT NULL, indexed", "The user occupying this seat."),
    ("role", "Enum", "NOT NULL", "HOST | MEMBER."),
    ("seat", "Enum", "NOT NULL", "candidate | discussant | observer."),
    ("isConnected", "Boolean", "NOT NULL", "Whether the participant is currently connected."),
    ("isReady", "Boolean", "NOT NULL", "Whether the participant has readied up to start."),
], "Table 2: participants Table Schema", W)

subsection("5.2.3", "Table: profiles")
body("The per-session participant profile the interviewer uses to ground its questions.")
table(COLS, SYS + [
    ("userId", "ID (users)", "NOT NULL, indexed", "Owner of the profile."),
    ("sessionId", "ID (sessions)", "NOT NULL, indexed", "The session the profile applies to."),
    ("displayName", "String", "NOT NULL", "Name shown to the panel and other participants."),
    ("targetRole", "String", "NOT NULL", "The role the candidate is targeting."),
    ("experienceLevel", "String", "NOT NULL", "Student | Fresher | 1-3 years | 3+ years."),
    ("background", "String", "NOT NULL", "Short resume-summary the interviewer can use."),
    ("resumeText", "String", "OPTIONAL", "Full parsed resume text for resume-grounded questions."),
    ("avatar", "String", "NOT NULL", "Avatar identifier."),
    ("ready", "Boolean", "NOT NULL", "Whether the profile is complete/ready."),
], "Table 3: profiles Table Schema", W)

subsection("5.2.4", "Table: personas")
body("The AI interviewer panel (or GD moderator) seeded per session from the role presets.")
table(COLS, SYS + [
    ("sessionId", "ID (sessions)", "NOT NULL, indexed", "The session this persona belongs to."),
    ("name", "String", "NOT NULL", "Persona display name (e.g. Priya Sharma)."),
    ("personaRole", "String", "NOT NULL", "HR Manager, Technical Lead, Senior Manager, or Moderator."),
    ("personality", "String", "NOT NULL", "Behavioural description shaping the persona's tone."),
    ("focusAreas", "String", "NOT NULL", "Competencies this persona probes."),
    ("strictness", "Number", "NOT NULL", "Toughness level, 1 (gentle) to 5 (tough)."),
    ("avatar", "String", "NOT NULL", "Avatar identifier."),
    ("mood", "String", "NOT NULL", "Current mood used to colour the persona's prose."),
    ("goals", "String", "NOT NULL", "What the persona is trying to assess."),
], "Table 4: personas Table Schema", W)

subsection("5.2.5", "Table: personaMemories")
body("Per-participant memory that lets an interviewer reference and probe earlier answers.")
table(COLS, SYS + [
    ("personaId", "ID (personas)", "NOT NULL, indexed", "The persona that owns this memory."),
    ("participantName", "String", "NOT NULL, indexed", "The participant the memory is about."),
    ("question", "String", "NOT NULL", "The question the persona asked."),
    ("answer", "String", "NOT NULL", "The participant's answer to that question."),
], "Table 5: personaMemories Table Schema", W)

subsection("5.2.6", "Table: sessionState")
body("The single authoritative flow record the deterministic engine owns for each session.")
table(COLS, SYS + [
    ("sessionId", "ID (sessions)", "NOT NULL, indexed", "The session this state belongs to."),
    ("phase", "Enum", "NOT NULL", "awaiting_answer | generating | complete."),
    ("currentPersonaId", "ID (personas)", "OPTIONAL", "The persona currently asking."),
    ("currentQuestion", "String", "NOT NULL", "The question currently on the floor."),
    ("currentSpeakerName", "String", "OPTIONAL", "Whom the panel addressed / GD nudge."),
    ("questionIndex", "Number", "NOT NULL", "Index of the current question/round."),
    ("totalQuestions", "Number", "NOT NULL", "Total questions/rounds for the session."),
    ("difficultyLevel", "Number", "NOT NULL", "Current escalated difficulty (1..3+)."),
    ("askedCompetencies", "Array", "NOT NULL", "Competencies probed so far (coverage metric)."),
    ("turnIndex", "Number", "NOT NULL", "Turn counter used for turn ordering."),
], "Table 6: sessionState Table Schema", W)

subsection("5.2.7", "Table: transcript")
body("The ordered, live transcript of the session shown to all connected clients.")
table(COLS, SYS + [
    ("sessionId", "ID (sessions)", "NOT NULL, indexed", "The session the entry belongs to."),
    ("kind", "Enum", "NOT NULL", "question | answer | system | moderator."),
    ("speakerName", "String", "NOT NULL", "Who produced the entry."),
    ("speakerRole", "String", "OPTIONAL", "The speaker's role (e.g. persona role)."),
    ("text", "String", "NOT NULL", "The entry text."),
    ("competency", "String", "OPTIONAL", "The competency this entry targets, if any."),
], "Table 7: transcript Table Schema", W)

subsection("5.2.8", "Table: responses")
body("A durable record of each answer, used for scoring and metrics.")
table(COLS, SYS + [
    ("sessionId", "ID (sessions)", "NOT NULL, indexed", "The session the response belongs to."),
    ("userId", "ID (users)", "NOT NULL", "The user who answered."),
    ("participantName", "String", "NOT NULL", "Display name of the responder."),
    ("questionText", "String", "NOT NULL", "The question that was answered."),
    ("answerText", "String", "NOT NULL", "The participant's answer."),
    ("wordCount", "Number", "NOT NULL", "Word count of the answer (metric input)."),
], "Table 8: responses Table Schema", W)

subsection("5.2.9", "Table: feedbackReports")
body("The final, per-candidate rubric-scored report generated at session end. The competencies "
     "field holds an array of objects, each with a name, a score from 1 to 5, and a "
     "justification; the metrics field holds the numbers the engine computed.")
table(COLS, SYS + [
    ("sessionId", "ID (sessions)", "NOT NULL, indexed", "The session the report belongs to."),
    ("userId", "ID (users)", "NOT NULL, indexed", "The candidate the report is for."),
    ("participantName", "String", "NOT NULL", "Display name of the candidate."),
    ("overallScore", "Number", "NOT NULL", "Overall score, 0-100."),
    ("competencies", "Array<Object>", "NOT NULL", "Per-competency {name, score (1-5), justification}."),
    ("strengths", "Array<String>", "NOT NULL", "Highlighted strengths."),
    ("improvements", "Array<String>", "NOT NULL", "Areas to improve."),
    ("summary", "String", "NOT NULL", "Narrative summary of the performance."),
    ("metrics", "Object", "NOT NULL", "Engine metrics: questionsAnswered, competenciesCovered, "
     "totalCompetencies, avgAnswerWords."),
], "Table 9: feedbackReports Table Schema", W)

section("5.3", "Data Integrity and Indexing")
body("Convex gives every document a unique _id as its primary key, and it type-checks writes at "
     "the database level, so a document that does not fit the schema is simply rejected. That "
     "includes the enumerated fields such as status, mode, seat, phase and transcript kind, which "
     "can only take one of their listed values.")
body("The tables are indexed for the lookups the app actually makes. sessions is indexed by its "
     "join code; participants, profiles, personas, sessionState, transcript and responses are all "
     "indexed by sessionId, with participants and profiles also indexed by session and user "
     "together; personaMemories is indexed by persona and by persona-and-participant; and "
     "feedbackReports is indexed by session and by session-and-user. Documents point at one "
     "another through typed IDs, so most tables reference a session, personaMemories references a "
     "persona, and the user-owned rows reference a user.")
body("Writes are transactional. When a candidate submits an answer, the engine writes the "
     "response, updates the persona's memory and advances the session state in one operation, so "
     "the data never ends up half-updated.")

# ======================================================================
# CHAPTER 6 — RESULT, DISCUSSION AND CONCLUSION
# ======================================================================
chapter(6, "RESULT, DISCUSSION AND CONCLUSION", [
    ("6.1.", "RESULT"),
    ("6.2.", "CONCLUSION"),
])

section("6.1", "Result")
body("Abhyaas was built and tested as a working, real-time, multi-participant placement-practice "
     "simulator. Everything set out in the objectives is in place and running.")
body("The rules engine works as intended. It owns the turn order, the stage, the difficulty, the "
     "scoring and the wrap-up, and because the model is never allowed near that state, sessions "
     "come out consistent and can be run again the same way. Both modes are live. In a panel "
     "interview a single candidate faces a rotating panel of three personas, an HR manager, a "
     "technical lead and a senior manager, whose questions get tougher as the session goes on. In "
     "a group discussion, several participants argue a topic under an AI moderator that runs the "
     "turns and scores each person on their own.")
body("The features that set the tool apart all landed. Each persona keeps a memory of a "
     "candidate's earlier answers and reaches back into it for pointed follow-ups, which is what "
     "gives the interview its pressure. A candidate can upload a résumé and have the panel ask "
     "about what is on it. At the end, every candidate gets a report scoring them one to five on "
     "each competency with a written reason, an overall score, and short lists of strengths and "
     "things to work on. Alongside the scores the report shows the numbers the engine tracked "
     "directly, answers given, competencies covered and average answer length, which a plain "
     "chatbot has no way to produce.")
body("On the platform side, the lobby, the live session and the transcript all update at once for "
     "everyone connected, straight through Convex's reactive queries and with no separate socket "
     "layer. Sign-in is by email and password, so each session and report belongs to a real user. "
     "And question and feedback generation run on Gemini with OpenAI-compatible fallbacks behind "
     "it, so a provider outage does not take the whole thing down.")
body("Screenshots of the running application are shown below.")

figure("screenshot_dashboard.png", "Fig6.1: Dashboard (creating a session)")

figure("screenshot_session.png", "Fig6.2: Live panel interview session")

figure("screenshot_report.png", "Fig6.3: Rubric-scored feedback report")

section("6.2", "Conclusion")
body("The two rounds students find hardest to rehearse are the panel interview and the group "
     "discussion, and Abhyaas shows they can be simulated well by pairing a deterministic engine "
     "with a language model kept to writing prose. Handing the engine authority over all the state "
     "and flow is what keeps a pure-LLM system from drifting, and it is the same thing that lets "
     "Abhyaas hand back objective, per-competency feedback and hard numbers that a chatbot cannot. "
     "The multi-person design, the interviewers that remember, and the optional résumé grounding "
     "together reproduce the feel of a real panel far more closely than the single-candidate tools "
     "that came before it.")
body("None of this is new machine learning. What the project contributes is the engineering: "
     "grounding the model in state, giving each persona its own memory, running it all live for "
     "several people at once, and storing it durably, aimed at a real training problem with real "
     "stakeholders, the students who need the practice and the placement cell that would run it. "
     "There is plenty left to do. Voice and video would let the tool judge delivery and body "
     "language, the placement cell could use a cohort-readiness dashboard, more interview domains "
     "would widen its reach, and a larger before-and-after study would put a number on how much "
     "repeated practice actually helps.")

# ======================================================================
# CHAPTER 7 — BIBLIOGRAPHY
# ======================================================================
def ref(text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(6)
    set_run(p.add_run(text), size=12)
    return p


chapter(7, "BIBLIOGRAPHY", [
    ("7.1.", "REFERENCES"),
])

section("7.1", "References")
body("This section lists the technical documentation, academic papers, and existing tools "
     "referenced during the design, development, and research of Abhyaas.")

subsection("7.1.1", "Technical Documentation")
for r in [
    "Next.js Documentation : https://nextjs.org/docs",
    "React Documentation : https://react.dev/",
    "Convex Documentation : https://docs.convex.dev/",
    "Convex Auth Documentation : https://labs.convex.dev/auth",
    "TypeScript Documentation : https://www.typescriptlang.org/docs/",
    "Tailwind CSS Documentation : https://tailwindcss.com/docs",
    "Google Gemini API (@google/genai) Documentation : https://ai.google.dev/gemini-api/docs",
    "OpenAI Node SDK Documentation : https://github.com/openai/openai-node",
    "react-markdown Documentation : https://github.com/remarkjs/react-markdown",
    "unpdf Documentation : https://github.com/unjs/unpdf",
    "Vercel Documentation : https://vercel.com/docs",
]:
    ref(r)

subsection("7.1.2", "Academic References")
body("The literature-review sections (1.3 and 2.2) cite these sources by their bracketed number.")
for r in [
    "[1] Park, J. S., O'Brien, J., Cai, C. J., et al. (2023). Generative Agents: Interactive "
    "Simulacra of Human Behavior. arXiv:2304.03442. https://arxiv.org/abs/2304.03442",
    "[2] Sumers, T. R., Yao, S., Narasimhan, K., Griffiths, T. L. (2023). Cognitive Architectures "
    "for Language Agents (CoALA). arXiv:2309.02427. https://arxiv.org/abs/2309.02427",
    "[3] STORY2GAME: Generating (Almost) Everything in an Interactive Fiction Game (2025). "
    "arXiv:2505.03547. https://arxiv.org/abs/2505.03547",
    "[4] Tu, Q., Fan, S., Tian, Z., Yan, R. (2024). CharacterEval: A Chinese Benchmark for "
    "Role-Playing Conversational Agent Evaluation. arXiv:2401.01275. "
    "https://arxiv.org/abs/2401.01275",
    "[5] CoSER: Coordinating LLM-Based Persona Simulation of Established Roles (2025). "
    "arXiv:2502.09082. https://arxiv.org/abs/2502.09082",
    "[6] Deliberate Practice in Simulation. StatPearls, NCBI Bookshelf. "
    "https://www.ncbi.nlm.nih.gov/books/NBK554558/",
    "[7] Simulation-based training and communication/empathy outcomes (randomised controlled "
    "trial). https://pubmed.ncbi.nlm.nih.gov/31794034/",
]:
    ref(r)

subsection("7.1.3", "Similar Systems (Case Studies)")
for r in [
    "Yoodli (AI speech and interview coach) : https://yoodli.ai/",
    "Google Interview Warmup : https://grow.google/certificates/interview-warmup/",
    "Final Round AI : https://www.finalroundai.com/",
    "Interviewing.io : https://interviewing.io/",
    "Hyperbound (AI sales roleplay) : https://www.hyperbound.ai/",
    "Second Nature (AI roleplay training) : https://www.secondnature.ai/",
]:
    ref(r)

# tell Word to refresh the TOC and page-reference fields when the document opens
_uf = OxmlElement("w:updateFields"); _uf.set(qn("w:val"), "true")
doc.settings.element.append(_uf)

out = r"C:\Users\DELL\Desktop\code_playground\ai-collaborative-dungeon-master\report\Abhyaas_Project_Report.docx"
try:
    doc.save(out)
    print("SAVED:", out)
except PermissionError:
    tmp = out.replace(".docx", "_NEW.docx")
    doc.save(tmp)
    print("LOCKED — saved to:", tmp)
