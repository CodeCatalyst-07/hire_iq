from app.models.job import JobPosting


def compute_score(parsed: dict, job: JobPosting) -> dict:
    """Compute weighted candidate score against the job posting."""
    weights = job.scoring_weights or {
        "skills_match": 0.35,
        "experience": 0.25,
        "education": 0.15,
        "certifications": 0.10,
        "projects": 0.10,
        "completeness": 0.05,
    }

    # --- Skills Match ---
    required = {s.lower() for s in (job.required_skills or [])}
    candidate_skills = set()
    skills_data = parsed.get("skills", {})
    for key in ("hard_skills", "tools", "languages"):
        candidate_skills.update(s.lower() for s in skills_data.get(key, []))

    matched = required & candidate_skills
    skills_score = (len(matched) / len(required) * 100) if required else 100

    nice_to_have = {s.lower() for s in (job.nice_to_have_skills or [])}
    bonus = min(len(nice_to_have & candidate_skills) * 3, 15)
    skills_score = min(100.0, skills_score + bonus)

    missing_skills = list(required - candidate_skills)

    # --- Experience Score ---
    actual_yoe = float(parsed.get("total_years_experience", 0) or 0)
    required_yoe = 3.0  # default; recruiters can customize later
    exp_score = min(actual_yoe / max(required_yoe, 1), 1.5) * 100

    # --- Education Score ---
    edu_map = {
        "phd": 100, "doctorate": 100,
        "master": 85, "msc": 85, "mba": 85, "m.s": 85,
        "bachelor": 70, "bsc": 70, "b.s": 70, "b.e": 70, "b.tech": 70,
        "associate": 50,
        "high school": 30, "diploma": 40,
    }
    edu_score = 50.0
    educations = parsed.get("education", [])
    if educations:
        highest_deg = educations[0].get("degree", "").lower()
        for key, val in edu_map.items():
            if key in highest_deg:
                edu_score = float(val)
                break

    # --- Certifications Score ---
    cert_count = len(parsed.get("certifications", []))
    cert_score = min(cert_count * 25.0, 100.0)

    # --- Projects Score ---
    proj_count = len(parsed.get("projects", []))
    proj_score = min(proj_count * 20.0, 100.0)

    # --- Completeness Score ---
    key_fields = ["name", "email", "skills", "experience", "education"]
    filled = sum(1 for f in key_fields if parsed.get(f))
    completeness_score = (filled / len(key_fields)) * 100

    # --- Weighted Total ---
    total = (
        skills_score * weights.get("skills_match", 0.35) +
        exp_score * weights.get("experience", 0.25) +
        edu_score * weights.get("education", 0.15) +
        cert_score * weights.get("certifications", 0.10) +
        proj_score * weights.get("projects", 0.10) +
        completeness_score * weights.get("completeness", 0.05)
    )

    education_level = None
    if educations:
        education_level = educations[0].get("degree")

    return {
        "total_score": round(total, 2),
        "skill_match_pct": round(skills_score, 2),
        "experience_years": actual_yoe,
        "education_level": education_level,
        "score_breakdown": {
            "skills_match": round(skills_score, 2),
            "experience": round(exp_score, 2),
            "education": round(edu_score, 2),
            "certifications": round(cert_score, 2),
            "projects": round(proj_score, 2),
            "completeness": round(completeness_score, 2),
        },
        "matched_skills": list(matched),
        "missing_skills": missing_skills,
    }
