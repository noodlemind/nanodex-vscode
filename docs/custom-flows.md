# Custom Flows Guide

Quick guide to creating and using custom flows in nanodex.

## What are Custom Flows?

Custom flows let you create reusable, multi-step AI workflows for your specific needs.

## Creating a Custom Flow

**Using the Command:**
1. Run **Nanodex: Create Custom Flow**
2. Enter name and description
3. Choose location (`.nanodex/flows/` recommended)
4. Edit the generated YAML file

**Example Flow:**
```yaml
id: custom.flow.example
intent: "Example custom flow"
inputs:
  - name: goal
    required: true

steps:
  - name: "Analyze"
    agentId: "nanodex.specialist.repo-research-analyst"
    prompt: "Analyze {goal}"
    
  - name: "Recommend"
    agentId: "nanodex.specialist.best-practices-researcher"
    prompt: "Provide recommendations for {goal}"
```

## Running Custom Flows

- **Command:** Nanodex: Run Custom Flow
- **Chat:** `@nanodex /flow-name`

## Available Agents

- `nanodex.specialist.repo-research-analyst` - Code analysis
- `nanodex.specialist.best-practices-researcher` - Best practices
- `nanodex.specialist.security-sentinel` - Security analysis
- `nanodex.specialist.performance-oracle` - Performance
- `nanodex.core.documenter` - Documentation
- And many more in `extension/src/agents/`

## Example: Security Review

```yaml
id: custom.flow.security-review
intent: "Security audit of codebase"

steps:
  - name: "Find Vulnerabilities"
    agentId: "nanodex.specialist.security-sentinel"
    prompt: |
      Analyze for:
      - SQL injection
      - XSS vulnerabilities
      - Auth issues
      
  - name: "Provide Fixes"
    agentId: "nanodex.specialist.best-practices-researcher"
    prompt: "Provide remediation steps"
```

## Configuration

```jsonc
{
  "nanodex.flows.paths": [
    ".nanodex/flows/*.flow.yaml",
    "flows/*.flow.yaml"
  ]
}
```

## See Also

- Example flow: `.nanodex/flows/example.flow.yaml`
- Built-in flows: `extension/src/prompts/flows/`
- README: Custom Flows section
