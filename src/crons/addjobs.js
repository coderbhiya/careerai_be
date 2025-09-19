const cron = require("node-cron");

// This will run every 6 hours at minute 0
cron.schedule("0 */6 * * *", () => {
// cron.schedule("* * * * *", () => {
  console.log("Running cron job at", new Date().toLocaleString());

  // Your job logic here
    addJobsInDB();
});

// Your job logic
async function addJobsInDB() {
  console.log("Doing scheduled work...");
  // Add your file upload or processing logic here
  const db = require("../models");
  const JobM = db.Job;

  const randomKeyword = jobKeywords[Math.floor(Math.random() * jobKeywords.length)];

  const jobData = await require("../services/jobSearch").jobSearch(randomKeyword);

  jobData.data.map(async (data) => {
    // JOB exist
    const jobExist = await JobM.findOne({
      where: {
        jobId: data.job_id,
      },
    });

    if (jobExist) {
      return;
    }

    JobM.create({
      jobId: data.job_id,
      title: data.job_title,
      company: data.employer_name,
      companyLogo: data.employer_logo,
      companyWebsite: data.employer_website,
      location: data.job_location,
      city: data.job_city,
      state: data.job_state,
      jobCountry: data.job_country,
      jobSalary: data.job_salary,
      jobMinSalary: data.job_min_salary,
      jobMaxSalary: data.job_max_salary,
      employmentType: data.job_employment_type,
      description: data.job_description,
      link: data.job_apply_link,
    });
  });
}

const jobKeywords = [
  // 🔧 Technical Roles
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Web Developer",
  "Mobile App Developer",
  "Data Scientist",
  "Data Analyst",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Cloud Engineer",
  "AI Engineer",
  "Product Manager",
  "Project Manager",
  "UI/UX Designer",
  "Graphic Designer",
  "QA Engineer",
  "Test Engineer",
  "Security Engineer",
  "Cybersecurity Analyst",
  "IT Support",
  "System Administrator",
  "Database Administrator",
  "Business Analyst",
  "Technical Writer",
  "Solutions Architect",
  "Network Engineer",
  "Software Architect",
  "Engineering Manager",
  "Scrum Master",
  "Game Developer",
  "Blockchain Developer",
  "Site Reliability Engineer (SRE)",
  "Embedded Software Engineer",
  "Technical Product Manager",
  "Data Engineer",
  "Research Scientist",
  "Intern Software Developer",
  "Junior Developer",
  "Senior Developer",
  "Tech Lead",
  "CTO",
  "Freelance Developer",

  // 🧑‍💼 Non-Technical Roles
  "Human Resources Manager",
  "Recruiter",
  "Marketing Manager",
  "Digital Marketing Specialist",
  "Content Writer",
  "Copywriter",
  "SEO Specialist",
  "Social Media Manager",
  "Sales Executive",
  "Account Manager",
  "Customer Support Representative",
  "Customer Success Manager",
  "Operations Manager",
  "Administrative Assistant",
  "Office Manager",
  "Executive Assistant",
  "Finance Analyst",
  "Accountant",
  "Auditor",
  "Legal Advisor",
  "Compliance Officer",
  "Procurement Specialist",
  "Supply Chain Manager",
  "Logistics Coordinator",
  "Event Planner",
  "Public Relations Manager",
  "Community Manager",
  "Training and Development Specialist",
  "HR Generalist",
  "Payroll Specialist",
  "Business Development Manager",
  "Strategic Planner",
  "Quality Assurance Analyst",
  "Retail Store Manager",
  "Real Estate Agent",
  "Insurance Agent",
  "Loan Officer",
  "Teacher",
  "Tutor",
  "Instructional Designer",
  "Translator",
  "Interpreter",
];
