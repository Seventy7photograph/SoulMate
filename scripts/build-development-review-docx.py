from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "AI开发复盘_小雅.docx"


def set_cell_shading(cell, fill: str) -> None:
    properties = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    properties.append(shading)


def set_cell_borders(cell, color: str = "D9D9D9") -> None:
    properties = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        item = OxmlElement(f"w:{edge}")
        item.set(qn("w:color"), color)
        item.set(qn("w:sz"), "6")
        item.set(qn("w:val"), "single")
        borders.append(item)
    properties.append(borders)


def set_repeat_table_header(row) -> None:
    properties = row._tr.get_or_add_trPr()
    repeat = OxmlElement("w:tblHeader")
    repeat.set(qn("w:val"), "true")
    properties.append(repeat)


def remove_paragraph_borders(paragraph) -> None:
    parent = paragraph._p
    p_pr = parent.find(qn("w:pPr"))
    if p_pr is not None:
        border = p_pr.find(qn("w:pBdr"))
        if border is not None:
            p_pr.remove(border)
    style_p_pr = paragraph.style._element.find(qn("w:pPr"))
    if style_p_pr is not None:
        border = style_p_pr.find(qn("w:pBdr"))
        if border is not None:
            style_p_pr.remove(border)


document = Document()
section = document.sections[0]
section.top_margin = Cm(1.55)
section.bottom_margin = Cm(1.45)
section.left_margin = Cm(1.85)
section.right_margin = Cm(1.85)

styles = document.styles
normal = styles["Normal"]
normal.font.name = "Microsoft YaHei"
normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
normal.font.size = Pt(9.6)
normal.font.color.rgb = RGBColor(32, 32, 32)
normal.paragraph_format.space_after = Pt(4)
normal.paragraph_format.line_spacing = 1.22

for style_name in ("Title", "Heading 1", "Heading 2"):
    style = styles[style_name]
    style.font.name = "Microsoft YaHei"
    style._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    style.font.color.rgb = RGBColor(0, 0, 0)

title = document.add_paragraph(style="Title")
remove_paragraph_borders(title)
title.alignment = WD_ALIGN_PARAGRAPH.LEFT
title.paragraph_format.space_after = Pt(7)
title_run = title.add_run("AOLINU SoulMate 小雅 AI 开发复盘")
title_run.font.size = Pt(21)
title_run.font.bold = True
title_run.font.color.rgb = RGBColor(0, 0, 0)

meta = document.add_paragraph()
meta.paragraph_format.space_after = Pt(9)
meta_run = meta.add_run("全栈开发测试交付物 3 ｜ 2026 年 11 月 7 日")
meta_run.font.size = Pt(8.5)
meta_run.font.color.rgb = RGBColor(90, 90, 90)

lead = document.add_paragraph()
lead.add_run(
    "本项目以 Codex 为主要实现工具，完成 React 与 FastAPI 数字陪伴应用。"
    "最终交付保留了无密钥可运行的本地语义链路，并增加可选免费模型、"
    "四套同骨架 3D 人形、情绪光影、移动端适配与一键部署。"
)

heading = document.add_paragraph(style="Heading 1")
heading.paragraph_format.space_before = Pt(7)
heading.paragraph_format.space_after = Pt(4)
heading.add_run("一、AI 工具与实际耗时").font.size = Pt(11.5)

table = document.add_table(rows=1, cols=3)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False
widths = [Cm(3.1), Cm(9.7), Cm(4.4)]
headers = ["工具", "实际用途", "在本次工作中的作用"]
for index, cell in enumerate(table.rows[0].cells):
    cell.width = widths[index]
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_shading(cell, "1F4E5A")
    set_cell_borders(cell)
    paragraph = cell.paragraphs[0]
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run(headers[index])
    run.font.bold = True
    run.font.color.rgb = RGBColor(255, 255, 255)
    run.font.size = Pt(8.5)
set_repeat_table_header(table.rows[0])

rows = [
    ("ChatGPT", "需求拆解、交付清单、测试场景整理", "前期规划"),
    ("Codex", "代码、测试、文档、部署和浏览器验收", "主要实现工具"),
    ("Playwright", "桌面与移动端真实交互回归", "最终体验验证"),
    ("Impeccable", "响应式布局与视觉问题检测", "界面质量复核"),
]
for row_index, values in enumerate(rows, start=1):
    cells = table.add_row().cells
    for index, value in enumerate(values):
        cells[index].width = widths[index]
        cells[index].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_borders(cells[index])
        if row_index % 2 == 0:
            set_cell_shading(cells[index], "F2F6F5")
        paragraph = cells[index].paragraphs[0]
        paragraph.alignment = (
            WD_ALIGN_PARAGRAPH.CENTER
            if index != 1
            else WD_ALIGN_PARAGRAPH.LEFT
        )
        run = paragraph.add_run(value)
        run.font.size = Pt(8.3)

time_paragraph = document.add_paragraph()
time_paragraph.paragraph_format.space_before = Pt(5)
time_paragraph.add_run("实际耗时：").font.bold = True
time_paragraph.add_run(
    "累计约 4 小时。主要时间用于 3D 骨骼变形排查、移动端遮挡调整、"
    "本地语义覆盖扩展、自动化测试和部署准备。"
)

heading = document.add_paragraph(style="Heading 1")
heading.paragraph_format.space_before = Pt(8)
heading.paragraph_format.space_after = Pt(4)
heading.add_run("二、AI 原稿中不够好并手动修正的细节").font.size = Pt(11.5)

corrections = [
    (
        "骨骼跟随：",
        "AI 最初把头部跟随逐帧累加到骨骼旋转，并手动调整上半身和髋部，"
        "可能造成上半身扭转、下半身不动和重心角度过大。后来改为保留动画混合器"
        "输出的原始四元数，再叠加受限头部偏移，并取消髋部强制旋转。",
    ),
    (
        "语义链路：",
        "AI 初版只覆盖少数关键词，未命中的问候和饮食问题都会返回同一句兜底文案。"
        "这不是前端显示故障，而是本地路由不足。现已扩展多场景意图，并增加"
        " Pollinations、Gemini 和 OpenAI 兼容模型适配器，远程失败时自动回退。",
    ),
    (
        "移动端层级：",
        "AI 初稿把提示气泡固定在左上角，消息增多后会遮挡聊天记录。最终把气泡"
        "移到角色头部上方，历史默认折叠并渐隐，同时提供展开控制。",
    ),
]

for label, body in corrections:
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.left_indent = Cm(0.25)
    paragraph.paragraph_format.space_after = Pt(4)
    label_run = paragraph.add_run(label)
    label_run.font.bold = True
    paragraph.add_run(body)

heading = document.add_paragraph(style="Heading 1")
heading.paragraph_format.space_before = Pt(8)
heading.paragraph_format.space_after = Pt(4)
heading.add_run("三、最终验证").font.size = Pt(11.5)

verification = document.add_paragraph()
verification.add_run(
    "最终通过 ESLint、TypeScript、70 项 Vitest、8 项 FastAPI pytest、"
    "14 项 Playwright、生产构建和 Impeccable 检测。桌面与移动端截图均完成"
    "目视复核，动作、情绪、天气、折叠历史和调试抽屉均可实际操作。"
)

footer = document.add_paragraph()
footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
footer.paragraph_format.space_before = Pt(8)
footer_run = footer.add_run("交付人：詹仕杰")
footer_run.font.size = Pt(8.3)
footer_run.font.color.rgb = RGBColor(90, 90, 90)

document.save(OUTPUT)
print(OUTPUT)
