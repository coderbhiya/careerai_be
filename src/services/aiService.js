const OpenAi = require("openai");
const OPENAI_MODEL = process.env.OPENAI_MODEL;

const client = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

const chatWithAI = async (messages) => {
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "user",
        content: messages,
      },
    ],
    // temperature: 0.7,
    // max_tokens: 400,
  });
  return completion.choices[0].message.content;
};

module.exports = {
  chatWithAI,
};
