const db = require("../../models");
const { client, OPENAI_MODEL } = require("../../config/openaiConfig");

class ChatLibrary {
    async classification(userMessage) {
        const classification = await client.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [
                { role: "system", content: "Classify user intent as 'STUDENT','DEVELOPER', 'ENGINEER', 'PARENT', 'TEACHER', 'COUNSELLOR', 'UNIVERSITY', 'JOB', 'ADMIN'. Reply with only one word." },
                { role: "user", content: userMessage },
            ],
        });
        return classification.choices[0].message.content.trim();
    }

    async getPromtFromClassification(classification = '') {

        let dbPrompt = await db.Prompt.findOne({
            where: {
                isActive: true,
                classification: classification,
            },
            order: [["updatedAt", "DESC"]],
        });

        if (!dbPrompt) {
            dbPrompt = await db.Prompt.findOne({
                where: {
                    isActive: true,
                    classification: "DEFAULT",
                },
                order: [["updatedAt", "DESC"]],
            });

            if (!dbPrompt) {
                throw new Error("Prompt not found");
            }
        }

        return dbPrompt;
    }
}

module.exports = new ChatLibrary();