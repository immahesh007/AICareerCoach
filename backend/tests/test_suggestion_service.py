"""Validator-only tests for services.suggestion_service.

Exercises validate_and_normalize without touching the LLM. Run from backend/:
    pytest tests/test_suggestion_service.py
"""
from services.suggestion_service import validate_and_normalize


PARSED_RESUME = {
    "summary": "Backend engineer with 5 years of experience.",
    "skills": ["Python", "Postgres", "FastAPI"],
    "experience": [
        {
            "title": "Senior Backend Engineer",
            "company": "Acme",
            "duration": "2022 - Present",
            "description": [
                "Built REST APIs in FastAPI.",
                "Improved query performance by 30%.",
            ],
        },
        {
            "title": "Backend Engineer",
            "company": "Initech",
            "duration": "2020 - 2022",
            "description": ["Maintained legacy Django service."],
        },
    ],
}


def test_summary_normalized_with_id_and_current():
    raw = {
        "summary": {
            "suggested": "Senior backend engineer specializing in distributed Python systems.",
            "rationale": "Aligns with JD seniority and tech stack.",
        }
    }
    out = validate_and_normalize(raw, parsed_resume=PARSED_RESUME)

    assert out["summary"]["suggestion_id"] == "sum_1"
    assert out["summary"]["current"] == PARSED_RESUME["summary"]
    assert out["summary"]["suggested"].startswith("Senior backend")
    assert out["summary"]["rationale"]


def test_empty_summary_dropped():
    raw = {"summary": {"suggested": "   ", "rationale": "noop"}}
    out = validate_and_normalize(raw, parsed_resume=PARSED_RESUME)
    assert out["summary"] is None


def test_skill_dedupe_against_existing_case_insensitive():
    raw = {
        "skills": [
            {"skill": "python", "rationale": "JD requires it"},  # duplicate (case)
            {"skill": "Kubernetes", "rationale": "Used for orchestration"},
            {"skill": "FASTAPI", "rationale": "exists already"},  # duplicate
            {"skill": "Docker", "rationale": "Containers"},
        ]
    }
    out = validate_and_normalize(raw, parsed_resume=PARSED_RESUME)
    skills = [s["skill"] for s in out["skills"]]

    assert "Kubernetes" in skills
    assert "Docker" in skills
    assert "python" not in [s.lower() for s in skills if s.lower() == "python"]
    assert all(s.lower() != "fastapi" for s in skills)
    # ids are sequential
    assert [s["suggestion_id"] for s in out["skills"]] == ["sk_1", "sk_2"]


def test_skill_dedupe_within_bundle():
    raw = {
        "skills": [
            {"skill": "GraphQL", "rationale": "JD"},
            {"skill": "graphql", "rationale": "again"},
        ]
    }
    out = validate_and_normalize(raw, parsed_resume=PARSED_RESUME)
    assert len(out["skills"]) == 1
    assert out["skills"][0]["skill"] == "GraphQL"


def test_experience_index_out_of_range_dropped():
    raw = {
        "experience": [
            {
                "experience_index": 0,
                "bullet_index": 0,
                "suggested": "Designed and built FastAPI services serving 1M req/day.",
                "rationale": "Surfaces JD scale.",
            },
            {
                "experience_index": 5,  # out of range
                "bullet_index": 0,
                "suggested": "Should be dropped.",
                "rationale": "x",
            },
            {
                "experience_index": 0,
                "bullet_index": 99,  # bullet out of range
                "suggested": "Should be dropped.",
                "rationale": "x",
            },
            {
                "experience_index": 1,
                "bullet_index": 0,
                "suggested": "Migrated legacy Django service to async patterns.",
                "rationale": "JD prefers async.",
            },
        ]
    }
    out = validate_and_normalize(raw, parsed_resume=PARSED_RESUME)
    assert len(out["experience"]) == 2
    ids = [e["suggestion_id"] for e in out["experience"]]
    assert ids == ["ex_1", "ex_2"]
    # current is always populated from the actual existing bullet
    assert out["experience"][0]["current"] == "Built REST APIs in FastAPI."
    assert out["experience"][1]["current"] == "Maintained legacy Django service."


def test_experience_unchanged_suggestion_dropped():
    raw = {
        "experience": [
            {
                "experience_index": 0,
                "bullet_index": 0,
                "suggested": "Built REST APIs in FastAPI.",  # identical
                "rationale": "noop",
            }
        ]
    }
    out = validate_and_normalize(raw, parsed_resume=PARSED_RESUME)
    assert out["experience"] == []


def test_experience_invalid_index_types_dropped():
    raw = {
        "experience": [
            {
                "experience_index": "zero",
                "bullet_index": 0,
                "suggested": "x",
                "rationale": "x",
            },
            {
                "experience_index": None,
                "bullet_index": 0,
                "suggested": "x",
                "rationale": "x",
            },
        ]
    }
    out = validate_and_normalize(raw, parsed_resume=PARSED_RESUME)
    assert out["experience"] == []


def test_string_description_treated_as_single_bullet():
    parsed = {
        "skills": [],
        "experience": [
            {"title": "Eng", "company": "X", "description": "Did stuff."}
        ],
    }
    raw = {
        "experience": [
            {
                "experience_index": 0,
                "bullet_index": 0,
                "suggested": "Engineered X to achieve Y.",
                "rationale": "rewrite",
            },
            {
                "experience_index": 0,
                "bullet_index": 1,  # only one bullet
                "suggested": "should drop",
                "rationale": "x",
            },
        ]
    }
    out = validate_and_normalize(raw, parsed_resume=parsed)
    assert len(out["experience"]) == 1
    assert out["experience"][0]["current"] == "Did stuff."


def test_non_dict_items_dropped():
    raw = {
        "skills": ["NotADict", {"skill": "Redis", "rationale": "JD"}],
        "experience": ["string", 42, {
            "experience_index": 0,
            "bullet_index": 0,
            "suggested": "A rewritten bullet.",
            "rationale": "ok",
        }],
        "summary": "not a dict",
    }
    out = validate_and_normalize(raw, parsed_resume=PARSED_RESUME)
    assert out["summary"] is None
    assert len(out["skills"]) == 1
    assert out["skills"][0]["skill"] == "Redis"
    assert len(out["experience"]) == 1


def test_coerces_non_string_rationale():
    raw = {
        "skills": [
            {"skill": "Terraform", "rationale": ["IaC", "Cloud"]},
        ]
    }
    out = validate_and_normalize(raw, parsed_resume=PARSED_RESUME)
    assert out["skills"][0]["rationale"] == "IaC\nCloud"


def test_empty_bundle_returns_empty_arrays():
    out = validate_and_normalize({}, parsed_resume=PARSED_RESUME)
    assert out == {"summary": None, "skills": [], "experience": []}


def test_resume_with_no_existing_skills_accepts_all():
    parsed = {"skills": [], "experience": []}
    raw = {"skills": [{"skill": "Python", "rationale": "JD"}]}
    out = validate_and_normalize(raw, parsed_resume=parsed)
    assert len(out["skills"]) == 1
    assert out["skills"][0]["skill"] == "Python"
