const cron = require("node-cron");

// Runs daily at 09:00 server time
cron.schedule("0 9 * * *", async () => {
  try {
    const { notifyLowSkillUsers } = require("../services/notificationService");
    console.log("[Cron] notifyLowSkillUsers started", new Date().toLocaleString());
    const result = await notifyLowSkillUsers({ threshold: 65 });
    console.log(`[Cron] notifyLowSkillUsers completed. Created: ${result.created}`);
  } catch (err) {
    console.error("[Cron] notifyLowSkillUsers failed", err);
  }
});