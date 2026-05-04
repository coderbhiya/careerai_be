const db = require("../../models");
const { Op } = require("sequelize");

// ─────────────────────────────────────────────────────────────────────────────
// TOOL DEFINITIONS  (sent to OpenAI so it knows which tools exist)
// ─────────────────────────────────────────────────────────────────────────────

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "save_user_profile",
      description:
        "Save or update the user's career profile information that was mentioned in the conversation. " +
        "Call this when the user mentions their current role, target role, target industry, experience years, location, or bio/headline.",
      parameters: {
        type: "object",
        properties: {
          headline: {
            type: "string",
            description: "A short professional headline, e.g. 'Frontend Developer at XYZ'",
          },
          bio: {
            type: "string",
            description: "A short bio or personal summary about the user",
          },
          currentRole: {
            type: "string",
            description: "The user's current job title / role",
          },
          targetRole: {
            type: "string",
            description: "The job title or role the user is aiming for",
          },
          targetIndustry: {
            type: "string",
            description: "The industry the user wants to work in",
          },
          experienceYears: {
            type: "number",
            description: "Total years of professional experience",
          },
          location: {
            type: "string",
            description: "City or country the user is based in or wants to work in",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_user_skills",
      description:
        "Save skills that the user mentioned in the conversation. " +
        "Call this when the user talks about technologies, tools, programming languages, soft skills, or any competency they possess.",
      parameters: {
        type: "object",
        properties: {
          skills: {
            type: "array",
            description: "List of skills the user mentioned",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Skill name e.g. 'JavaScript', 'React', 'Project Management'",
                },
                category: {
                  type: "string",
                  description:
                    "Category of the skill: 'technical', 'soft', 'language', 'tool', 'framework', 'other'",
                  enum: ["technical", "soft", "language", "tool", "framework", "other"],
                },
                proficiency: {
                  type: "string",
                  description: "User's proficiency level",
                  enum: ["beginner", "intermediate", "expert"],
                },
              },
              required: ["name"],
            },
          },
        },
        required: ["skills"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_jobs",
      description:
        "Search the job database and return relevant job recommendations for the user. " +
        "Call this when the user asks for job recommendations, job listings, or wants to know what jobs match their profile.",
      parameters: {
        type: "object",
        properties: {
          keywords: {
            type: "array",
            description:
              "Keywords to search for in job titles or descriptions. Derive from user's skills, interests, and target role.",
            items: { type: "string" },
          },
          location: {
            type: "string",
            description: "Preferred job location (city, state, or country). Leave empty for remote / any.",
          },
          employmentType: {
            type: "string",
            description: "Employment type filter",
            enum: ["FULLTIME", "PARTTIME", "INTERN", "CONTRACTOR", ""],
          },
          limit: {
            type: "number",
            description: "Maximum number of jobs to return (default 5, max 10)",
          },
        },
        required: ["keywords"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_user_interests",
      description:
        "Save the user's career interests and education background that were mentioned in the conversation. " +
        "Call this when the user mentions their interests, field of study, degree, or educational background.",
      parameters: {
        type: "object",
        properties: {
          interests: {
            type: "array",
            description: "List of career interests or fields the user is interested in",
            items: { type: "string" },
          },
          educationLevel: {
            type: "string",
            description: "Highest education level",
            enum: ["high_school", "associate", "bachelor", "master", "phd", "bootcamp", "self_taught", "other"],
          },
          fieldOfStudy: {
            type: "string",
            description: "Major / field of study e.g. 'Computer Science', 'Business Administration'",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TOOL EXECUTORS  (called when AI decides to invoke a tool)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save / update UserProfile fields
 */
async function executeSaveUserProfile(userId, args) {
  try {
    const allowedFields = [
      "headline", "bio", "currentRole", "targetRole",
      "targetIndustry", "experienceYears", "location",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (args[field] !== undefined && args[field] !== null && args[field] !== "") {
        updates[field] = args[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return { success: false, message: "No valid profile fields to update" };
    }

    const [profile, created] = await db.UserProfile.findOrCreate({
      where: { userId },
      defaults: { userId, ...updates },
    });

    if (!created) {
      await profile.update(updates);
    }

    const updatedFields = Object.keys(updates).join(", ");
    console.log(`[aiTools] save_user_profile: userId=${userId}, updated: ${updatedFields}`);

    return {
      success: true,
      message: `Profile updated: ${updatedFields}`,
      updatedFields: updates,
    };
  } catch (err) {
    console.error("[aiTools] save_user_profile error:", err?.message);
    return { success: false, message: "Failed to save profile: " + err?.message };
  }
}

/**
 * Save user skills (upsert — avoid duplicates)
 */
async function executeSaveUserSkills(userId, args) {
  try {
    const skills = args.skills || [];
    if (!skills.length) return { success: false, message: "No skills provided" };

    const savedSkills = [];

    for (const skillData of skills) {
      if (!skillData.name) continue;

      // Find or create the global Skill record
      const [skill] = await db.Skill.findOrCreate({
        where: { name: skillData.name },
        defaults: {
          name: skillData.name,
          category: skillData.category || "other",
        },
      });

      // Find or create the UserSkill (junction) record
      const [userSkill, created] = await db.UserSkill.findOrCreate({
        where: { userId, skillId: skill.id },
        defaults: {
          userId,
          skillId: skill.id,
          proficiency: skillData.proficiency || "beginner",
          skillScore: 0,
        },
      });

      // Update proficiency if skill already existed
      if (!created && skillData.proficiency) {
        await userSkill.update({ proficiency: skillData.proficiency });
      }

      savedSkills.push(skillData.name);
    }

    console.log(`[aiTools] save_user_skills: userId=${userId}, skills=${savedSkills.join(", ")}`);

    return {
      success: true,
      message: `Skills saved: ${savedSkills.join(", ")}`,
      savedSkills,
    };
  } catch (err) {
    console.error("[aiTools] save_user_skills error:", err?.message);
    return { success: false, message: "Failed to save skills: " + err?.message };
  }
}

/**
 * Recommend jobs from DB based on keywords, location, type
 */
async function executeRecommendJobs(userId, args) {
  try {
    const keywords = args.keywords || [];
    const location = args.location || "";
    const employmentType = args.employmentType || "";
    const limit = Math.min(Number(args.limit) || 5, 10);

    if (!keywords.length) {
      return { success: false, message: "No keywords provided for job search" };
    }

    // Build keyword conditions for title OR description
    const keywordConditions = keywords.map((kw) => ({
      [Op.or]: [
        { title: { [Op.like]: `%${kw}%` } },
        { description: { [Op.like]: `%${kw}%` } },
      ],
    }));

    const where = {
      [Op.and]: [
        { [Op.or]: keywordConditions },
      ],
    };

    if (location) {
      where[Op.and].push({
        [Op.or]: [
          { location: { [Op.like]: `%${location}%` } },
          { city: { [Op.like]: `%${location}%` } },
          { state: { [Op.like]: `%${location}%` } },
          { jobCountry: { [Op.like]: `%${location}%` } },
        ],
      });
    }

    if (employmentType) {
      where.employmentType = { [Op.like]: `%${employmentType}%` };
    }

    const jobs = await db.Job.findAll({
      where,
      limit,
      order: [["id", "DESC"]],
      attributes: [
        "id", "title", "company", "companyLogo", "location",
        "city", "state", "jobCountry", "employmentType",
        "jobMinSalary", "jobMaxSalary", "link",
      ],
    });

    if (!jobs.length) {
      return {
        success: true,
        message: "No matching jobs found in the database for these keywords",
        jobs: [],
      };
    }

    const jobList = jobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: [j.city, j.state, j.jobCountry].filter(Boolean).join(", ") || j.location,
      employmentType: j.employmentType,
      salaryRange:
        j.jobMinSalary && j.jobMaxSalary
          ? `${j.jobMinSalary} - ${j.jobMaxSalary}`
          : null,
      applyLink: j.link,
    }));

    console.log(`[aiTools] recommend_jobs: userId=${userId}, found ${jobList.length} jobs`);

    return {
      success: true,
      message: `Found ${jobList.length} relevant jobs`,
      jobs: jobList,
    };
  } catch (err) {
    console.error("[aiTools] recommend_jobs error:", err?.message);
    return { success: false, message: "Failed to fetch jobs: " + err?.message };
  }
}

/**
 * Save user interests & education (stored in UserProfile extra fields)
 * We piggyback on the existing UserProfile for now — interests stored as JSON in bio extension
 * or you can add a separate UserInterest model later.
 */
async function executeSaveUserInterests(userId, args) {
  try {
    const updates = {};

    // Store interests as a JSON string in targetIndustry for now,
    // or create a dedicated column. Using targetIndustry as placeholder.
    if (args.interests && args.interests.length > 0) {
      updates.targetIndustry = args.interests.join(", ");
    }

    // Store education info in headline if no better column exists
    // Ideally add educationLevel + fieldOfStudy columns to UserProfile
    if (args.fieldOfStudy) {
      updates.fieldOfStudy = args.fieldOfStudy;   // will be ignored by Sequelize if col doesn't exist
    }

    const [profile, created] = await db.UserProfile.findOrCreate({
      where: { userId },
      defaults: { userId, ...updates },
    });

    if (!created && Object.keys(updates).length > 0) {
      await profile.update(updates).catch(() => {}); // graceful — ignore unknown columns
    }

    const note = [
      args.interests?.length ? `interests: ${args.interests.join(", ")}` : null,
      args.educationLevel ? `educationLevel: ${args.educationLevel}` : null,
      args.fieldOfStudy ? `fieldOfStudy: ${args.fieldOfStudy}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    console.log(`[aiTools] save_user_interests: userId=${userId}, ${note}`);

    return { success: true, message: `Interests saved: ${note}` };
  } catch (err) {
    console.error("[aiTools] save_user_interests error:", err?.message);
    return { success: false, message: "Failed to save interests: " + err?.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCHER  — routes tool_name → executor
// ─────────────────────────────────────────────────────────────────────────────

async function executeTool(userId, toolName, args) {
  switch (toolName) {
    case "save_user_profile":
      return executeSaveUserProfile(userId, args);
    case "save_user_skills":
      return executeSaveUserSkills(userId, args);
    case "recommend_jobs":
      return executeRecommendJobs(userId, args);
    case "save_user_interests":
      return executeSaveUserInterests(userId, args);
    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}

module.exports = { toolDefinitions, executeTool };
