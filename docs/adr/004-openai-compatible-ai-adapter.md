# ADR 004 - OpenAI-compatible AI provider adapter

Status: Accepted. Date: 2026-09-03.

All AI calls go through one adapter speaking the OpenAI chat-completions protocol with tool
calling. Azure OpenAI, OpenAI, and local servers (Ollama, vLLM, LM Studio) are selected by
`AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL`. Prompts are versioned in a registry; every
interaction is logged with token counts and user acceptance for quality tracking. No tenant
data leaves the tenant boundary in a prompt.
