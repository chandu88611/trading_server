import test from "node:test";
import assert from "node:assert/strict";

process.env.SMTP_HOST = process.env.SMTP_HOST || "localhost";
process.env.SMTP_PORT = process.env.SMTP_PORT || "1025";
process.env.SMTP_USER = process.env.SMTP_USER || "tester";
process.env.SMTP_PASS = process.env.SMTP_PASS || "tester";
process.env.SMTP_FROM = process.env.SMTP_FROM || "support@tradebro.test";

const AppDataSource = require("../../db/data-source").default;
const { SupportTicketService } = require("../../app/support/services/supportTicket.service");
const { SupportTicket } = require("../../entity/SupportTicket");
const { SupportTicketMessage } = require("../../entity/SupportTicketMessage");
const { User } = require("../../entity/User");
const { mailTransporter } = require("../../types/mail");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("SupportTicketService: upsertFromCrm creates a new mirrored support ticket", async () => {
  const savedTickets: any[] = [];
  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity === SupportTicket) {
      return {
        async findOne() {
          return null;
        },
        create(payload: any) {
          return { ...payload };
        },
        async save(ticket: any) {
          if (!ticket.id) ticket.id = 101;
          savedTickets.push({ ...ticket });
          return ticket;
        },
      };
    }

    if (entity === SupportTicketMessage) {
      return {};
    }

    if (entity === User) {
      return {
        async findOne({ where }: any) {
          if (where.id === 7) {
            return { id: 7, email: "user@example.com", name: "Trade User" };
          }
          return null;
        },
      };
    }

    throw new Error(`Unexpected repository request: ${String(entity?.name || entity)}`);
  });

  try {
    const service = new SupportTicketService();
    const ticket = await service.upsertFromCrm({
      crmTicketId: "crm-ticket-1",
      externalTradingTicketId: "ext-ticket-1",
      platformUserId: "7",
      contactEmail: "user@example.com",
      contactName: "Trade User",
      subject: "Need help",
      status: "assigned",
      assignedExecutiveId: "exec-1",
      assignedExecutiveName: "Raj Kumar",
      lastCustomerMessageAt: "2026-03-20T12:00:00.000Z",
      updatedAt: "2026-03-20T12:05:00.000Z",
    });

    assert.equal(ticket.id, 101);
    assert.equal(ticket.crmTicketId, "crm-ticket-1");
    assert.equal(ticket.externalTicketId, "ext-ticket-1");
    assert.equal(ticket.status, "assigned");
    assert.equal(ticket.assignedExecutiveId, "exec-1");
    assert.equal(ticket.assignedExecutiveName, "Raj Kumar");
    assert.equal(ticket.syncStatus, "synced");
    assert.equal(ticket.contactEmail, "user@example.com");
    assert.equal(savedTickets.length, 1);
  } finally {
    restoreGetRepository();
  }
});

test("SupportTicketService: ingestPublicReplyFromCrm is idempotent for duplicate CRM messages", async () => {
  let ticketLookupCount = 0;
  let emailSendCount = 0;
  const existingMessage = { id: 55, crmMessageId: "crm-message-1" };

  const restoreSendMail = patch(mailTransporter, "sendMail", async () => {
    emailSendCount += 1;
  });

  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity === SupportTicket) {
      return {
        async findOne() {
          ticketLookupCount += 1;
          return null;
        },
      };
    }

    if (entity === SupportTicketMessage) {
      return {
        async findOne({ where }: any) {
          if (where.crmMessageId === "crm-message-1") {
            return existingMessage;
          }
          return null;
        },
      };
    }

    if (entity === User) {
      return {};
    }

    throw new Error(`Unexpected repository request: ${String(entity?.name || entity)}`);
  });

  try {
    const service = new SupportTicketService();
    const result = await service.ingestPublicReplyFromCrm("crm-ticket-1", {
      crmMessageId: "crm-message-1",
      body: "Already synced reply",
    });

    assert.equal(result, existingMessage);
    assert.equal(ticketLookupCount, 0);
    assert.equal(emailSendCount, 0);
  } finally {
    restoreGetRepository();
    restoreSendMail();
  }
});

test("SupportTicketService: ingestPublicReplyFromCrm stores new replies and sends email", async () => {
  let emailSendCount = 0;
  const savedMessages: any[] = [];
  const savedTickets: any[] = [];
  const ticket = {
    id: 88,
    crmTicketId: "crm-ticket-22",
    externalTicketId: "ext-ticket-22",
    contactEmail: "customer@example.com",
    subject: "Order issue",
    status: "assigned",
    lastAgentReplyAt: null,
    closedAt: null,
    syncStatus: "pending",
    lastSyncAt: null,
    lastSyncError: "previous failure",
  };

  const restoreSendMail = patch(mailTransporter, "sendMail", async () => {
    emailSendCount += 1;
  });

  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity === SupportTicket) {
      return {
        async findOne({ where }: any) {
          if (where.crmTicketId === "crm-ticket-22") {
            return ticket;
          }
          return null;
        },
        async save(nextTicket: any) {
          savedTickets.push({ ...nextTicket });
          return nextTicket;
        },
      };
    }

    if (entity === SupportTicketMessage) {
      return {
        async findOne() {
          return null;
        },
        create(payload: any) {
          return {
            id: 909,
            createdAt: new Date("2026-03-20T12:10:00.000Z"),
            emailedAt: null,
            ...payload,
          };
        },
        async save(message: any) {
          savedMessages.push({ ...message });
          return message;
        },
      };
    }

    if (entity === User) {
      return {};
    }

    throw new Error(`Unexpected repository request: ${String(entity?.name || entity)}`);
  });

  try {
    const service = new SupportTicketService();
    const message = await service.ingestPublicReplyFromCrm("crm-ticket-22", {
      crmMessageId: "crm-message-22",
      body: "We fixed the issue from our side.",
      repliedBy: {
        name: "Raj Kumar",
      },
      status: "waiting_for_customer",
      createdAt: "2026-03-20T12:10:00.000Z",
      lastAgentReplyAt: "2026-03-20T12:10:00.000Z",
    });

    assert.equal(ticket.status, "waiting_for_customer");
    assert.equal(ticket.syncStatus, "synced");
    assert.equal(emailSendCount, 1);
    assert.equal(message.crmMessageId, "crm-message-22");
    assert.equal(message.authorType, "support");
    assert.equal(savedTickets.length, 1);
    assert.equal(savedMessages.length, 2);
    assert.ok(savedMessages[1].emailedAt instanceof Date);
  } finally {
    restoreGetRepository();
    restoreSendMail();
  }
});
