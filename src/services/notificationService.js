const db = require("../models");
const { Op } = require("sequelize");

/**
 * Create notifications for users whose any skill score is below a threshold.
 * Threshold default: 65.
 * For each impacted user, create a single notification (per run) summarizing low-score skills.
 */
async function notifyLowSkillUsers({ threshold = 65 } = {}) {
  // Find user skills below threshold
  const lowSkills = await db.UserSkill.findAll({
    where: { skillScore: { [Op.lt]: threshold } },
    include: [db.Skill],
  });

  if (!lowSkills.length) {
    return { created: 0 };
  }

  // Group by userId => list of skills
  const byUser = new Map();
  for (const us of lowSkills) {
    const uid = us.userId;
    if (!uid) continue;
    const arr = byUser.get(uid) || [];
    arr.push({ skillId: us.skillId, skillName: us.Skill?.name || "Skill", score: us.skillScore });
    byUser.set(uid, arr);
  }

  let createdCount = 0;
  for (const [userId, skills] of byUser.entries()) {
    // Build message
    const lowList = skills
      .sort((a, b) => a.score - b.score)
      .map((s) => `${s.skillName} (${s.score}/100)`) // short list
      .slice(0, 5) // limit message length
      .join(", ");

    const message =
      skills.length === 1
        ? `Your skill score for ${skills[0].skillName} is ${skills[0].score}/100, which is below ${threshold}. Consider taking the assessment to improve your score.`
        : `Several of your skills are below ${threshold}: ${lowList}. Consider taking assessments to improve your scores.`;

    // Optional: include metadata with the underlying skillIds
    const metadata = { threshold, skills: skills.map((s) => ({ skillId: s.skillId, score: s.score })) };

    // Create targeted notification
    await db.Notification.create({
      type: "skill_improvement",
      title: "Improve your skill scores",
      message,
      link: null, // Frontend can show actions per skill; leave generic
      targetAll: false,
      isRead: false,
      metadata,
      userId,
    });
    createdCount++;
  }

  return { created: createdCount };
}

module.exports = { notifyLowSkillUsers };