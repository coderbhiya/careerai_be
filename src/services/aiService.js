const OpenAi = require("openai");
const fs = require("fs");
const path = require("path");

// Env-configurable parameters
const OPENAI_MODEL = process.env.OPENAI_MODEL;
const OPENAI_TEMPERATURE = Number(process.env.OPENAI_TEMPERATURE ?? 0.7);
const OPENAI_MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 700);
const CHAT_MAX_FILES = Number(process.env.CHAT_MAX_FILES ?? 5);
const CHAT_FILE_UPLOAD_CONCURRENCY = Number(process.env.CHAT_FILE_UPLOAD_CONCURRENCY ?? 3);

// Resolve the backend root (../../ from this services directory)
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");

// Simple in-memory cache of uploaded file IDs keyed by abs path + size + mtime
const fileUploadCache = new Map();
const MAX_CACHE_ENTRIES = 200;

function setCache(key, value) {
  if (fileUploadCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = fileUploadCache.keys().next().value;
    if (firstKey) fileUploadCache.delete(firstKey);
  }
  fileUploadCache.set(key, value);
}

function getCacheKey(absPath, stat) {
  return `${absPath}|${stat.size}|${stat.mtimeMs}`;
}

function isPathInsideRoot(root, target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

const chatWithAI = async (userMessage, files = []) => {
  try {
    if (!client) throw new Error("OpenAI client not initialized");
    const model = OPENAI_MODEL || process.env.OPENAI_MODEL;
    if (!model) throw new Error("OPENAI_MODEL is not configured");

    const content = [];

    // Upload and attach files with caching, safety, async FS, and bounded concurrency
    if (Array.isArray(files) && files.length > 0) {
      const selectedFiles = files.slice(0, Math.max(0, CHAT_MAX_FILES));

      const handler = async (f) => {
        try {
          const rawPath = String(f.path || "");
          if (!rawPath) return null;

          const normalizedPath = path.resolve(BACKEND_ROOT, rawPath.replace(/^\//, ""));
          if (!isPathInsideRoot(BACKEND_ROOT, normalizedPath)) {
            console.warn(`Blocked file outside root: ${normalizedPath}`);
            return null;
          }

          // Async access & stat to avoid blocking the event loop
          try {
            await fs.promises.access(normalizedPath, fs.constants.R_OK);
          } catch {
            console.warn(`File not readable or not found: ${normalizedPath} (source: ${rawPath})`);
            return null;
          }

          let stat;
          try {
            stat = await fs.promises.stat(normalizedPath);
          } catch (e) {
            console.warn(`Unable to stat file: ${normalizedPath}`, e?.message);
            return null;
          }

          const cacheKey = getCacheKey(normalizedPath, stat);
          const cached = fileUploadCache.get(cacheKey);
          if (cached?.fileId) {
            return { type: "input_file", file_id: cached.fileId };
          }

          // Upload to OpenAI
          const uploaded = await client.files.create({
            file: fs.createReadStream(normalizedPath),
            purpose: "assistants",
          });
          setCache(cacheKey, { fileId: uploaded.id });

          const isPDF = normalizedPath.endsWith(".pdf");
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/.test(normalizedPath);

          if (isImage) {
            return { type: "input_image", file_id: uploaded.id };
          }

          return { type: "input_file", file_id: uploaded.id };
        } catch (uploadErr) {
          console.warn(`Failed to attach file: ${f?.path}`, uploadErr?.message);
          return null;
        }
      };

      const batchSize = Math.max(1, CHAT_FILE_UPLOAD_CONCURRENCY);
      const batches = chunkArray(selectedFiles, batchSize);
      for (const batch of batches) {
        const results = await Promise.all(batch.map((f) => handler(f)));
        for (const r of results) if (r) content.push(r);
      }
    }

    content.push({ type: "input_text", text: userMessage });

    const response = await client.responses.create({
      model: model,
      // temperature: OPENAI_TEMPERATURE,
      max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      input: [
        {
          role: "user",
          content: content,
        },
      ],
    });

    console.log("OpenAI Response:", response);

    return response.output_text;
  } catch (err) {
    console.error("chatWithAI error:", err?.message || err);
    throw err;
  }
};

module.exports = {
  chatWithAI,
};

