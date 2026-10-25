import express from "express";
import helmet from "helmet";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 6000;

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "40kb" }));

// Small in-memory limiter for a local demo. Use a shared store / gateway in production.
const requestLog = new Map();
app.use("/api", (req, res, next) => {
  const key = req.ip || "unknown";
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter(t => now - t < 60_000);
  if (recent.length >= 20) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  }
  recent.push(now);
  requestLog.set(key, recent);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: `Send between 1 and ${MAX_MESSAGES} messages.` });
  }

  const cleaned = [];
  for (const item of messages) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") {
      return res.status(400).json({ error: "Messages must have a valid role and text content." });
    }
    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({ error: `Each message must be 1–${MAX_MESSAGE_CHARS} characters.` });
    }
    cleaned.push({ role: item.role, content });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: "The AI service isn't configured yet. Add OPENAI_API_KEY to your .env file and restart the server."
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are Orbit, a helpful, clear, friendly AI assistant. Be accurate, acknowledge uncertainty, and format answers with readable paragraphs and lists when useful." },
        ...cleaned
      ],
      temperature: 0.7,
      max_tokens: 1200
    });
    const answer = response.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("The model returned an empty response.");
    return res.json({ reply: answer });
  } catch (error) {
    console.error("Chat API error:", error?.status || "", error?.message || "Unknown error");
    if (error?.status === 401) {
      return res.status(502).json({ error: "The API key was rejected. Check OPENAI_API_KEY in your .env file." });
    }
    if (error?.status === 429) {
      return res.status(429).json({ error: "The AI provider is rate-limiting this request or your quota is exhausted. Check your API usage and billing." });
    }
    return res.status(502).json({ error: "Orbit couldn't get a response right now. Please try again in a moment." });
  }
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Orbit is running at http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) console.warn("OPENAI_API_KEY is not set. Add it to .env to enable real AI replies.");
});
