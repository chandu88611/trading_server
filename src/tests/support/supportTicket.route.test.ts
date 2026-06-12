import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "support-route-test-secret";
process.env.TRADING_INTEGRATION_SECRET =
  process.env.TRADING_INTEGRATION_SECRET || "support-integration-secret";

const AppDataSource = require("../../db/data-source").default;
const { SupportTicketService } = require("../../app/support/services/supportTicket.service");
const { signAccessToken, Roles } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startSupportApp() {
  const express = require("express");
  const { SupportTicketRouter } = require("../../app/support/routes/supportTicket.route");
  const app = express();

  app.use(express.json());

  const supportRouter = new SupportTicketRouter();
  app.use("/support", supportRouter.getUserRouter());
  app.use("/integrations/crm/support", supportRouter.getIntegrationRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind support test server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error | null) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

function createUserToken(userId = 42) {
  return signAccessToken({
    userId: String(userId),
    roles: [Roles.USER],
  });
}

test("SupportTicketRouter: POST /support/tickets requires auth", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));

  let app: Awaited<ReturnType<typeof startSupportApp>> | null = null;

  try {
    app = await startSupportApp();
    const result = await requestJson(`${app.baseUrl}/support/tickets`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        subject: "Need help",
        body: "My webhook did not fire",
      }),
    });

    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { message: "Unauthorized" });
  } finally {
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("SupportTicketRouter: POST /support/tickets uses auth user and returns controller payload", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedUserId: number | null = null;
  let capturedPayload: any = null;

  const restoreCreateMyTicket = patch(
    SupportTicketService.prototype,
    "createMyTicket",
    async (userId: number, payload: any) => {
      capturedUserId = userId;
      capturedPayload = payload;
      return {
        ticket: { id: 11, subject: payload.subject },
        messages: [{ id: 22, body: payload.body }],
      };
    }
  );

  let app: Awaited<ReturnType<typeof startSupportApp>> | null = null;

  try {
    app = await startSupportApp();
    const result = await requestJson(`${app.baseUrl}/support/tickets`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${createUserToken(77)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        subject: "Need help",
        body: "My webhook did not fire",
      }),
    });

    assert.equal(result.status, 201);
    assert.deepEqual(result.body, {
      ticket: { id: 11, subject: "Need help" },
      messages: [{ id: 22, body: "My webhook did not fire" }],
    });
    assert.equal(capturedUserId, 77);
    assert.deepEqual(capturedPayload, {
      subject: "Need help",
      body: "My webhook did not fire",
    });
  } finally {
    restoreCreateMyTicket();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("SupportTicketRouter: GET /support/tickets/:id rejects invalid ticket ids before service calls", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let called = false;

  const restoreGetMyTicketById = patch(
    SupportTicketService.prototype,
    "getMyTicketById",
    async () => {
      called = true;
      return {};
    }
  );

  let app: Awaited<ReturnType<typeof startSupportApp>> | null = null;

  try {
    app = await startSupportApp();
    const result = await requestJson(`${app.baseUrl}/support/tickets/not-a-number`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${createUserToken(77)}`,
      },
    });

    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { message: "invalid_ticket_id" });
    assert.equal(called, false);
  } finally {
    restoreGetMyTicketById();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("SupportTicketRouter: POST /integrations/crm/support/tickets/upsert enforces x-api-secret", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let called = false;

  const restoreUpsertFromCrm = patch(
    SupportTicketService.prototype,
    "upsertFromCrm",
    async () => {
      called = true;
      return { id: 991 };
    }
  );

  let app: Awaited<ReturnType<typeof startSupportApp>> | null = null;

  try {
    app = await startSupportApp();
    const result = await requestJson(
      `${app.baseUrl}/integrations/crm/support/tickets/upsert`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          crmTicketId: "crm-1",
        }),
      }
    );

    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "invalid_integration_secret" });
    assert.equal(called, false);
  } finally {
    restoreUpsertFromCrm();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("SupportTicketRouter: POST /integrations/crm/support/tickets/upsert accepts valid x-api-secret", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedPayload: any = null;

  const restoreUpsertFromCrm = patch(
    SupportTicketService.prototype,
    "upsertFromCrm",
    async (payload: any) => {
      capturedPayload = payload;
      return { id: 123, crmTicketId: payload.crmTicketId };
    }
  );

  let app: Awaited<ReturnType<typeof startSupportApp>> | null = null;

  try {
    app = await startSupportApp();
    const result = await requestJson(
      `${app.baseUrl}/integrations/crm/support/tickets/upsert`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-secret": process.env.TRADING_INTEGRATION_SECRET!,
        },
        body: JSON.stringify({
          crmTicketId: "crm-2",
          externalTradingTicketId: "ext-2",
        }),
      }
    );

    assert.equal(result.status, 201);
    assert.deepEqual(result.body, {
      ticket: { id: 123, crmTicketId: "crm-2" },
    });
    assert.deepEqual(capturedPayload, {
      crmTicketId: "crm-2",
      externalTradingTicketId: "ext-2",
    });
  } finally {
    restoreUpsertFromCrm();
    restoreGetRepository();
    if (app) await app.close();
  }
});
