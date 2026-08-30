from pathlib import Path

WORKFLOW = Path(__file__).parents[2] / ".github" / "workflows" / "migration-foundation.yml"


def _workflow_text() -> str:
    return WORKFLOW.read_text(encoding="utf-8")


def test_migration_foundation_workflow_is_static_and_non_publishing() -> None:
    workflow = _workflow_text()
    normalized = workflow.lower()

    assert "name: Migration foundation validation" in workflow
    assert "pull_request:" in workflow
    assert "workflow_dispatch:" in workflow
    assert "permissions:\n  contents: read" in workflow
    assert "persist-credentials: false" in workflow
    assert "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1" in workflow
    assert "python3 - <<'py'" in normalized
    assert "json.loads" in workflow
    assert "project_id" in workflow
    assert "at least one checked-in local SQL migration is required" in workflow

    forbidden = (
        "secrets.",
        "github.token",
        "github_token",
        "codex-lb-db",
        "supabase link",
        "--linked",
        "--db-url",
        "vercel deploy",
        "git push",
        "services:",
    )
    assert all(forbidden_text not in normalized for forbidden_text in forbidden)
