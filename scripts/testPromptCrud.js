require('dotenv').config();

const db = require('../src/models');
const promptController = require('../src/controllers/promptController');

function makeRes(label) {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      console.log(`\n[${label}] Status:`, this.statusCode);
      console.log(`[${label}] Body:`, JSON.stringify(payload, null, 2));
    },
  };
}

async function run() {
  try {
    // Verify DB is reachable
    await db.sequelize.authenticate();
    console.log('DB authenticate: OK');

    // Ensure Prompt table exists for testing
    await db.Prompt.sync();
    console.log('Prompt table synced: OK');

    const adminMock = { id: 999 }; // mock admin id for audit fields

    // 1) Create a new active chat prompt
    const reqCreate = {
      admin: adminMock,
      body: {
        title: 'Career Friend v1',
        content: 'You are Career Friend, a helpful career mentor. Be concise and empathetic.',
        type: 'chat',
        isActive: true,
      },
    };
    await promptController.createPrompt(reqCreate, makeRes('CREATE_PROMPT'));

    // 2) List prompts
    const reqList = { query: { type: 'chat' } };
    await promptController.listPrompts(reqList, makeRes('LIST_PROMPTS'));

    // 3) Get active prompt
    const reqActive = { query: { type: 'chat' } };
    await promptController.getActivePrompt(reqActive, makeRes('GET_ACTIVE_PROMPT'));

    // 4) Update the first prompt's title
    const firstPrompt = await db.Prompt.findOne({ where: { type: 'chat' }, order: [['updatedAt', 'DESC']] });
    if (firstPrompt) {
      const reqUpdate = {
        admin: adminMock,
        params: { id: String(firstPrompt.id) },
        body: { title: firstPrompt.title + ' (updated)' },
      };
      await promptController.updatePrompt(reqUpdate, makeRes('UPDATE_PROMPT'));

      // 5) Deactivate and then reactivate the prompt
      const reqDeactivate = {
        admin: adminMock,
        params: { id: String(firstPrompt.id) },
        body: { isActive: false },
      };
      await promptController.updatePrompt(reqDeactivate, makeRes('DEACTIVATE_PROMPT'));

      const reqActivate = { admin: adminMock, params: { id: String(firstPrompt.id) } };
      await promptController.activatePrompt(reqActivate, makeRes('ACTIVATE_PROMPT'));

      // 6) Get active prompt again
      await promptController.getActivePrompt(reqActive, makeRes('GET_ACTIVE_PROMPT_AGAIN'));
    }

    // 7) Cleanup: delete all test prompts created by mock admin
    const createdByUs = await db.Prompt.findAll({ where: { createdBy: adminMock.id } });
    for (const p of createdByUs) {
      const reqDelete = { params: { id: String(p.id) } };
      await promptController.deletePrompt(reqDelete, makeRes(`DELETE_PROMPT_${p.id}`));
    }

    console.log('\nTest sequence complete.');
    process.exit(0);
  } catch (err) {
    console.error('Test sequence failed:', err);
    process.exit(1);
  }
}

run();