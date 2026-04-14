import json
import re
from app.utils.gemini import call_gemini


def generate_questions(parsed_profile: dict, job_title: str, required_skills: list, nice_to_have: list, missing_skills: list) -> list[dict]:
    prompt = f"""You are an expert technical interviewer. Generate exactly 10 interview questions for this candidate.

CANDIDATE PROFILE SUMMARY:
- Name: {parsed_profile.get('name', 'Candidate')}
- Current Title: {parsed_profile.get('current_title', 'N/A')}
- Years of Experience: {parsed_profile.get('total_years_experience', 0)}
- Key Skills: {', '.join(parsed_profile.get('skills', {}).get('hard_skills', [])[:10])}

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

Return ONLY a JSON array, no markdown, no code fences:
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
        raw = call_gemini(prompt)
    except Exception:
        return []

    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")

    # Extract JSON array even if there's preamble text
    match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return []


def evaluate_answer(question: str, answer_text: str, job_title: str) -> dict:
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

Return ONLY this JSON, no markdown:
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
        raw = call_gemini(prompt)
    except Exception:
        # Return neutral scores on Gemini API failure (quota/timeout)
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
