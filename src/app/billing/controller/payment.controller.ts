import { Request, Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { RazorpayService } from "../services/razorpay.service";
import { RazorpayXService } from "../services/razorpayx.service";
import { BillingDBService } from "../services/billing.db";
import { SubscriptionPlan } from "../../../entity";
import { AuthRequest, Roles } from "../../../middleware/auth";
import { HttpStatusCode } from "../../../types/constants";

const razorpayService = new RazorpayService();
const razorpayXService = new RazorpayXService();
const billingDb = new BillingDBService();

function getAuthUserId(req: Request): number {
  const raw = (req as any).auth?.id ?? (req as any).auth?.userId;
  return Number(raw || 0);
}

export class PaymentController {
  private ensureNonAdmin(req: AuthRequest) {
    const roles = req.auth?.roles ?? [];
    if (roles.includes(Roles.ADMIN)) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "admin_subscriptions_not_allowed",
      };
    }
  }

  private ensureAdmin(req: AuthRequest) {
    const roles = req.auth?.roles ?? [];
    if (!roles.includes(Roles.ADMIN)) {
      throw {
        statusCode: HttpStatusCode._UNAUTHORISED,
        message: "Admin access required",
      };
    }
  }

  @ControllerError()
  async createCheckout(req: AuthRequest, res: Response) {
    this.ensureNonAdmin(req);
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { planId } = req.body as { planId: number };
    if (!planId) return res.status(400).json({ message: "planId required" });

    const planRepo = (await import("../../../db/data-source")).default.getRepository(
      SubscriptionPlan
    );
    const plan = (await planRepo.findOne({
      where: { id: planId } as any,
      relations: { pricing: true } as any,
    })) as SubscriptionPlan | null;

    if (!plan) return res.status(404).json({ message: "Plan not found" });
    if (!(plan as any).isActive) return res.status(400).json({ message: "Plan is inactive" });

    const checkout = await billingDb.createRazorpayCheckout(userId, plan);

    return res.status(201).json({
      message: "Checkout created",
      data: {
        keyId: razorpayService.getPublicKeyId(),
        orderId: checkout.razorpayOrderId,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        invoiceId: checkout.invoiceId,
        planId: plan.id,
        planName: plan.name,
      },
    });
  }

  @ControllerError()
  async verifyPayment(req: AuthRequest, res: Response) {
    this.ensureNonAdmin(req);
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      invoiceId,
    } = req.body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      invoiceId: number;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoiceId) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    const ok = razorpayService.verifyCheckoutSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!ok) return res.status(400).json({ message: "Invalid payment signature" });

    const updated = await billingDb.markInvoicePaidFromClientVerification({
      userId,
      invoiceId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      gatewayPayload: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
    });

    return res.status(200).json({
      message: "Payment verified",
      data: updated,
    });
  }

  @ControllerError()
  async getWallet(req: AuthRequest, res: Response) {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const wallet = await billingDb.getWalletSummary(userId);
    return res.status(200).json({
      message: "Wallet fetched successfully",
      data: wallet,
    });
  }

  @ControllerError()
  async listWithdrawals(req: AuthRequest, res: Response) {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const withdrawals = await billingDb.listWithdrawals(userId);
    return res.status(200).json({
      message: "Withdrawals fetched successfully",
      data: withdrawals,
    });
  }

  @ControllerError()
  async createWithdrawal(req: AuthRequest, res: Response) {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { amount } = req.body as { amount?: number };
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return res.status(400).json({ message: "amount must be a number" });
    }

    const withdrawal = await billingDb.createWithdrawalRequest(userId, amount);
    return res.status(201).json({
      message: "Withdrawal requested",
      data: withdrawal,
    });
  }

  @ControllerError()
  async listAdminWithdrawals(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const withdrawals = await billingDb.listAdminWithdrawals();

    return res.status(200).json({
      message: "Admin withdrawals fetched successfully",
      data: withdrawals,
    });
  }

  @ControllerError()
  async approveWithdrawal(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const adminUserId = getAuthUserId(req);
    const withdrawalId = Number(req.params.withdrawalId);
    const notes = String(req.body?.notes ?? "").trim() || null;

    if (!Number.isFinite(withdrawalId) || withdrawalId <= 0) {
      return res.status(400).json({ message: "Invalid withdrawalId" });
    }

    const withdrawal = await billingDb.approveWithdrawalRequest(
      withdrawalId,
      adminUserId,
      notes
    );

    return res.status(200).json({
      message: "Withdrawal approved",
      data: withdrawal,
    });
  }

  @ControllerError()
  async rejectWithdrawal(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const adminUserId = getAuthUserId(req);
    const withdrawalId = Number(req.params.withdrawalId);
    const notes =
      String(req.body?.notes ?? req.body?.reason ?? "").trim() || null;

    if (!Number.isFinite(withdrawalId) || withdrawalId <= 0) {
      return res.status(400).json({ message: "Invalid withdrawalId" });
    }

    const withdrawal = await billingDb.rejectWithdrawalRequest(
      withdrawalId,
      adminUserId,
      notes
    );

    return res.status(200).json({
      message: "Withdrawal rejected",
      data: withdrawal,
    });
  }

  @ControllerError()
  async updateWithdrawalSettings(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);

    const { minWithdrawalAmountInr } = req.body as {
      minWithdrawalAmountInr?: number;
    };

    if (
      typeof minWithdrawalAmountInr !== "number" ||
      !Number.isFinite(minWithdrawalAmountInr)
    ) {
      return res
        .status(400)
        .json({ message: "minWithdrawalAmountInr must be a number" });
    }

    const settings = await billingDb.updateWithdrawalSettings(
      minWithdrawalAmountInr
    );

    return res.status(200).json({
      message: "Withdrawal settings updated",
      data: settings,
    });
  }

  @ControllerError()
  async getCurrentSubscription(req: AuthRequest, res: Response) {
    this.ensureNonAdmin(req);
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const sub = await billingDb.getCurrentSubscription(userId);
    if (!sub) return res.status(200).json({ message: "No subscription", data: null });

    return res.status(200).json({ message: "Fetched current subscription", data: sub });
  }

  @ControllerError()
  async cancelSubscription(req: AuthRequest, res: Response) {
    this.ensureNonAdmin(req);
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { immediate } = (req.body || {}) as { immediate?: boolean };

    const updated = await billingDb.cancelLocalSubscription(userId, Boolean(immediate));

    return res.status(200).json({
      message: immediate ? "Subscription canceled immediately" : "Subscription canceled (access until end_date)",
      data: updated,
    });
  }

  @ControllerError()
  async listMyInvoices(req: AuthRequest, res: Response) {
    const userId = Number((req as any).auth!.userId);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const { items, total } = await billingDb.listInvoicesForUser(userId, page, limit);
    res.json({ data: items, total, page, limit });
  }

  @ControllerError()
  async webhook(req: Request, res: Response) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    if (!webhookSecret) return res.status(500).send("RAZORPAY_WEBHOOK_SECRET missing");

    const signature = (req.headers["x-razorpay-signature"] as string) || "";
    const rawBody = ((req as any).rawBody ?? req.body) as Buffer;

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      return res.status(400).send("Webhook raw body missing");
    }

    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) return res.status(400).send("Invalid webhook signature");

    let event: any;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).send("Invalid JSON payload");
    }

    const eventType = event?.event;

    switch (eventType) {
      case "payment.captured":
        await billingDb.handleRazorpayPaymentCaptured(event);
        break;

      case "payment.failed":
        await billingDb.handleRazorpayPaymentFailed(event);
        break;

      case "order.paid":
        await billingDb.handleRazorpayOrderPaid(event);
        break;

      default:
        break;
    }

    return res.status(200).json({ received: true });
  }

  @ControllerError()
  async payoutWebhook(req: Request, res: Response) {
    const webhookSecret = process.env.RAZORPAYX_WEBHOOK_SECRET || "";
    if (!webhookSecret) return res.status(500).send("RAZORPAYX_WEBHOOK_SECRET missing");

    const signature = (req.headers["x-razorpay-signature"] as string) || "";
    const rawBody = ((req as any).rawBody ?? req.body) as Buffer;

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      return res.status(400).send("Webhook raw body missing");
    }

    const isValid = razorpayXService.verifyWebhookSignature(
      rawBody,
      signature,
      webhookSecret
    );
    if (!isValid) return res.status(400).send("Invalid webhook signature");

    let event: any;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).send("Invalid JSON payload");
    }

    await billingDb.handleRazorpayXPayoutWebhook(event);

    return res.status(200).json({ received: true });
  }
}
