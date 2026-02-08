# Enhancement Ideas (Parked for Later Discussion)

## Tier 1 — High Impact, Unique to Babylon.js

| Tool | What It Does | Why It Matters |
|---|---|---|
| `analyze_babylon_scene` | Parse `.babylon` / `.glb` scene files, report node hierarchy, material assignments, poly counts, texture sizes | AI agents currently can't "see" inside 3D scene files |
| `generate_playground` | Generate a Babylon.js Playground URL from a code snippet or natural language description | Instant shareable demos |
| `validate_babylon_scene` | Check scene files for common issues: missing textures, orphan nodes, oversized meshes, broken material references | Automated QA |
| `migrate_babylon_api` | Given old Babylon.js code, identify deprecated APIs and suggest replacements with the current API | #1 community pain point |

## Tier 2 — Medium Impact, Strong Utility

| Tool | What It Does |
|---|---|
| `configure_pbr_material` | Generate PBR material setup code from descriptions with correct texture channel mappings |
| `setup_havok_physics` | Generate Havok physics configuration: collision shapes, body types, constraints |
| `create_animation` | Generate Animation/AnimationGroup code from descriptions |
| `build_node_material` | Generate/modify Node Material Editor JSON |
| `search_playground_examples` | Search Babylon.js Playground database (~3000+ examples) |
| `inspect_live_scene` | Connect to running Babylon.js app via WebSocket, expose scene graph data |

## Tier 3 — Exploratory / Advanced

| Tool | What It Does |
|---|---|
| `optimize_scene_performance` | Analyze scene for draw call reduction, LOD, texture atlasing, instancing |
| `generate_shader` | Generate custom GLSL/WGSL shader code for ShaderMaterial |
| `scaffold_project` | Generate new Babylon.js project structure with chosen features |
| `explain_render_pipeline` | Given a scene config, explain the rendering pipeline step by step |

## Architecture Improvements Needed

- Service registry pattern (for non-search tool backends)
- WebSocket/SSE support (for live scene inspection)
- Authentication/authorization layer
- Middleware/plugin architecture
- Migration from `@xenova/transformers` to `@huggingface/transformers` v3
