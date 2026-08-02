import "server-only";

import { randomUUID } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import type { StaffActor } from "./admin-auth";
import { writeAdminAudit } from "./admin-audit";

export type AppHostingBuild = {
  name: string;
  displayName?: string;
  state: string;
  createTime?: string;
  updateTime?: string;
  source?: { codebase?: { commit?: string; branch?: string }; [key: string]: unknown };
};
export type AppHostingRollout = { name: string; build: string; state: string; createTime?: string; updateTime?: string; error?: { message?: string } };
export type DeploymentRollbackJob = {
  id: string;
  build: string;
  rollout?: string;
  operation?: string;
  status: "running" | "ready" | "failed";
  reason: string;
  createdAt: string;
  createdBy: string;
  error?: string;
};

const debugJobs = new Map<string, DeploymentRollbackJob>();

export function appHostingConfiguration() {
  const project = process.env.FIREBASE_APP_HOSTING_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const location = process.env.FIREBASE_APP_HOSTING_LOCATION;
  const backend = process.env.FIREBASE_APP_HOSTING_BACKEND_ID;
  return project && location && backend
    ? { configured: true as const, project, location, backend, parent: `projects/${project}/locations/${location}/backends/${backend}` }
    : { configured: false as const, missing: ["FIREBASE_APP_HOSTING_PROJECT_ID/FIREBASE_PROJECT_ID", "FIREBASE_APP_HOSTING_LOCATION", "FIREBASE_APP_HOSTING_BACKEND_ID"].filter((key) => key.includes("/") ? !project : key.endsWith("LOCATION") ? !location : !backend) };
}

async function api<T>(path: string, init?: { method?: string; body?: unknown }) {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const response = await client.request<T>({
    url: `https://firebaseapphosting.googleapis.com/v1/${path}`,
    method: init?.method ?? "GET",
    data: init?.body,
  });
  return response.data;
}

export async function listAppHostingDeployments() {
  const configuration = appHostingConfiguration();
  if (!configuration.configured) return { configured: false as const, missing: configuration.missing, builds: [], rollouts: [] };
  const [buildResponse, rolloutResponse] = await Promise.all([
    api<{ builds?: AppHostingBuild[] }>(`${configuration.parent}/builds?pageSize=50&orderBy=createTime%20desc`),
    api<{ rollouts?: AppHostingRollout[] }>(`${configuration.parent}/rollouts?pageSize=50&orderBy=createTime%20desc`),
  ]);
  const rollouts = rolloutResponse.rollouts ?? [];
  const successfulBuildNames = new Set(rollouts.filter((rollout) => rollout.state === "SUCCEEDED").map((rollout) => rollout.build));
  return {
    configured: true as const,
    builds: (buildResponse.builds ?? []).map((build) => ({
      ...build,
      id: build.name.split("/").pop()!,
      instantRollbackAvailable: build.state === "READY" && successfulBuildNames.has(build.name),
      latestSuccessfulRollout: rollouts.find((rollout) => rollout.build === build.name && rollout.state === "SUCCEEDED") ?? null,
    })),
    rollouts,
  };
}

async function saveJob(actor: StaffActor, job: DeploymentRollbackJob) {
  if (actor.debug || !isFirebaseAdminConfigured()) debugJobs.set(job.id, job);
  else await getAdminDb().collection("deploymentRollbackJobs").doc(job.id).set(job);
}

export async function getDeploymentRollbackJob(actor: StaffActor, id: string) {
  if (actor.debug || !isFirebaseAdminConfigured()) return debugJobs.get(id) ?? null;
  const snapshot = await getAdminDb().collection("deploymentRollbackJobs").doc(id).get();
  return snapshot.exists ? snapshot.data() as DeploymentRollbackJob : null;
}

export async function rollbackAppHostingDeployment(actor: StaffActor, request: Request, buildId: string, reason: string) {
  const configuration = appHostingConfiguration();
  if (!configuration.configured) return { ok: false as const, status: 503, error: `App Hosting is not configured: ${configuration.missing.join(", ")}` };
  const buildName = buildId.startsWith("projects/") ? buildId : `${configuration.parent}/builds/${buildId}`;
  const deployments = await listAppHostingDeployments();
  const build = deployments.builds.find((item) => item.name === buildName);
  if (!build) return { ok: false as const, status: 404, error: "Build not found" };
  if (!build.instantRollbackAvailable) return { ok: false as const, status: 422, error: "This build is expired or was never successfully deployed, so instant rollback is unavailable" };
  const id = randomUUID();
  let job: DeploymentRollbackJob = { id, build: buildName, status: "running", reason, createdAt: new Date().toISOString(), createdBy: actor.uid };
  await saveJob(actor, job);
  try {
    const operation = await api<{ name?: string; metadata?: { target?: string } }>(`${configuration.parent}/rollouts?rolloutId=time-machine-${id}&requestId=${id}`, {
      method: "POST",
      body: { build: buildName, displayName: `Time Machine ${new Date().toISOString()}`, labels: { source: "admin-time-machine" }, annotations: { reason } },
    });
    job = { ...job, rollout: operation.metadata?.target, operation: operation.name, status: "running" };
    await saveJob(actor, job);
    await writeAdminAudit(actor, { action: "deployment.time_machine.rollback", targetType: "appHostingBuild", targetId: buildName, request, reason, after: { jobId: id, operation: operation.name } });
    return { ok: true as const, job };
  } catch (error) {
    job = { ...job, status: "failed", error: error instanceof Error ? error.message : "Rollback request failed" };
    await saveJob(actor, job);
    return { ok: false as const, status: 502, error: job.error, job };
  }
}

export async function refreshDeploymentRollbackJob(actor: StaffActor, id: string) {
  const job = await getDeploymentRollbackJob(actor, id);
  if (!job || job.status !== "running") return job;
  try {
    const configuration = appHostingConfiguration();
    if (!configuration.configured) return job;
    let rolloutName = job.rollout;
    if (!rolloutName && job.operation) {
      const operation = await api<{ done?: boolean; error?: { message?: string }; response?: AppHostingRollout; metadata?: { target?: string } }>(job.operation);
      if (operation.error) {
        const failed = { ...job, status: "failed" as const, error: operation.error.message ?? "Rollback operation failed" };
        await saveJob(actor, failed);
        return failed;
      }
      rolloutName = operation.response?.name ?? operation.metadata?.target;
      if (!rolloutName || !operation.done) return job;
    }
    if (!rolloutName) return job;
    const rolloutPath = rolloutName.startsWith("projects/") ? rolloutName : `${configuration.parent}/rollouts/${rolloutName.split("/").pop()}`;
    const rollout = await api<AppHostingRollout>(rolloutPath);
    const status = rollout.state === "SUCCEEDED" ? "ready" : ["FAILED", "CANCELLED"].includes(rollout.state) ? "failed" : "running";
    const next: DeploymentRollbackJob = { ...job, status, rollout: rollout.name, error: rollout.error?.message };
    await saveJob(actor, next);
    return next;
  } catch {
    return job;
  }
}
