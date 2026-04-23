import json
import logging
import re
from app.utils.gemini import async_call_gemini

logger = logging.getLogger(__name__)


async def generate_questions(
    parsed_profile: dict,
    job_title: str,
    required_skills: list,
    nice_to_have: list,
    missing_skills: list,
) -> list[dict]:
    projects = parsed_profile.get('projects', []) or []
    has_projects = len(projects) > 0

    # Format top 3 projects for the prompt (keep it tight)
    project_lines = "\n".join(
        f"  - {p.get('name', 'Unnamed Project')}: {str(p.get('description', ''))[:150].strip()} "
        f"(Technologies: {', '.join(p.get('technologies', [])[:5])})"
        for p in projects[:3]
    ) if has_projects else "None listed"

    total_q = 12 if has_projects else 10
    project_distribution = "- 2 Project Based (reference ONLY the specific projects listed above — ask about challenges faced, key decisions made, technologies chosen, or measurable outcomes)" if has_projects else ""
    project_context = f"\nCANDIDATE PROJECTS:\n{project_lines}" if has_projects else ""

    prompt = f"""You are an expert technical interviewer. Generate exactly {total_q} interview questions for this candidate.

CANDIDATE PROFILE SUMMARY:
- Name: {parsed_profile.get('name', 'Candidate')}
- Current Title: {parsed_profile.get('current_title', 'N/A')}
- Years of Experience: {parsed_profile.get('total_years_experience', 0)}
- Key Skills: {', '.join(parsed_profile.get('skills', {}).get('hard_skills', [])[:10])}{project_context}

JOB: {job_title}
Required Skills: {', '.join(required_skills)}
Nice-to-Have: {', '.join(nice_to_have)}
Skill Gaps (missing from candidate): {', '.join(missing_skills[:5])}

Generate questions in this distribution:
- 4 Technical Deep Dive (based on claimed skills)
- 2 Skill Gap Probes (testing the missing skills above)
- 2 Behavioral (STAR-format)
- 1 Culture Fit
- 1 Motivation/Ambition
{project_distribution}

IMPORTANT for Project Based questions (if any):
- Reference the EXACT project names from the candidate's profile above
- Do NOT generate generic project questions — make them specific to those projects
- Use category value: "project_based"

IMPORTANT: Return ONLY a valid JSON array. No markdown formatting, no code fences (no ```), no explanation text before or after. Raw JSON only.
[
  {{
    "id": "q1",
    "category": "technical",
    "question": "Full question text here",
    "purpose": "Why this question is relevant for this candidate",
    "difficulty": "medium",
    "expected_framework": "STAR",
    "follow_up_probes": ["Follow-up 1", "Follow-up 2"]
  }}
]"""

    try:
        # No max_output_tokens cap — 10-12 questions with follow-ups is
        # 800-1500+ tokens. A 1500-token cap truncates mid-JSON and returns [].
        raw = await async_call_gemini(prompt)
        logger.info(f"[generate_questions] Gemini response: {len(raw)} chars")
    except Exception as e:
        logger.error(f"[generate_questions] Gemini call failed: {type(e).__name__}: {e}")
        return []

    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")

    # Extract JSON array even if there's preamble text
    match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)
    else:
        logger.error(
            f"[generate_questions] No JSON array found in response. "
            f"Response tail (last 300 chars): ...{raw[-300:]!r}"
        )
        return []

    try:
        questions = json.loads(cleaned)
        logger.info(f"[generate_questions] Parsed {len(questions)} questions OK")
        return questions
    except json.JSONDecodeError as exc:
        logger.error(
            f"[generate_questions] JSONDecodeError: {exc}. "
            f"Response tail (last 300 chars): ...{raw[-300:]!r}"
        )
        return []


async def evaluate_answer(question: str, answer_text: str, job_title: str) -> dict:
    prompt = f"""You are an expert career coach evaluating an interview answer.

QUESTION: {question}
CANDIDATE ANSWER: {answer_text}
ROLE: {job_title}

Score on these 5 dimensions (each 0-10, use one decimal place):
- Relevance: Does it directly answer what was asked?
- Clarity: Is it well-structured and easy to follow?
- Depth: Does it show genuine expertise and specific examples?
- Confidence: Sounds confident vs hedging ("I think", "maybe", "sort of")?
- Structure: Uses a clear framework (STAR/CAR/direct)?

IMPORTANT: Return ONLY a valid JSON object. No markdown formatting, no code fences (no ```), no explanation text before or after. Raw JSON only.
{{
  "scores": {{
    "relevance": 7.5,
    "clarity": 8.0,
    "depth": 7.0,
    "confidence": 6.5,
    "structure": 7.0
  }},
  "feedback": {{
    "strength": "1-2 sentences on what was done well",
    "gap": "1-2 sentences on what was missing",
    "sample_answer": "A 2-3 sentence improved answer"
  }},
  "overall_comment": "Short coaching summary"
}}"""

    try:
        raw = await async_call_gemini(prompt)
    except Exception as e:
        # Return neutral scores on Gemini API failure (quota/timeout)
        logger.error(f"[evaluate_answer] Gemini call failed: {type(e).__name__}: {e}")
        return {
            "relevance_score": 5.0, "clarity_score": 5.0, "depth_score": 5.0,
            "confidence_score": 5.0, "structure_score": 5.0,
            "feedback": {"strength": "Answer submitted.", "gap": "Could not evaluate — Gemini API limit hit."},
            "overall_comment": "Evaluation unavailable.",
        }

    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)

    try:
        result = json.loads(cleaned)
        scores = result.get("scores", {})
        return {
            "relevance_score": float(scores.get("relevance", 5.0)),
            "clarity_score": float(scores.get("clarity", 5.0)),
            "depth_score": float(scores.get("depth", 5.0)),
            "confidence_score": float(scores.get("confidence", 5.0)),
            "structure_score": float(scores.get("structure", 5.0)),
            "feedback": result.get("feedback", {}),
            "overall_comment": result.get("overall_comment", ""),
        }
    except (json.JSONDecodeError, TypeError, ValueError):
        return {
            "relevance_score": 5.0, "clarity_score": 5.0, "depth_score": 5.0,
            "confidence_score": 5.0, "structure_score": 5.0,
            "feedback": {}, "overall_comment": "Could not evaluate answer.",
        }
