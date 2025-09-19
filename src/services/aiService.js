const OpenAi = require("openai");
const OPENAI_MODEL = process.env.OPENAI_MODEL;
const fs = require("fs");
const path = require("path");

const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

const chatWithAI = async (userMessage, files = []) => {
  try {
    const content = [];

    if (files && files.length > 0) {
      for (const f of files) {
        console.log(f);

        const filePath = path.resolve(__dirname, "../../", f.path);
        // check file exist in path
        if (!fs.existsSync(filePath)) {
          console.warn(`File not found: ${filePath}`);
          continue;
        }

        const uploaded = await client.files.create({
          file: fs.createReadStream(path.join(__dirname, "../../" + f.path)),
          purpose: "assistants",
        });
        content.push({
          type: "input_file",
          file_id: uploaded.id,
        });
      }
    }

    content.push({
      type: "input_text",
      text: userMessage,
    });

    const response = await client.responses.create({
      model: `${process.env.OPENAI_MODEL}`,
      input: [
        {
          role: "user",
          content: content,
        },
      ],
    });

    return response.output_text;
  } catch (err) {
    console.log("Chat With assitant err:", err);
    throw err;
    return "Error1: Unable to process your files. Please try again.";
  }
};

const chatWithAIV2 = async (userMessage, files = []) => {
  try {
    // 1️⃣ Upload files to OpenAI
    const uploadedFileIds = [];
    for (const f of files) {
      const uploaded = await client.files.create({
        file: fs.createReadStream(f.path),
        purpose: "assistants",
      });
      uploadedFileIds.push(uploaded.id);
    }

    // 2️⃣ Create or reuse an Assistant with file_search
    const assistant = await client.beta.assistants.create({
      name: "CareerAI",
      instructions: "You are CareerAI, a friendly career coach. Analyze uploaded resumes, portfolios, or project files and give career advice.",
      model: `${process.env.OPENAI_MODEL}`,
      tools: [{ type: "file_search" }], // Enables file analysis
    });

    // 3️⃣ Create a new thread (conversation)
    const thread = await client.beta.threads.create();

    console.log(thread);

    // 4️⃣ Post user message with file attachments
    await client.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage,
      attachments: uploadedFileIds.map((id) => ({ file_id: id })),
    });

    // 5️⃣ Run the assistant on this thread
    const run = await client.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });

    console.log(run);

    // 6️⃣ Poll for completion
    let runStatus = await client.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== "completed" && runStatus.status !== "failed") {
      await new Promise((res) => setTimeout(res, 1000));
      runStatus = await client.beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (runStatus.status === "failed") {
      throw new Error("Assistant run failed.");
    }

    // 7️⃣ Get the messages after the assistant replied
    const messages = await client.beta.threads.messages.list(thread.id);
    const assistantMsg = messages.data.find((m) => m.role === "assistant");

    return assistantMsg?.content?.[0]?.text?.value || "No response received.";
  } catch (err) {
    console.error("chatWithAI error:", err);
    return "Error: Unable to process your files. Please try again.";
  }
};

module.exports = {
  chatWithAI,
};
