import logging
import os
import subprocess
import tempfile

from fastapi import FastAPI
from fastapi.responses import Response
from jinja2 import Environment, FileSystemLoader

app = FastAPI()
logger = logging.getLogger(__name__)

_env = Environment(
    loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")),
    variable_start_string="<<",
    variable_end_string=">>",
    block_start_string="<%",
    block_end_string="%>",
    comment_start_string="<#",
    comment_end_string="#>",
    trim_blocks=True,
    lstrip_blocks=True,
    autoescape=False,
)

# Characters that must be escaped in LaTeX text mode
_LATEX_SPECIAL = str.maketrans({
    "\\": r"\textbackslash{}",
    "&":  r"\&",
    "%":  r"\%",
    "$":  r"\$",
    "#":  r"\#",
    "_":  r"\_",
    "{":  r"\{",
    "}":  r"\}",
    "~":  r"\textasciitilde{}",
    "^":  r"\textasciicircum{}",
})


def _e(text) -> str:
    return "" if not text else str(text).translate(_LATEX_SPECIAL)


_env.filters["e"] = _e


@app.post("/generate")
async def generate(body: dict):
    tex = _env.get_template("resume.tex.j2").render(**body)

    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = os.path.join(tmpdir, "resume.tex")
        pdf_path = os.path.join(tmpdir, "resume.pdf")

        with open(tex_path, "w", encoding="utf-8") as fh:
            fh.write(tex)

        proc = subprocess.run(
            ["xelatex", "-interaction=nonstopmode", "-output-directory", tmpdir, tex_path],
            capture_output=True,
            timeout=60,
        )

        if proc.returncode != 0 or not os.path.exists(pdf_path):
            log_path = os.path.join(tmpdir, "resume.log")
            log_content = open(log_path).read() if os.path.exists(log_path) else ""
            logger.error("xelatex failed.\n%s", log_content)
            return Response(
                content=(log_content or proc.stdout.decode(errors="replace")).encode(),
                status_code=500,
                media_type="text/plain",
            )

        return Response(content=open(pdf_path, "rb").read(), media_type="application/pdf")
