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

          // const cacheKey = getCacheKey(normalizedPath, stat);
          // const cached = fileUploadCache.get(cacheKey);
          // if (cached?.fileId) {
          //   return { type: "input_file", file_id: cached.fileId };
          // }

          // Upload to OpenAI
          const uploaded = await client.files.create({
            file: fs.createReadStream(normalizedPath),
            purpose: "assistants",
          });
          // setCache(cacheKey, { fileId: uploaded.id });

          const isPDF = normalizedPath.endsWith(".pdf");
          const isImage = normalizedPath.match(/\.(jpg|jpeg|png|gif|webp)$/);

          // console.log("isPDF:", isPDF);
          // console.log("isImage:", isImage);
          // console.log("normalizedPath:", normalizedPath);

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

    // console.log("Content:", content);

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

const summarizeFile = async (filePath, originalName) => {
  try {
    const normalizedPath = path.resolve(BACKEND_ROOT, filePath.replace(/^\//, ""));

    const uploaded = await client.files.create({
      file: fs.createReadStream(normalizedPath),
      purpose: "assistants",
    });

    const prompt = `Please provide a concise summary and extract key information from the following file: ${originalName}. If it's a resume, extract contact info, skills, and experience. If it's a job description, extract requirements and responsibilities. Formulate the output in a well-structured markdown format.`;

    const response = await client.responses.create({
      model: OPENAI_MODEL,
      max_output_tokens: 1000,
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", file_id: uploaded.id },
            { type: "input_text", text: prompt },
          ],
        },
      ],
    });

    return response.output_text;
  } catch (err) {
    console.error("summarizeFile error:", err?.message || err);
    return null;
  }
};

/**
 * Summarizes a chunk of raw chat history into a concise paragraph
 * that can later be injected as rolling context into the AI prompt.
 *
 * @param {string} formattedHistory  Output of formatChatHistory()
 * @returns {Promise<string>}         The AI-generated summary text
 */
const summarizeChatHistory = async (formattedHistory) => {
  try {
    const prompt = `You are a helpful assistant. The following is a conversation history between a user and a career AI assistant.
Please summarize this conversation into a concise, structured paragraph (max 300 words). 
Capture: the user's career goals, skills mentioned, topics discussed, any documents uploaded, and any advice given.
This summary will be used as context for future messages so preserve all important details.

--- CONVERSATION START ---
${formattedHistory}
--- CONVERSATION END ---

Summary:`;

    const response = await client.responses.create({
      model: OPENAI_MODEL,
      max_output_tokens: 500,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
    });

    return response.output_text;
  } catch (err) {
    console.error("summarizeChatHistory error:", err?.message || err);
    return null;
  }
};

/**
 * Chat with AI using OpenAI Function Calling (Tools).
 * The AI may call zero or more tools before producing its final text reply.
 *
 * @param {number}   userId         - The authenticated user's ID (needed for tool executors)
 * @param {string}   systemPrompt   - Full system prompt (already built by chatController)
 * @param {Array}    messages       - OpenAI messages array [{role, content}, ...]
 * @param {Array}    toolDefs       - Tool definitions array from aiTools.js
 * @param {Function} toolExecutor   - Async fn(userId, toolName, args) => result object
 * @returns {Promise<{reply: string, toolsUsed: string[]}>}
 */
const chatWithAITools = async (userId, systemPrompt, messages, toolDefs, toolExecutor) => {
  const model = OPENAI_MODEL;
  if (!model) throw new Error("OPENAI_MODEL is not configured");

  const toolsUsed = [];

  // Build initial messages array
  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  // Agentic loop: keep going until AI stops calling tools
  let iterations = 0;
  const MAX_ITERATIONS = 5; // safety limit

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: toolDefs,
      tool_choice: "auto",
      max_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 1000),
    });

    const assistantMessage = response.choices[0].message;

    // Push assistant's message (may contain tool_calls) into conversation
    openaiMessages.push(assistantMessage);

    // If AI wants to call tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(`[chatWithAITools] AI calling ${assistantMessage.tool_calls.length} tool(s) on iteration ${iterations}`);

      // Execute each tool call and push results back
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let args = {};

        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.warn(`[chatWithAITools] Failed to parse args for tool "${toolName}":`, e?.message);
        }

        console.log(`[chatWithAITools] Executing tool: ${toolName}`, args);

        const result = await toolExecutor(userId, toolName, args);
        toolsUsed.push(toolName);

        console.log(`[chatWithAITools] Tool "${toolName}" result:`, result);

        // Push tool result back into messages
        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Continue loop so AI can process tool results and decide next step
      continue;
    }

    // No tool calls — AI is done, return the final text reply
    const reply = assistantMessage.content || "";
    return { reply, toolsUsed };
  }

  throw new Error("chatWithAITools exceeded maximum iteration limit");
};

module.exports = {
  chatWithAI,
  summarizeFile,
  summarizeChatHistory,
  chatWithAITools,
};

