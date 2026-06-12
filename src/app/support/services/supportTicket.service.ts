import crypto from "crypto";
import { Repository } from "typeorm";
import AppDataSource from "../../../db/data-source";
import {
  SupportSyncStatus,
  SupportTicket,
  SupportTicketStatus,
} from "../../../entity/SupportTicket";
import { SupportTicketMessage } from "../../../entity/SupportTicketMessage";
import { User } from "../../../entity/User";
import { sendSupportTicketReplyEmail } from "../../../types/email.service";
import { SupportTicketCrmSyncService } from "./supportTicketCrmSync.service";

export type CreateSupportTicketPayload = {
  subject?: string;
  body?: string;
};

export type CreateSupportTicketMessagePayload = {
  body?: string;
};

type TicketListFilters = {
  status?: string;
};

type MirrorTicketUpsertPayload = {
  crmTicketId?: string | null;
  externalTradingTicketId?: string | null;
  platformUserId?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  subject?: string | null;
  status?: string | null;
  assignedExecutiveId?: string | null;
  assignedExecutiveName?: string | null;
  lastCustomerMessageAt?: string | Date | null;
  lastAgentReplyAt?: string | Date | null;
  closedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type MirrorPublicReplyPayload = {
  crmMessageId?: string | null;
  externalTradingTicketId?: string | null;
  body?: string | null;
  repliedBy?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  createdAt?: string | Date | null;
  status?: string | null;
  lastAgentReplyAt?: string | Date | null;
};

type CrmTicketEnvelope = {
  _id?: string;
  status?: string;
  assignedTo?: {
    _id?: string;
    name?: string;
  } | null;
};

type CrmCreateResponse = {
  data?: {
    ticket?: CrmTicketEnvelope;
  };
};

const STATUS_OPEN: SupportTicketStatus = "open";
const STATUS_ASSIGNED: SupportTicketStatus = "assigned";
const STATUS_WAITING_FOR_SUPPORT: SupportTicketStatus = "waiting_for_support";
const STATUS_WAITING_FOR_CUSTOMER: SupportTicketStatus = "waiting_for_customer";
const STATUS_CLOSED: SupportTicketStatus = "closed";

function toDateOrNull(value?: string | Date | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeTicketStatus(value?: string | null): SupportTicketStatus {
  switch (String(value || "").trim()) {
    case STATUS_ASSIGNED:
      return STATUS_ASSIGNED;
    case STATUS_WAITING_FOR_SUPPORT:
      return STATUS_WAITING_FOR_SUPPORT;
    case STATUS_WAITING_FOR_CUSTOMER:
      return STATUS_WAITING_FOR_CUSTOMER;
    case STATUS_CLOSED:
      return STATUS_CLOSED;
    default:
      return STATUS_OPEN;
  }
}

function createHttpError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

export class SupportTicketService {
  private readonly ticketRepo: Repository<SupportTicket>;
  private readonly messageRepo: Repository<SupportTicketMessage>;
  private readonly userRepo: Repository<User>;
  private readonly crmSyncService: SupportTicketCrmSyncService;

  constructor() {
    this.ticketRepo = AppDataSource.getRepository(SupportTicket);
    this.messageRepo = AppDataSource.getRepository(SupportTicketMessage);
    this.userRepo = AppDataSource.getRepository(User);
    this.crmSyncService = new SupportTicketCrmSyncService();
  }

  async ensureSchema() {
    await AppDataSource.manager.query(`CREATE EXTENSION IF NOT EXISTS citext;`);

    await AppDataSource.manager.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        external_ticket_id VARCHAR(120) NOT NULL UNIQUE,
        crm_ticket_id VARCHAR(120) UNIQUE,
        platform_user_id VARCHAR(120) NOT NULL,
        contact_email CITEXT NOT NULL,
        contact_name TEXT,
        subject VARCHAR(255) NOT NULL,
        status VARCHAR(32) NOT NULL,
        assigned_executive_id VARCHAR(120),
        assigned_executive_name VARCHAR(255),
        last_customer_message_at TIMESTAMPTZ,
        last_agent_reply_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        sync_status VARCHAR(32) NOT NULL DEFAULT 'pending',
        last_sync_error TEXT,
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await AppDataSource.manager.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_user_updated_at
      ON support_tickets (user_id, updated_at DESC);
    `);
    await AppDataSource.manager.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status_updated_at
      ON support_tickets (status, updated_at DESC);
    `);
    await AppDataSource.manager.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_platform_user_id
      ON support_tickets (platform_user_id);
    `);

    await AppDataSource.manager.query(`
      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        external_message_id VARCHAR(120) UNIQUE,
        crm_message_id VARCHAR(120) UNIQUE,
        author_type VARCHAR(32) NOT NULL,
        body TEXT NOT NULL,
        sync_status VARCHAR(32) NOT NULL DEFAULT 'pending',
        last_sync_error TEXT,
        last_sync_at TIMESTAMPTZ,
        emailed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await AppDataSource.manager.query(`
      CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_created_at
      ON support_ticket_messages (ticket_id, created_at);
    `);
  }

  private async getUserOrThrow(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw createHttpError("user_not_found", 404);
    }
    return user;
  }

  private async getTicketForUserOrThrow(ticketId: number, userId: number) {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId, userId },
    });
    if (!ticket) {
      throw createHttpError("support_ticket_not_found", 404);
    }
    return ticket;
  }

  private async getTicketByCrmOrExternalId({
    crmTicketId,
    externalTicketId,
  }: {
    crmTicketId?: string | null;
    externalTicketId?: string | null;
  }) {
    if (crmTicketId) {
      const byCrmId = await this.ticketRepo.findOne({
        where: { crmTicketId },
      });
      if (byCrmId) return byCrmId;
    }
    if (externalTicketId) {
      return this.ticketRepo.findOne({
        where: { externalTicketId },
      });
    }
    return null;
  }

  private async markTicketSync(
    ticket: SupportTicket,
    status: SupportSyncStatus,
    error?: unknown
  ) {
    ticket.syncStatus = status;
    ticket.lastSyncAt = new Date();
    ticket.lastSyncError = error ? String((error as Error).message || error) : null;
    return this.ticketRepo.save(ticket);
  }

  private async markMessageSync(
    message: SupportTicketMessage,
    status: SupportSyncStatus,
    error?: unknown
  ) {
    message.syncStatus = status;
    message.lastSyncAt = new Date();
    message.lastSyncError = error ? String((error as Error).message || error) : null;
    return this.messageRepo.save(message);
  }

  private applyCrmTicketSnapshot(ticket: SupportTicket, crmTicket?: CrmTicketEnvelope) {
    if (!crmTicket) return;
    if (crmTicket._id) {
      ticket.crmTicketId = String(crmTicket._id);
    }
    if (crmTicket.status) {
      ticket.status = normalizeTicketStatus(crmTicket.status);
      ticket.closedAt = ticket.status === STATUS_CLOSED ? new Date() : null;
    }
    if (crmTicket.assignedTo?._id) {
      ticket.assignedExecutiveId = String(crmTicket.assignedTo._id);
      ticket.assignedExecutiveName = crmTicket.assignedTo.name || null;
    }
  }

  private async hydrateTicket(ticket: SupportTicket) {
    const messages = await this.messageRepo.find({
      where: { ticketId: ticket.id },
      order: { createdAt: "ASC" },
    });
    return {
      ticket,
      messages,
    };
  }

  async listMyTickets(userId: number, filters: TicketListFilters = {}) {
    const where: { userId: number; status?: SupportTicketStatus } = { userId };
    if (filters.status) {
      where.status = normalizeTicketStatus(filters.status);
    }
    return this.ticketRepo.find({
      where,
      order: { updatedAt: "DESC" },
    });
  }

  async getMyTicketById(userId: number, ticketId: number) {
    const ticket = await this.getTicketForUserOrThrow(ticketId, userId);
    return this.hydrateTicket(ticket);
  }

  async createMyTicket(userId: number, payload: CreateSupportTicketPayload) {
    const subject = String(payload.subject || "").trim();
    const body = String(payload.body || "").trim();

    if (!subject || !body) {
      throw createHttpError("missing_required_fields", 400);
    }

    const user = await this.getUserOrThrow(userId);
    const externalTicketId = crypto.randomUUID();
    const externalMessageId = crypto.randomUUID();

    const ticket = this.ticketRepo.create({
      userId,
      externalTicketId,
      crmTicketId: null,
      platformUserId: String(user.id),
      contactEmail: user.email,
      contactName: user.name || null,
      subject,
      status: STATUS_OPEN,
      assignedExecutiveId: null,
      assignedExecutiveName: null,
      lastCustomerMessageAt: new Date(),
      lastAgentReplyAt: null,
      closedAt: null,
      syncStatus: "pending",
      lastSyncError: null,
      lastSyncAt: null,
    });
    await this.ticketRepo.save(ticket);

    const message = this.messageRepo.create({
      ticketId: ticket.id,
      externalMessageId,
      crmMessageId: null,
      authorType: "customer",
      body,
      syncStatus: "pending",
      lastSyncError: null,
      lastSyncAt: null,
      emailedAt: null,
    });
    await this.messageRepo.save(message);

    try {
      const response = (await this.crmSyncService.createTicket({
        externalTradingTicketId: externalTicketId,
        platformUserId: String(user.id),
        email: user.email,
        name: user.name || null,
        subject,
        message: body,
        createdAt: message.createdAt.toISOString(),
        organizationId:
          String(process.env.CRM_DEFAULT_ORGANIZATION_ID || "").trim() || null,
      })) as CrmCreateResponse;

      this.applyCrmTicketSnapshot(ticket, response?.data?.ticket);
      await this.markTicketSync(ticket, "synced");
      await this.markMessageSync(message, "synced");
    } catch (error) {
      await this.markTicketSync(ticket, "failed", error);
      await this.markMessageSync(message, "failed", error);
      throw createHttpError("crm_support_sync_failed", 502);
    }

    return this.hydrateTicket(ticket);
  }

  async addMyMessage(
    userId: number,
    ticketId: number,
    payload: CreateSupportTicketMessagePayload
  ) {
    const body = String(payload.body || "").trim();
    if (!body) {
      throw createHttpError("missing_message_body", 400);
    }

    const ticket = await this.getTicketForUserOrThrow(ticketId, userId);
    const externalMessageId = crypto.randomUUID();

    ticket.status = STATUS_WAITING_FOR_SUPPORT;
    ticket.closedAt = null;
    ticket.lastCustomerMessageAt = new Date();
    ticket.syncStatus = "pending";
    ticket.lastSyncError = null;
    await this.ticketRepo.save(ticket);

    const message = this.messageRepo.create({
      ticketId: ticket.id,
      externalMessageId,
      crmMessageId: null,
      authorType: "customer",
      body,
      syncStatus: "pending",
      lastSyncError: null,
      lastSyncAt: null,
      emailedAt: null,
    });
    await this.messageRepo.save(message);

    try {
      await this.crmSyncService.addMessage(ticket.externalTicketId, {
        externalTradingMessageId: externalMessageId,
        platformUserId: ticket.platformUserId,
        body,
        createdAt: message.createdAt.toISOString(),
      });
      await this.markTicketSync(ticket, "synced");
      await this.markMessageSync(message, "synced");
    } catch (error) {
      await this.markTicketSync(ticket, "failed", error);
      await this.markMessageSync(message, "failed", error);
      throw createHttpError("crm_support_sync_failed", 502);
    }

    return this.hydrateTicket(ticket);
  }

  async upsertFromCrm(payload: MirrorTicketUpsertPayload) {
    const externalTicketId = String(payload.externalTradingTicketId || "").trim();
    const crmTicketId = String(payload.crmTicketId || "").trim() || null;
    const platformUserId = String(payload.platformUserId || "").trim();

    if (!externalTicketId && !crmTicketId) {
      throw createHttpError("missing_ticket_identifier", 400);
    }

    let ticket = await this.getTicketByCrmOrExternalId({
      crmTicketId,
      externalTicketId,
    });

    if (!ticket) {
      const userId = Number(platformUserId);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw createHttpError("invalid_platform_user_id", 400);
      }
      const user = await this.getUserOrThrow(userId);
      ticket = this.ticketRepo.create({
        userId,
        externalTicketId: externalTicketId || crypto.randomUUID(),
        crmTicketId,
        platformUserId: String(user.id),
        contactEmail: String(payload.contactEmail || user.email),
        contactName: String(payload.contactName || user.name || "") || null,
        subject: String(payload.subject || "Support Ticket"),
        status: normalizeTicketStatus(payload.status),
        assignedExecutiveId: payload.assignedExecutiveId
          ? String(payload.assignedExecutiveId)
          : null,
        assignedExecutiveName: payload.assignedExecutiveName
          ? String(payload.assignedExecutiveName)
          : null,
        lastCustomerMessageAt: toDateOrNull(payload.lastCustomerMessageAt),
        lastAgentReplyAt: toDateOrNull(payload.lastAgentReplyAt),
        closedAt: toDateOrNull(payload.closedAt),
        syncStatus: "synced",
        lastSyncError: null,
        lastSyncAt: new Date(),
      });
    } else {
      if (crmTicketId) ticket.crmTicketId = crmTicketId;
      if (externalTicketId) ticket.externalTicketId = externalTicketId;
      if (payload.contactEmail) ticket.contactEmail = String(payload.contactEmail);
      if (payload.contactName !== undefined) {
        ticket.contactName = payload.contactName ? String(payload.contactName) : null;
      }
      if (payload.subject) ticket.subject = String(payload.subject);
      ticket.status = normalizeTicketStatus(payload.status);
      ticket.assignedExecutiveId = payload.assignedExecutiveId
        ? String(payload.assignedExecutiveId)
        : null;
      ticket.assignedExecutiveName = payload.assignedExecutiveName
        ? String(payload.assignedExecutiveName)
        : null;
      ticket.lastCustomerMessageAt = toDateOrNull(payload.lastCustomerMessageAt);
      ticket.lastAgentReplyAt = toDateOrNull(payload.lastAgentReplyAt);
      ticket.closedAt = toDateOrNull(payload.closedAt);
      ticket.syncStatus = "synced";
      ticket.lastSyncError = null;
      ticket.lastSyncAt = new Date();
    }

    return this.ticketRepo.save(ticket);
  }

  async ingestPublicReplyFromCrm(
    crmTicketId: string,
    payload: MirrorPublicReplyPayload
  ) {
    const normalizedCrmTicketId = String(crmTicketId || "").trim();
    if (!normalizedCrmTicketId) {
      throw createHttpError("missing_crm_ticket_id", 400);
    }

    const crmMessageId = String(payload.crmMessageId || "").trim();
    const body = String(payload.body || "").trim();
    if (!crmMessageId || !body) {
      throw createHttpError("missing_reply_payload", 400);
    }

    const existingMessage = await this.messageRepo.findOne({
      where: { crmMessageId },
    });
    if (existingMessage) {
      return existingMessage;
    }

    const ticket =
      (await this.getTicketByCrmOrExternalId({
        crmTicketId: normalizedCrmTicketId,
        externalTicketId: payload.externalTradingTicketId || null,
      })) || null;

    if (!ticket) {
      throw createHttpError("support_ticket_not_found", 404);
    }

    ticket.status = normalizeTicketStatus(payload.status || STATUS_WAITING_FOR_CUSTOMER);
    ticket.lastAgentReplyAt = toDateOrNull(payload.lastAgentReplyAt || payload.createdAt);
    ticket.closedAt = ticket.status === STATUS_CLOSED ? new Date() : null;
    ticket.syncStatus = "synced";
    ticket.lastSyncAt = new Date();
    ticket.lastSyncError = null;
    await this.ticketRepo.save(ticket);

    const message = this.messageRepo.create({
      ticketId: ticket.id,
      externalMessageId: null,
      crmMessageId,
      authorType: "support",
      body,
      syncStatus: "synced",
      lastSyncError: null,
      lastSyncAt: new Date(),
      emailedAt: null,
    });
    await this.messageRepo.save(message);

    try {
      await sendSupportTicketReplyEmail({
        email: ticket.contactEmail,
        ticketSubject: ticket.subject,
        replyBody: body,
        executiveName: payload.repliedBy?.name || null,
      });
      message.emailedAt = new Date();
      await this.messageRepo.save(message);
    } catch (error) {
      console.warn("[SUPPORT_EMAIL] failed", (error as Error).message || error);
    }

    return message;
  }
}
