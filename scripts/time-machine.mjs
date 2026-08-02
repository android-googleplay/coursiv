#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { GoogleAuth } from "google-auth-library";

const [scope, action, target] = process.argv.slice(2);
const project = process.env.FIREBASE_APP_HOSTING_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
const location = process.env.FIREBASE_APP_HOSTING_LOCATION;
const backend = process.env.FIREBASE_APP_HOSTING_BACKEND_ID;
if (scope !== "deployment" || !["list", "rollback"].includes(action ?? "")) {
  console.error("Usage: npm run time-machine -- deployment list | deployment rollback <build-id>");
  process.exit(2);
}
if (!project || !location || !backend) {
  console.error("Set FIREBASE_APP_HOSTING_PROJECT_ID (or FIREBASE_PROJECT_ID), FIREBASE_APP_HOSTING_LOCATION and FIREBASE_APP_HOSTING_BACKEND_ID.");
  process.exit(2);
}
const parent = `projects/${project}/locations/${location}/backends/${backend}`;
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
const request = async(path,method="GET",data)=>client.request({url:`https://firebaseapphosting.googleapis.com/v1/${path}`,method,data});

if (action === "list") {
  const response = await request(`${parent}/builds?pageSize=50&orderBy=createTime%20desc`);
  const builds = response.data.builds ?? [];
  console.table(builds.map((build)=>({id:build.name.split("/").pop(),state:build.state,created:build.createTime,displayName:build.displayName??""})));
} else {
  if (!target || !/^[a-zA-Z0-9_-]+$/.test(target)) {
    console.error("A valid build ID is required.");
    process.exit(2);
  }
  if (process.env.TIME_MACHINE_CONFIRM !== "ROLLBACK DEPLOYMENT") {
    console.error('Safety check: run with TIME_MACHINE_CONFIRM="ROLLBACK DEPLOYMENT".');
    process.exit(2);
  }
  const id = randomUUID();
  const build = `${parent}/builds/${target}`;
  const buildResponse = await request(build);
  if (buildResponse.data.state !== "READY") {
    console.error(`Build ${target} is ${buildResponse.data.state}; instant rollback requires READY.`);
    process.exit(1);
  }
  const response = await request(`${parent}/rollouts?rolloutId=time-machine-${id}&requestId=${id}`,"POST",{
    build,
    displayName:`Emergency Time Machine ${new Date().toISOString()}`,
    labels:{source:"break-glass-cli"},
    annotations:{reason:process.env.TIME_MACHINE_REASON??"Emergency break-glass rollback"},
  });
  console.log(`Rollback accepted: ${response.data.name ?? response.data.metadata?.target ?? target}`);
}
