import base64
import io
from typing import Optional

import torch
import torch.nn.functional as F
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from transformers import AutoProcessor, AutoModel
import uvicorn

app = FastAPI(title="FlowState Local Semantic Classifier", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = "google/embeddinggemma-2"
CLASSIFY_PREFIX = "task: classification | query: "
QUERY_PREFIX = "task: search result | query: "
DOC_PREFIX = "title: none | text: "

print(f"Loading {MODEL_NAME} (multimodal: text + image) for local zero-cloud classification...", flush=True)
processor = AutoProcessor.from_pretrained(MODEL_NAME)
model = AutoModel.from_pretrained(MODEL_NAME, dtype=torch.float32)
model.eval()

# Semantic Category Anchors (15 High-Resolution Productivity Categories)
ANCHORS = {
    "Software Engineering": {
        "text": "writing and editing source code, visual studio code, cursor ide, antigravity ide, rust cargo compiler, git commit, terminal command, debugging typescript, backend programming, node.js, python scripts, refactoring functions, postman api testing, insomnia rest client, swagger api docs, curl requests",
        "score": 2,
    },
    "AI & Prompt Engineering": {
        "text": "interacting with AI agents, gemini, chatgpt, claude, local LLM inference, huggingface transformers, pytorch model training, jupyter notebook, prompt testing, evaluation datasets, ai pair programming",
        "score": 2,
    },
    "Architecture & System Design": {
        "text": "software architecture diagram, database schema design, technical design specification, system topology, API contract, ADR decision record, mermaid flowcharts, microservices planning",
        "score": 2,
    },
    "DevOps & Infrastructure": {
        "text": "docker container build, kubernetes clusters, AWS cloud console, terraform deployment, CI/CD pipeline, server bash terminal, monitoring metrics, linux sysadmin",
        "score": 2,
    },
    "Research & Documentation": {
        "text": "technical documentation, developer guide, API reference, documentation manual, tauri docs, rust language reference, stack overflow programming solutions, MDN web documentation, developer documentation page, guides and tutorials, code documentation, npmjs, crates.io",
        "score": 1,
    },
    "Product & Task Planning": {
        "text": "linear issue tracker, jira sprint board, github project kanban, product requirements document, agile sprint backlog, roadmap milestones, issue estimation",
        "score": 1,
    },
    "UI/UX Design & Prototyping": {
        "text": "figma design canvas, user interface mockup, wireframing components, vector assets, svg drawing, color palette design, blender 3d modeling, 3d render, photoshop graphics",
        "score": 1,
    },
    "Writing & Knowledge Base": {
        "text": "obsidian second brain, personal knowledge management, markdown notes, journal entry, technical writing, essay drafting, article publishing, notion wiki",
        "score": 1,
    },
    "Finance & Admin Operations": {
        "text": "financial spreadsheets, excel budgeting, invoice processing, stripe payments, banking dashboard, accounting ledger, tax filing, receipt bookkeeping, pdf document reader, presentation slides",
        "score": 0,
    },
    "System Utilities & Files": {
        "text": "windows file explorer, folder browser, file directory, file manager, system settings, desktop taskbar, control panel, disk partitions, file navigation, system utilities",
        "score": 0,
    },
    "Team Communication": {
        "text": "slack team channels, discord developer messages, microsoft teams chat, async work updates, mattermost, work email threads, outlook inbox",
        "score": -1,
    },
    "Meetings & Video Calls": {
        "text": "google meet video call, zoom conference room, calendar scheduling, screen sharing meeting, audio huddle, sync discussion",
        "score": -1,
    },
    "Video & Media Streaming": {
        "text": "youtube video playback, youtube music, spotify music player, listening to songs, music streaming, podcast player, watching videos online, movie stream, netflix, twitch live broadcast, anime stream, media player, soundcloud, vlc",
        "score": -2,
    },
    "Social Media & Feeds": {
        "text": "twitter timeline, x.com feed, reddit viral posts, instagram reels, tiktok short videos, facebook social feed, threads app, doomscrolling social network",
        "score": -2,
    },
    "Gaming & Leisure": {
        "text": "roblox, robloxplayerbeta, roblox client, minecraft, steam library, steam games, epic games launcher, video game, playing computer games, gog galaxy, riot games, league of legends, valorant, csgo, counter-strike 2, genshin impact, honkai star rail, fortnite, apex legends, overwatch, call of duty, blizzard battle.net, gaming lobby, game controller, gameplay, twitch gaming, electronic arts, ubisoft connect, unity game, unreal engine game, playstation, xbox, nintendo, pc gaming, online multiplayer, simulator game, rpg, fps game, game client",
        "score": -2,
    },
    "Productivity & Tracking": {
        "text": "flowstate desktop focus tracker, flowpill timer overlay",
        "score": 2,
    },
}

def get_embedding(text: str, image: Optional[Image.Image] = None) -> torch.Tensor:
    # Text and/or one image share the same 768-d space; image adds <|image|> placeholder tokens.
    if image is not None:
        text = f"{text} <|image|>"
    kwargs = {"text": [text], "return_tensors": "pt"}
    if image is not None:
        kwargs["images"] = [image]
    inputs = processor(**kwargs)
    with torch.no_grad():
        hidden = model(**inputs).last_hidden_state
        mask = inputs["attention_mask"].unsqueeze(-1).to(hidden.dtype)
        embeddings = (hidden * mask).sum(dim=1) / mask.sum(dim=1)
        return F.normalize(embeddings, p=2, dim=1)

print("Pre-computing semantic category anchor embeddings...", flush=True)
anchor_vectors = {}
for cat, data in ANCHORS.items():
    anchor_vectors[cat] = get_embedding(CLASSIFY_PREFIX + data["text"])
print("Ready for local classification inference on :8105.", flush=True)

# In-memory bounded LRU cache to avoid re-embedding identical window titles
MAX_CACHE_SIZE = 2048
title_cache = {}

def set_cached_response(key: str, response: "ClassifyResponse"):
    if len(title_cache) >= MAX_CACHE_SIZE:
        title_cache.pop(next(iter(title_cache)))
    title_cache[key] = response

class ClassifyRequest(BaseModel):
    app: str
    title: str

class ClassifyResponse(BaseModel):
    category: str
    productivity_score: int
    confidence: float
    is_ai: bool = True

class NoteRequest(BaseModel):
    text: str = ""
    image_b64: Optional[str] = None

class NoteResponse(BaseModel):
    kind: str  # "quick_thought" | "bug" | "feature" | "todo"
    confidence: float
    embedding: list[float]

NOTE_KINDS = {
    "quick_thought": "quick thought: a passing idea, reminder or observation to remember",
    "bug": "bug report: something broken, error, crash, wrong behaviour or failing test",
    "feature": "feature request: a new capability, improvement or product idea to build",
    "todo": "to-do: a concrete action item or task the user must do",
}
kind_vectors = {k: get_embedding(CLASSIFY_PREFIX + v) for k, v in NOTE_KINDS.items()}

@app.post("/note-analyze", response_model=NoteResponse)
def note_analyze(req: NoteRequest):
    image = None
    if req.image_b64:
        image = Image.open(io.BytesIO(base64.b64decode(req.image_b64))).convert("RGB")
    text = req.text.strip() or "screenshot note"
    # Stored note embedding: document-side prefix, so AI queries (query prefix) rank it correctly.
    vec = get_embedding(DOC_PREFIX + text, image)
    best_kind, best_sim = "quick_thought", -1.0
    for kind, kv in kind_vectors.items():
        sim = F.cosine_similarity(vec, kv).item()
        if sim > best_sim:
            best_kind, best_sim = kind, sim
    return NoteResponse(kind=best_kind, confidence=round(best_sim, 3), embedding=vec[0].tolist())

class EmbedRequest(BaseModel):
    texts: list[str]

@app.post("/embed")
def embed(req: EmbedRequest):
    # Query-side embeddings for ranking notes against an AI prompt.
    vecs = [get_embedding(QUERY_PREFIX + t)[0].tolist() for t in req.texts]
    return {"embeddings": vecs}

@app.post("/classify", response_model=ClassifyResponse)
def classify_window(req: ClassifyRequest):
    cache_key = f"{req.app}::{req.title}"
    if cache_key in title_cache:
        return title_cache[cache_key]

    app_lower = req.app.lower()
    title_lower = req.title.lower()

    # 1. High-accuracy deterministic heuristic overrides
    if (
        "roblox" in app_lower
        or "roblox" in title_lower
        or "minecraft" in app_lower
        or "steam" in app_lower
        or "epicgames" in app_lower
        or "riotclient" in app_lower
        or "valorant" in app_lower
        or "genshin" in app_lower
        or "fortnite" in app_lower
        or "overwatch" in app_lower
    ):
        res = ClassifyResponse(
            category="Gaming & Leisure",
            productivity_score=-2,
            confidence=0.99,
            is_ai=True,
        )
        set_cached_response(cache_key, res)
        return res

    if "flowstate" in app_lower or "flowstate" in title_lower or "flowpill" in title_lower:
        res = ClassifyResponse(
            category="Productivity & Tracking",
            productivity_score=2,
            confidence=0.99,
            is_ai=True,
        )
        set_cached_response(cache_key, res)
        return res

    # Check anime.js before anime
    if "anime.js" in title_lower or "animejs" in title_lower:
        res = ClassifyResponse(
            category="Software Engineering",
            productivity_score=2,
            confidence=0.99,
            is_ai=True,
        )
        set_cached_response(cache_key, res)
        return res

    if any(k in title_lower for k in ("youtube", "spotify", "twitch", "netflix", "soundcloud")) or (
        "anime" in title_lower and not ("anime.js" in title_lower or "animejs" in title_lower)
    ):
        res = ClassifyResponse(
            category="Video & Media Streaming",
            productivity_score=-2,
            confidence=0.99,
            is_ai=True,
        )
        set_cached_response(cache_key, res)
        return res

    if any(k in title_lower for k in ("reddit", "twitter", "x.com", "facebook", "instagram", "tiktok")):
        res = ClassifyResponse(
            category="Social Media & Feeds",
            productivity_score=-2,
            confidence=0.99,
            is_ai=True,
        )
        set_cached_response(cache_key, res)
        return res

    if any(k in title_lower for k in ("| messenger", "messenger —", "discord", "slack")) or any(
        k in app_lower for k in ("discord", "slack", "teams", "telegram", "viber", "whatsapp")
    ):
        res = ClassifyResponse(
            category="Team Communication",
            productivity_score=-1,
            confidence=0.99,
            is_ai=True,
        )
        set_cached_response(cache_key, res)
        return res

    if "polymarket" in title_lower or "binance" in title_lower or "tradingview" in title_lower:
        res = ClassifyResponse(
            category="Finance & Admin Operations",
            productivity_score=0,
            confidence=0.99,
            is_ai=True,
        )
        set_cached_response(cache_key, res)
        return res

    if any(k in app_lower or k in title_lower for k in ("chatgpt", "google gemini", "claude", "qwen")):
        res = ClassifyResponse(
            category="AI & Prompt Engineering",
            productivity_score=2,
            confidence=0.99,
            is_ai=True,
        )
        set_cached_response(cache_key, res)
        return res

    if (
        "antigravity" in app_lower
        or "antigravity" in title_lower
        or "opencode" in app_lower
        or app_lower == "code.exe"
        or app_lower == "code"
        or "vscode" in app_lower
        or "cursor" in app_lower
        or "pycharm" in app_lower
        or "idea64" in app_lower
    ):
        res = ClassifyResponse(
            category="Software Engineering",
            productivity_score=2,
            confidence=0.99,
            is_ai=True,
        )
        set_cached_response(cache_key, res)
        return res

    # 2. Local Neural Embedding Classification (EmbeddingGemma-2)
    full_text = f"Application: {req.app}. Window: {req.title}"
    query_vec = get_embedding(CLASSIFY_PREFIX + full_text)

    best_cat = "System Utilities & Files"
    best_score = 0
    best_sim = -1.0

    for cat, data in ANCHORS.items():
        if cat == "Productivity & Tracking":
            continue
        sim = F.cosine_similarity(query_vec, anchor_vectors[cat]).item()
        if sim > best_sim:
            best_sim = sim
            best_cat = cat
            best_score = data["score"]

    res = ClassifyResponse(
        category=best_cat,
        productivity_score=best_score,
        confidence=round(best_sim, 3),
        is_ai=True,
    )
    set_cached_response(cache_key, res)
    return res

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8105)
