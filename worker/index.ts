import { randomUUID } from "node:crypto";
import { createProposal } from "../src/server/ai";
import { claimJob, completeAiJob, failJob, renewJob } from "../src/server/jobs";
import { processPendingCommandIntents } from "../src/server/command-intents";
import { HttpError } from "../src/server/errors";

const workerId = randomUUID();
const pollMs = 2_000;
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

function log(event: string, fields: Record<string, string | number> = {}) {
  console.info(JSON.stringify({ at: new Date().toISOString(), service: "lifelevel-worker", event, ...fields }));
}

async function run() {
  log("started", { workerId });
  while (!stopping) {
    const processedCommand = await processPendingCommandIntents(workerId);
    if (processedCommand) log("command_intent_processed");
    const job = await claimJob(workerId);
    if (!job) {
      if (!processedCommand) await new Promise(resolve => setTimeout(resolve, pollMs));
      continue;
    }
    log("claimed", { jobId: job.id, type: job.type, attempt: job.attempts });
    const heartbeat = setInterval(() => {
      void renewJob(job.id, workerId).catch(() => log("heartbeat_failed", { jobId: job.id }));
    }, 20_000);
    try {
      if (job.type !== "ai.propose") throw new Error("Unsupported job type");
      const proposal = await createProposal(job.payload.prompt);
      const committed = await completeAiJob(job.id, workerId, proposal);
      log(committed ? "succeeded" : "lease_lost", { jobId: job.id });
    } catch (error) {
      const safeMessage = error instanceof HttpError ? error.message : "Tác vụ chưa thể hoàn thành.";
      await failJob(job.id, workerId, safeMessage);
      log("retry_or_failed", { jobId: job.id, attempt: job.attempts });
    } finally {
      clearInterval(heartbeat);
    }
  }
  log("stopped", { workerId });
}

run().catch(() => {
  log("fatal");
  process.exitCode = 1;
});
