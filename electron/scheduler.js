const cron = require('node-cron');
const crypto = require('crypto');
const { getAllWorkflows, getWorkflow, createFeedItem } = require('./database');

const activeJobs = new Map();
let agent = null;

function setAgent(agentInstance) {
  agent = agentInstance;
}

function startScheduler(mainWindow) {
  console.log('[Scheduler] Starting scheduler...');
  loadAndScheduleAll(mainWindow);
}

function loadAndScheduleAll(mainWindow) {
  for (const [id, job] of activeJobs) {
    job.stop();
  }
  activeJobs.clear();

  const workflows = getAllWorkflows();
  for (const wf of workflows) {
    if (wf.active && wf.cron && cron.validate(wf.cron)) {
      scheduleWorkflow(wf, mainWindow);
    }
  }

  console.log(`[Scheduler] ${activeJobs.size} workflows scheduled`);
}

function scheduleWorkflow(workflow, mainWindow) {
  if (activeJobs.has(workflow.id)) {
    activeJobs.get(workflow.id).stop();
  }

  const job = cron.schedule(workflow.cron, async () => {
    console.log(`[Scheduler] Cron fired for: ${workflow.name}`);
    await executeWorkflow(workflow, mainWindow);
  });

  activeJobs.set(workflow.id, job);
  console.log(`[Scheduler] Scheduled "${workflow.name}" with cron: ${workflow.cron}`);
}

function unscheduleWorkflow(workflowId) {
  if (activeJobs.has(workflowId)) {
    activeJobs.get(workflowId).stop();
    activeJobs.delete(workflowId);
  }
}

async function executeWorkflow(workflow, mainWindow) {
  const id = crypto.randomUUID();

  // Notify UI that execution started
  if (mainWindow) {
    mainWindow.webContents.send('workflow-executing', {
      workflowId: workflow.id,
      workflowName: workflow.name,
    });
  }

  try {
    let feedResult;

    if (agent && agent.isReady()) {
      // Real execution via MCP + LLM
      console.log(`[Scheduler] Executing "${workflow.name}" with real agent...`);
      feedResult = await agent.executeWorkflow(workflow, (toolName) => {
        if (mainWindow) {
          mainWindow.webContents.send('tool-call', { workflowId: workflow.id, toolName });
        }
      });
    } else {
      // Fallback: simulated execution
      console.log(`[Scheduler] Agent not ready, using simulated execution for "${workflow.name}"`);
      feedResult = simulateExecution(workflow);
    }

    const feedItem = {
      id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      type: feedResult.type,
      data: feedResult.data,
    };

    createFeedItem(feedItem);

    if (mainWindow) {
      mainWindow.webContents.send('feed-item-added', feedItem);
    }

    return feedItem;
  } catch (err) {
    console.error(`[Scheduler] Error executing "${workflow.name}":`, err);

    // Create an error feed item
    const errorItem = {
      id,
      workflowId: workflow.id,
      workflowName: workflow.name,
      type: 'text',
      data: { content: `Workflow execution failed: ${err.message}` },
    };

    createFeedItem(errorItem);

    if (mainWindow) {
      mainWindow.webContents.send('feed-item-added', errorItem);
    }

    return errorItem;
  }
}

function simulateExecution(workflow) {
  const sourceBlocks = workflow.blocks.filter(b => b.type === 'source');
  const outputBlocks = workflow.blocks.filter(b => b.type === 'output');
  const hasSlack = sourceBlocks.some(b => b.source === 'slack');
  const hasNotion = sourceBlocks.some(b => b.source === 'notion');
  const hasMeetings = sourceBlocks.some(b => b.source === 'meetings');
  const hasTodoist = outputBlocks.some(b => b.destination === 'todoist');

  if (hasMeetings) {
    return {
      type: 'meetings',
      data: {
        meetings: [
          { title: '[Simulated] Agent not connected', account: 'N/A', date: 'Today', channel: 'N/A', participants: [], keyTakeaways: ['Set ANTHROPIC_API_KEY for real execution'], goingWell: [], notGoingWell: [], nextSteps: [], meetingUrl: null },
        ],
        query: 'simulated',
      },
    };
  }

  if (hasSlack && hasTodoist) {
    return {
      type: 'todoist',
      data: {
        tasks: [
          { title: '[Simulated] Agent not connected — set ANTHROPIC_API_KEY for real execution', dueDate: 'Today', priority: 'medium', done: false },
        ],
      },
    };
  }

  if (hasNotion) {
    return {
      type: 'text',
      data: { content: '[Simulated] Agent not connected. Set ANTHROPIC_API_KEY and ensure the MCP server is running for real Notion monitoring.' },
    };
  }

  return {
    type: 'text',
    data: { content: `[Simulated] Workflow "${workflow.name}" executed. Connect agent for real results.` },
  };
}

// Manual trigger
async function triggerWorkflow(workflowId, mainWindow) {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);
  return executeWorkflow(workflow, mainWindow);
}

module.exports = {
  startScheduler,
  loadAndScheduleAll,
  scheduleWorkflow,
  unscheduleWorkflow,
  triggerWorkflow,
  setAgent,
};
