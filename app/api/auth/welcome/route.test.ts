import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type Stored = Record<string, unknown>;
  const store = new Map<string, Stored>();
  const afterCallbacks: Array<() => Promise<void> | void> = [];
  const authUser = {
    email:"new@example.com" as string | null,
    displayName:"New Learner" as string | null,
    metadata:{ creationTime:new Date().toISOString() as string | undefined },
  };
  const decoded = { uid:"user-new", email:"new@example.com" } as { uid:string; email?:string } | null;
  const snapshot = (id:string) => ({ id, exists:store.has(id), data:() => store.get(id) });
  const reference = (id:string) => ({
    id,
    get:async() => snapshot(id),
    set:async(data:Stored,options?:{merge?:boolean}) => {
      store.set(id, options?.merge ? { ...store.get(id), ...data } : data);
    },
  });
  const database = {
    collection:vi.fn(() => ({ doc:(id:string) => reference(id) })),
    runTransaction:vi.fn(async(callback:(transaction:{
      get:(ref:{id:string})=>Promise<ReturnType<typeof snapshot>>;
      set:(ref:{id:string},data:Stored,options?:{merge?:boolean})=>void;
      create:(ref:{id:string},data:Stored)=>void;
    })=>unknown) => callback({
      get:async(ref) => snapshot(ref.id),
      set:(ref,data,options) => { store.set(ref.id, options?.merge ? { ...store.get(ref.id), ...data } : data); },
      create:(ref,data) => { if (store.has(ref.id)) throw new Error("already exists"); store.set(ref.id,data); },
    })),
  };
  const sendWelcome = vi.fn(async (): Promise<
    | { status:"sent"; attempts:number; emailId:string }
    | { status:"failed"; attempts:number; errorCode:string }
  > => ({ status:"sent", attempts:1, emailId:"email-123" }));
  return {
    store,
    afterCallbacks,
    authUser,
    decoded,
    database,
    firebaseConfigured:vi.fn(() => true),
    verifyToken:vi.fn(async() => decoded),
    getUser:vi.fn(async() => authUser),
    sendWelcome,
  };
});

vi.mock("next/server", () => ({
  after:(callback:() => Promise<void> | void) => { mocks.afterCallbacks.push(callback); },
  NextResponse:{ json:(body:unknown,init?:ResponseInit) => Response.json(body,init) },
}));
vi.mock("@/lib/platform/firebase-admin", () => ({
  isFirebaseAdminConfigured:mocks.firebaseConfigured,
  verifyBearerToken:mocks.verifyToken,
  getAdminAuth:() => ({ getUser:mocks.getUser }),
  getAdminDb:() => mocks.database,
}));
vi.mock("@/lib/platform/welcome-email", () => ({
  WELCOME_EMAIL_TEMPLATE_VERSION:1,
  isWelcomeEmailConfigured:() => Boolean(process.env.RESEND_API_KEY && process.env.WELCOME_FROM_EMAIL && process.env.WELCOME_REPLY_TO_EMAIL),
  sendWelcomeEmail:mocks.sendWelcome,
}));

import { isRecentFirebaseAccount, POST } from "./route";

beforeEach(() => {
  mocks.store.clear();
  mocks.afterCallbacks.length = 0;
  mocks.firebaseConfigured.mockReturnValue(true);
  mocks.verifyToken.mockImplementation(async() => mocks.decoded);
  mocks.authUser.email = "new@example.com";
  mocks.authUser.displayName = "New Learner";
  mocks.authUser.metadata.creationTime = new Date().toISOString();
  mocks.sendWelcome.mockClear();
  mocks.sendWelcome.mockResolvedValue({ status:"sent", attempts:1, emailId:"email-123" });
  process.env.RESEND_API_KEY = "resend-key";
  process.env.WELCOME_FROM_EMAIL = "Coursiv <welcome@example.com>";
  process.env.WELCOME_REPLY_TO_EMAIL = "support@example.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://learn.example.com";
});

describe("POST /api/auth/welcome", () => {
  it("rejects missing authentication", async () => {
    mocks.verifyToken.mockResolvedValueOnce(null);
    const response = await POST(new Request("https://learn.example.com/api/auth/welcome", { method:"POST" }));
    expect(response.status).toBe(401);
  });

  it("rejects unconfigured delivery and accounts without email", async () => {
    delete process.env.WELCOME_FROM_EMAIL;
    const unconfigured = await POST(new Request("https://learn.example.com/api/auth/welcome", { method:"POST" }));
    expect(unconfigured.status).toBe(503);
    process.env.WELCOME_FROM_EMAIL = "Coursiv <welcome@example.com>";
    mocks.authUser.email = null;
    const missingEmail = await POST(new Request("https://learn.example.com/api/auth/welcome", { method:"POST" }));
    expect(missingEmail.status).toBe(422);
  });

  it("rejects an old account without an existing delivery", async () => {
    mocks.authUser.metadata.creationTime = new Date(Date.now()-60*60*1000).toISOString();
    const response = await POST(new Request("https://learn.example.com/api/auth/welcome", { method:"POST" }));
    expect(response.status).toBe(403);
    expect(isRecentFirebaseAccount(mocks.authUser.metadata.creationTime)).toBe(false);
  });

  it("queues, sends and persists one delivery for a new account", async () => {
    const request = new Request("https://learn.example.com/api/auth/welcome", { method:"POST" });
    const queued = await POST(request);
    expect(queued.status).toBe(202);
    expect(await queued.json()).toEqual({ status:"queued" });
    expect(mocks.afterCallbacks).toHaveLength(1);
    expect(mocks.store.get("welcome-v1:user-new")).toMatchObject({ status:"queued", attempts:0, recipientEmail:"new@example.com" });

    await mocks.afterCallbacks[0]?.();
    expect(mocks.sendWelcome).toHaveBeenCalledTimes(1);
    expect(mocks.sendWelcome).toHaveBeenCalledWith(expect.objectContaining({
      userId:"user-new",
      recipientEmail:"new@example.com",
      recipientName:"New Learner",
      appUrl:"https://learn.example.com",
    }), expect.objectContaining({ apiKey:"resend-key" }));
    expect(mocks.store.get("welcome-v1:user-new")).toMatchObject({ status:"sent", attempts:1, providerMessageId:"email-123" });

    const duplicate = await POST(new Request("https://learn.example.com/api/auth/welcome", { method:"POST" }));
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ status:"sent", duplicate:true });
    expect(mocks.afterCallbacks).toHaveLength(1);
    expect(mocks.sendWelcome).toHaveBeenCalledTimes(1);
  });

  it("persists a safe failure without throwing into the registration request", async () => {
    mocks.sendWelcome.mockResolvedValueOnce({ status:"failed", attempts:1, errorCode:"validation_error" });
    const response = await POST(new Request("https://learn.example.com/api/auth/welcome", { method:"POST" }));
    expect(response.status).toBe(202);
    await mocks.afterCallbacks[0]?.();
    expect(mocks.store.get("welcome-v1:user-new")).toMatchObject({ status:"failed", attempts:1, lastErrorCode:"validation_error", providerMessageId:null });
  });
});
