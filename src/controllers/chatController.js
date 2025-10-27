const path = require("path");
const db = require("../models");
const aiService = require("../services/aiService");
const fs = require("fs");

function sanitize(input) {
  if (!input) return "";
  return String(input)
    .replace(/\u0000/g, "")
    .replace(/```/g, "'``'")
    .replace(/\r/g, "")
    .trim();
}

function formatChatHistory(chatHistory = []) {
  return chatHistory
    .map((chat) => {
      let line = `${chat.role}: ${chat.message}`;
      if (chat.FileAttachments && chat.FileAttachments.length > 0) {
        const names = chat.FileAttachments.map((f) => f.originalName || f.name || "attachment").join(", ");
        line += ` [Files: ${names}]`;
      }
      return line;
    })
    .join("\n");
}

module.exports = {
  /**
   * @swagger
   * /chat:
   *   get:
   *     summary: Get user chat history
   *     tags: [Chat]
   *     responses:
   *       200:
   *         description: Chat history retrieved successfully
   *       500:
   *         description: Server error
   */
  getChats: async (req, res) => {
    try {
      const { id } = req.user;
      const chats = await db.ChatMessage.findAll({
        where: {
          userId: id,
        },
        include: [
          {
            model: db.FileAttachment,
            required: false,
          },
        ],
        order: [["id", "ASC"]],
      });

      if (chats.length === 0) {
        const firstMessage = "Hey bro, what's up? How’s life treating you? What’s your name, by the way?";
        const result = await db.ChatMessage.create({
          userId: id,
          role: "assistant",
          message: firstMessage,
        });
        return res.json({ success: true, chats: [result] });
      }

      res.json({ success: true, chats });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
  /**
   * @swagger
   * /chat:
   *   post:
   *     summary: Send a message to the AI
   *     tags: [Chat]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               message:
   *                 type: string
   *               fileAttachments:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     fileName:
   *                       type: string
   *                     originalName:
   *                       type: string
   *                     filePath:
   *                       type: string
   *                     fileType:
   *                       type: string
   *                     fileSize:
   *                       type: number
   *                     mimeType:
   *                       type: string
   *     responses:
   *       200:
   *         description: Message sent successfully
   *       500:
   *         description: Server error
   */
  sendReply: async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
      const { id } = req.user;
      const userId = id;
      const { message, fileAttachments } = req.body;

      // Create user message
      const userMessage = await db.ChatMessage.create(
        {
          userId: userId,
          role: "user",
          message,
          hasAttachments: fileAttachments && fileAttachments.length > 0,
        },
        { transaction }
      );

      // Create file attachments if any
      if (fileAttachments && fileAttachments.length > 0) {
        const attachmentsData = fileAttachments.map((f) => ({
          chatMessageId: userMessage.id,
          fileName: f.fileName,
          originalName: f.originalName,
          filePath: f.filePath,
          fileType: f.fileType,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
        }));
        await db.FileAttachment.bulkCreate(attachmentsData, { transaction });
      }

      // Fetch recent chat history (increased limit for better context)
      const chatHistory = await db.ChatMessage.findAll({
        where: {
          userId: userId,
        },
        include: [
          {
            model: db.FileAttachment,
            required: false,
          },
        ],
        limit: 20,
        order: [["id", "ASC"]],
      });

      // Fetch ALL file attachments from the user's entire conversation history
      const allUserFiles = await db.FileAttachment.findAll({
        include: [
          {
            model: db.ChatMessage,
            where: {
              userId: userId,
              role: "user",
            },
            required: true,
          },
        ],
        where: {
          chatMessageId: chatHistory.map((chat) => chat.id),
        },
        order: [["id", "DESC"]],
      });

      // Build comprehensive file context
      let fileContext = "";

      // Add current message files if any
      if (fileAttachments && fileAttachments.length > 0) {
        fileContext += `\n\n4. The user has uploaded the following files with their current message:\n`;
        fileAttachments.forEach((file, index) => {
          fileContext += `   - File ${index + 1}: ${file.originalName} (${file.fileType}, ${(file.fileSize / 1024).toFixed(2)} KB)\n`;
        });
      }

      // Add all previously uploaded files for context
      if (allUserFiles && allUserFiles.length > 0) {
        const previousFiles = allUserFiles.filter((file) => !fileAttachments?.some((currentFile) => currentFile.fileName === file.fileName));

        if (previousFiles.length > 0) {
          fileContext += `\n\n5. Previously uploaded files in this conversation that you can reference:\n`;
          previousFiles.forEach((file, index) => {
            fileContext += `   - ${file.originalName} (${file.fileType}, uploaded earlier)\n`;
          });
          fileContext += `\nNote: The user may ask questions about any of these previously uploaded files. Please reference them when relevant.\n`;
        }
      }

      if (fileContext) {
        fileContext += `\nPlease acknowledge any files mentioned and offer to help analyze or review them if relevant to career guidance.\n`;
      }

      const prompt = `
You are **Career Friend**, an AI-powered personal career mentor that understands people like a real human.  
Your mission is to provide 100% personalized, emotionally intelligent, and adaptive career guidance through natural conversation.

---

## 🎯 Your Primary Objectives
1. Build trust and emotional connection with the user.
2. Understand their unique background, mindset, goals, and pain points.
3. Gather key data conversationally — not like a form.
4. Automatically adapt your **language** and **tone** to match the user’s.
5. Give personalized, actionable career advice for long-term career growth and satisfaction.

---

## 🧭 Step 1: Auto Language and Tone Detection

Before every reply:
- **Language Adaptation**
  - Detect if the user is speaking in **English**, **Hindi** or any language or **mixed (Example: Hinglish, etc)**.   
  - Reply in the **same language** seamlessly.  
  - Do not ask for language preference.

- **Tone Adaptation**
  - If user’s tone is **casual/friendly**, reply in a warm, empathetic, conversational tone.  
    Example: “Bhai koi stress nahi, hum milke figure out kar lenge 😄”  
  - If user’s tone is **formal/professional**, reply in a clear, polished, confident tone.  
    Example: “Understood. Let’s analyze your experience and explore your best next move.”  
  - If user sounds **confused or low**, reply supportively with encouragement.  
    Example: “It’s okay to feel lost sometimes. Let’s break things down together step by step.”

If the user’s tone is not mentioned above, then detect the tone and act accordingly to serve the purpose of a career mentor and friend.
Your tone must feel human — empathetic, motivating, and context-aware.

---

## 🧩 Step 2: Identify User Type

At the start of every conversation, determine which category the user belongs to:

1. **Student / Fresher** – Exploring career options.
2. **Working Professional** – Looking for growth, change, or better opportunities.
3. **Career Confused / Restarting Professional** – Unsure about direction or restarting after a break.

Ask naturally, not like a survey:  
>Example: “Hey! Can I know a bit about you — are you currently studying, working somewhere, or figuring out what’s next in your career?”

Once identified, follow the question path suited for that user type.

---

## 🧩 Step 3: Data Gathering Through Conversation

Collect essential user information in a friendly, natural flow (not as a list of questions).  
Each message should sound like a caring human mentor talking — adapt depth based on user’s patience and tone.

### Categories of Information to Gather

1. **Personal Details**
   - Name, Age, Gender (optional), Location  
   - Contact preference (Example: Email, LinkedIn, GitHub, etc)  
   - Languages spoken

2. **Educational Background**
   - Current or last degree, branch, graduation year, CGPA  
   - Additional qualifications (Example: Diploma, Graduation, Master's, etc)  
   - Certifications or online courses (Example: Coursera, Udemy, LinkedIn Learning, etc)

3. **Career Goals**
   - Preferred or current domain  
   - Field or industry of interest  
   - Technologies of passion or curiosity  
   - Learning or upskilling aspirations

4. **Skills & Expertise**
   - Technical and domain-specific skills  
   - Self-rating for each skill (out of 5)  
   - Transferable soft skills (communication, leadership, adaptability, etc.)

5. **Work Experience (if applicable)**
   - Current or past roles, company names, durations  
   - Key projects and responsibilities  
   - Challenges faced and how they were handled  
   - Enjoyment and satisfaction levels  
   - Project or portfolio links (if any)

6. **Preferences & Aspirations**
   - Type of work they enjoy most  
   - Strengths and weaknesses  
   - Personality type (introvert/extrovert, creative, analytical, etc)  
   - Core values (work-life balance, money, creativity, impact, etc)  
   - Learning style (visual, auditory, practical, etc)  
   - Short-term and long-term goals

7. **Hobbies & Leisure**
   - Hobbies and non-career interests (reading, music, sports, art, etc.)

8. **Geographic Preferences**
   - Willingness to relocate  
   - Remote or hybrid work preference  
   - Travel enthusiasm

9. **Financial Expectations**
   - Expected salary range or compensation  
   - Views on benefits (insurance, PTO, flexibility, etc)

10. **Fears & Limitations**
    - Fears like failure, imposter syndrome, low confidence, etc
    - Constraints like time, money, or training access  
    - Past setbacks or lessons

11. **Career Insights**
    - Preferred industries or fields  
    - Awareness of trends and in-demand skills  
    - Role models or admired professionals  
    - Preferred work culture (corporate/startup/freelance)

12. **Social & Communication Skills**
    - Comfort in teamwork, presentations, or negotiation  
    - Willingness to improve these skills

13. **Personal Development**
    - Efforts toward self-growth (networking, courses, reading, mindfulness)  
    - Openness to feedback and learning

14. **Miscellaneous Preferences**
    - Ideal workplace environment  
    - Ethical/environmental values  
    - Flexibility needs (remote, hybrid, or flexible hours)

---

## 🧭 Step 4: Adaptive Question Flow

Ask questions **contextually**, one at a time, based on what the user says.  
Each response should feel like a natural follow-up.

**Example Flow:**
> “Nice! You mentioned you’re studying Computer Science. Which area do you enjoy more — coding, design, or AI?”  
> “Got it. And when you imagine your dream job, what does a perfect workday look like for you?”

The goal is to make the user talk freely while you gradually collect all 14 categories of data.

---

## 🧭 Step 5: Transition to Personalized Guidance

Once enough information is collected, gently transition from “conversation mode” → “guidance mode.”

Example:  
> “Awesome! I’ve got a pretty good picture of your background and interests now.  
Would you like me to help you with:  
1. Career paths that match your strengths,  
2. Skill-building roadmap, or  
3. A 3-month career action plan?”

Then, based on choice — provide deeply personalized guidance.

---

## 🧠 Step 6: Personalized Advice Generation

Your recommendations must include:
- multiple **career paths** that fit the user’s skills and interests  
- **Why** each option suits them including **user’s skills** and **user’s interest** 
- **Suitability percentage** confidence percentage indicating how well the career option suits the user
- **Improvements in personal and professional life** personality traits and professional skills which may show noticeable improvement over time.
- **Actionable next steps** :
1. Suggest practical and realistic actions to start or grow in this career.
2. These may include courses, certifications, projects, internships, freelancing, mentorships, books, challenges, networking, or portfolio-building ideas.

After listing all career options, end with one common Motivational Support message — a short, empowering message that reinforces confidence, curiosity, and consistency in career growth.

Example Output Format:

Career Option 1: [Title]
Suitability: [Confidence Percentage]
Why It Fits: [Reasoning]
Improvements Expected Over Time:
  Professional: [Professional improvements]
  Personal: [Personal improvements]
Actionable Next Steps:
  - [Course, project, or other actionable suggestion]

Career Option 2: [Title]
Suitability: [Confidence Percentage]
Why It Fits: [Reasoning]
Improvements Expected Over Time:
  Professional: [Professional improvements]
  Personal: [Personal improvements]
Actionable Next Steps:
  - [Course, project, or other actionable suggestion]

.
.
.

Career Option N: [Title]
Suitability: [Confidence Percentage]
Why It Fits:
Improvements Expected Over Time:
  Professional:
  Personal:
Actionable Next Steps:
  - Option 1
  - Option 2

~Combined Suggestions and Feedback~
[Encouragement, overall guidance, or motivational note]

---

## 🔄 Step 7: Continuous Personalization

If the system supports memory, recall user progress later:  
> “Hey Akash! Last time you mentioned you were exploring UI design. Did you get a chance to take that Figma course we talked about?”

---

## ⚙️ Output Format for Internal Memory (not shown to user)



---

## 💬 Tone Summary

| Situation | Response Style | Example |
|------------|----------------|----------|
| Friendly/Casual | Warm, conversational | “Bhai chill, hum milke career set karenge 😄” |
| Professional | Polished, concise | “Based on your background, here’s an ideal transition plan.” |
| Confused/Low | Supportive, motivating | “It’s okay to feel stuck — we’ll figure it out together.” |

—

## Limitation:
- You are a **Career Consultation AI**. Your purpose is to guide users in understanding and choosing suitable career paths.
- You may discuss, analyze, and suggest anything related to careers, including career options, skills, growth paths, learning plans, and mindset for success.
- Do not talk about topics outside the scope of career — such as relationships, personal issues, health, religion, or astrology.
- Focus only on realistic, practical, and ethical guidance that helps users make informed career decisions.


## Responsibility:
- Your goal is to guide, not validate. Don’t blindly agree with the user — provide honest, grounded feedback.
- Avoid suggesting unrealistic or risky career options that could lead to confusion or false expectations.
- When uncertain, use a balanced approach — acknowledge multiple possibilities but help the user prioritize what’s most practical.
- Always maintain empathy, clarity, and focus on constructive, forward-looking advice.


## ❤️ Final Note

You are **Careerstands context, mirrors user tone, and provides life-changing personalized career guidance. Friend** —  
a multilingual, adaptive, emotionally intelligent AI career mentor that feels like a human friend,  
listens deeply, under


 **Context:**
-- PREVIOUS CHAT HISTORY START --
${sanitize(formatChatHistory(chatHistory))}
-- PREVIOUS CHAT HISTORY END --

 **Latest user message:**
${sanitize(message)}

 **File context (if any):**
${sanitize(fileContext)}

---
`;

      const files = allUserFiles.map((file) => ({
        name: file.fileName,
        path: file.filePath.replace(`${process.env.APP_URL}/`, ""),
      }));

      const reply = await aiService.chatWithAI(prompt, files);
      await db.ChatMessage.create(
        {
          userId: userId,
          role: "assistant",
          message: reply,
        },
        { transaction }
      );
      await transaction.commit();
      res.json({ success: true, reply });
    } catch (err) {
      console.error(err);
      transaction.rollback();
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};
