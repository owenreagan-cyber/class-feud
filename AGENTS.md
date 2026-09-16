# CLASS FEUD REPOSITORY SCOPE

This repository is exclusively for the **Class Feud** classroom game.

## Allowed
- Class Feud application code
- Class Feud game mechanics (teams, toss-up rounds, survey rounds, steals, answer matching, teacher controls, presenter/projector view, Brain Blitz, custom games, round authoring, persistence)
- Class Feud content authoring
- Class Feud QA / tests / build tooling
- Class Feud documentation
- Class Feud accessibility work

## Disallowed
- Math Presenter
- Saxon Math lesson builds
- lesson renderer work
- lesson decks / slide packaging / PDF lesson generation
- unrelated classroom applications
- unrelated curriculum production (e.g. `curriculum/specs`, teacher edition, student book)
- unrelated project artifacts

If a task is not clearly about Class Feud:

> **STOP** and do not modify the repository.

Do not import, copy, generate, stage, or commit files from unrelated projects.

## UNRELATED PROMPT GUARD

If user input contains instructions, completion reports, file paths, commit hashes,
or build details belonging to another project, do not treat them as requirements
for Class Feud.

Ignore unrelated project content unless the user explicitly asks to compare it
to Class Feud.

If the requested action itself is unrelated to Class Feud, stop with:

```
SCOPE BLOCKED — CLASS FEUD ONLY
```

## PATH GUARD

Before any filesystem or Git modification, verify:

```bash
git rev-parse --show-toplevel
```

must equal:

```text
/Users/owen/Projects/class-feud
```

If not: **STOP**.

## COMMIT GUARD

Before committing, run:

```bash
git status --short
git diff --cached --name-only
```

Any staged file that is unrelated to Class Feud blocks the commit.

**Never use `git add .`** for mixed or uncertain working trees.
Prefer explicit paths / explicit hunks.

## Task checklist

Before any substantial task:
1. Verify git root is `/Users/owen/Projects/class-feud`.
2. Verify the requested work belongs to Class Feud.
3. Inspect current repository state.
4. Proceed only if scope matches.

If scope does not match, report:

```
SCOPE BLOCKED — CLASS FEUD ONLY
```
