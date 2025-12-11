# nanodex for VS Code

**Structured context + compounding flows for predictable coding agents.**  
nanodex builds a local **knowledge graph** of your workspace (Context Engineering) and runs **multi‑step Plan/Work flows** (Compounding Engineering) using the **model you select** in VS Code.

> **Requires VS Code ≥ 1.105** · Local‑first: nothing leaves your machine unless your chosen model/provider sends it.

---

## Install

- **Marketplace:** search “**nanodex**” and install  
- **VSIX:** `code --install-extension nanodex-*.vsix`

---

## Quick Start

1. **Open** a repo in VS Code.  
2. **Invoke nanodex**  
   - **Chat:** `@nanodex …` (uses the **active Chat model**)  
   - **Command Palette:** **Nanodex: Plan** → then **Nanodex: Work** (uses your **configured default model**)  
3. First use in this workspace: nanodex **auto‑indexes** into `.nanodex/graph.sqlite`.  
4. **Plan** creates a local issue at `.nanodex/issues/ISSUE-*.yml`.  
5. **Work** executes that issue and proposes **WorkspaceEdits** as **preview** for approval.

---

## What it does

- **Workspace knowledge graph** (`.nanodex/graph.sqlite`)  
  - Nodes: symbols, modules, capabilities, concepts, errors, recipes  
  - Edges: `calls`, `imports`, `implements`, `extends`, `throws`, `depends_on`
- **Structured context injection**  
  - Minimal, relevant subgraphs + short summaries → prompt sections (facts / relations / entrypoints)
- **Compounding flows**  
  - **Plan/Work** orchestrate specialized agents behind simple commands
- **Graph freshness**  
  - Auto‑refresh after accepted edits, file saves/renames, and branch switches (manual reindex optional)
- **Model‑agnostic**  
  - Chat uses the **active Chat model**; commands use your **default model**

---

## Commands

- **Nanodex: Plan** — gather goal/acceptance/constraints → write `.nanodex/issues/ISSUE-*.yml`  
- **Nanodex: Work** — pick issue → run flow → propose edits as preview

**Operational (optional):** Index Workspace · Reindex Changed Files · Graph Stats · Clear Index · Select Default Model  
> Chat equivalents: `@nanodex plan`, `@nanodex work ISSUE‑…`, etc.

---

## How this differs from VS Code AI features (incl. Planning)

- **Graph‑backed context vs. generic chat**: nanodex builds a **workspace knowledge graph** and injects minimal, relevant subgraphs into prompts. VS Code AI surfaces do not provide this graph extraction today.
- **Compounding Plan/Work flows**: nanodex orchestrates **multi‑step agents** (Plan → Work) with workspace edits as previews. The built‑in planner is single‑surface; it does not maintain issue artifacts or run graph‑scoped Work phases.
- **Sticky instruction merging**: `AGENTS.md` and `*.instructions.md` are merged into agent prompts automatically, keeping **repo‑specific guidance** bound to flows. Native chat/planning requires manual reminders per session.
- **Local‑first index + privacy**: graph + issues stay in `.nanodex/`; only your chosen model provider sees prompts. VS Code AI features depend on the provider’s own data path.

### Using new VS Code planning with nanodex

- You can still run **Nanodex: Plan/Work** while using the built‑in planner for other tasks; they are independent.
- If you prefer VS Code’s planner UI but want nanodex context, trigger **Nanodex: Work** on an existing `.nanodex/issues/ISSUE-*.yml` (or chat `@nanodex work ISSUE‑…`) to reuse the graph‑aware Work phase.
- To align with the new planner, consider setting your **default model** to match the **Chat** model so both share capabilities, and keep auto‑indexing on for fresh graph context.

**AI SDK integration:** nanodex now registers VS Code **Language Model Tools** `nanodex.context` (graph context) and `nanodex.issues` (Plan/Work issues). Built‑in planners or other participants can call these tools directly to reuse nanodex context without switching surfaces.

---

## Model behavior

- **Chat (`@nanodex`)** → uses the **Chat panel’s active model** (user‑selected)  
- **Commands (Plan/Work)** → use the **configured default model**

```jsonc
// .vscode/settings.json (examples)
{
  "nanodex.defaultModel": "copilot/gpt-4o-lite",
  "nanodex.chat.modelStrategy": "useChatModel"   // or "useConfiguredModel"
}
```

---

## Specialized agents (how they’re used)

* Agents are **role definitions** (YAML/JSON/TSX) in `extension/agents/`.
* Flows live in `extension/prompts/flows/` and define ordered steps:
  **(agent + prompt fragment + graph context spec)**
* The planner selects/combines agents based on **graph evidence** and user input.
* Workspaces can **override/add** agents via instruction files (below).

---

## Custom instructions & guidelines

* **`AGENTS.md`** (repo root) is **first‑class** and merged into agent/flow prompts.
* **Custom Language / Framework / Module instructions** are stored as `*.instructions.md` files:

  * Place them under `instructions/` or `.nanodex/instructions/`
  * Name by **language** or **module**, e.g.:

    * `typescript.instructions.md`, `java.instructions.md`
    * `frontend.instructions.md`, `backend.instructions.md`, `payments.instructions.md`
  * Optional front‑matter to scope application:

    ```md
    ---
    scope:
      languages: [typescript]
      modules:   [frontend]
    ---
    Prefer functional components; enforce strict null checks; avoid implicit any…
    ```

**Loading & precedence (low → high)**

1. Extension defaults
2. `AGENTS.md`
3. `*.instructions.md` (language/module‑scoped)
4. Flow prompt fragments (Plan/Work)
5. Per‑run user input

**Config (paths)**

```jsonc
{
  "nanodex.instructions.files": [
    "AGENTS.md",
    "instructions/**/*.instructions.md",
    ".nanodex/instructions/**/*.instructions.md",
    ".github/AGENTS.md"
  ]
}
```

---

## Indexing & freshness

* **Auto incremental re‑index** on accepted edits, file saves/renames, branch switches
* **Manual controls** available: **Reindex Changed Files** / **Index Workspace** / **Clear Index**

```jsonc
{
  "nanodex.index.auto": true,
  "nanodex.index.autoReindexMode": "onApply",   // "onApply" | "onSave" | "off"
  "nanodex.index.exclude": ["**/.git/**","**/node_modules/**","**/build/**","**/dist/**"],
  "nanodex.index.useScip": true,
  "nanodex.index.maxWorkers": 4
}
```

---

## Minimal layout

```
nanodex-vscode/
├─ extension/
│  ├─ chat/participant.ts
│  ├─ commands/{plan,work,...}.ts
│  ├─ core/{graph,router,prompts}.ts
│  ├─ agents/                         # built-in agent defs
│  └─ prompts/flows/{plan,work}.yaml  # compounding flows
├─ instructions/                      # your *.instructions.md (optional)
├─ .nanodex/                          # graph + issues (generated)
└─ README.md
```

---

## Privacy

* Graph and artifacts live **locally** under `.nanodex/`
* Edits are **previewed**; never applied without approval
* Data egress depends on the model/provider you select

---

## License

Code: **Apache‑2.0**
You are responsible for licenses of any models/providers you choose and the repositories you index.
