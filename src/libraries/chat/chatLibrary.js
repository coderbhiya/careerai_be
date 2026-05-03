const db = require("../../models");
const { client, OPENAI_MODEL } = require("../../config/openaiConfig");

class ChatLibrary {
    async classification(userMessage) {
        const classification = await client.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [
                {
                    role: "system",
                    content: "Classify user intent into one or more of the following categories: 'STUDENT', 'DEVELOPER', 'ENGINEER', 'PARENT', 'TEACHER', 'COUNSELLOR', 'UNIVERSITY', 'JOB', 'ADMIN'. If multiple categories apply, return them as a comma-separated list. Reply only with the categories."
                },
                { role: "user", content: userMessage },
            ],
        });

        const resultsRaw = classification.choices[0].message.content.trim();
        const intentsArray = resultsRaw.split(',').map(item => item.trim());

        return intentsArray;
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
        }

        return dbPrompt?.content || '';
    }
}

module.exports = new ChatLibrary();