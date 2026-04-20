const OpenAi = require("openai");
const client = new OpenAi({
    apiKey: process.env.OPENAI_API_KEY,
});
const OPENAI_MODEL = process.env.OPENAI_MODEL;

module.exports = {
    client,
    OPENAI_MODEL
}