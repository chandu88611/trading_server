import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { UserDBService } = require("../../app/user/services/user.db");
const { UserService } = require("../../app/user/services/user.service");
const emailVerificationService = require("../../app/user/services/email-verification.service");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("UserService: registerWithEmail retries referral code generation on unique collisions", async () => {
  const createCalls: any[] = [];

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreFindByEmail = patch(UserDBService.prototype, "findByEmail", async () => null);
  const restoreFindByReferralCode = patch(
    UserDBService.prototype,
    "findByReferralCode",
    async () => ({ id: 42, referralCode: "ROOT0042" })
  );
  const restoreCountAdmins = patch(UserDBService.prototype, "countAdmins", async () => 0);
  const restoreCreateUser = patch(
    UserDBService.prototype,
    "createUser",
    async (params: any) => {
      createCalls.push(params);
      if (createCalls.length === 1) {
        throw {
          code: "23505",
          constraint: "uq_users_referral_code_nonnull",
        };
      }

      return {
        id: 301,
        email: params.email,
        name: params.name ?? null,
        referralCode: params.referralCode,
        referredByUserId: params.referredByUserId ?? null,
        isAdmin: params.isAdmin ?? false,
        isEmailVerified: params.isEmailVerified ?? false,
      };
    }
  );
  const restoreSetEmailVerificationToken = patch(
    UserDBService.prototype,
    "setEmailVerificationToken",
    async () => undefined
  );
  const restoreSaveRefreshToken = patch(
    UserDBService.prototype,
    "saveRefreshToken",
    async () => ({ id: 1, tokenHash: "hash", revoked: false })
  );
  const restoreSendVerificationEmail = patch(
    emailVerificationService,
    "sendUserVerificationEmail",
    async () => undefined
  );

  try {
    const service = new UserService();
    const result = await service.registerWithEmail(
      "retry@example.com",
      "StrongPass123",
      "Retry User",
      false,
      "ROOT0042"
    );

    assert.equal(result.user.id, 301);
    assert.equal(createCalls.length, 2);
    assert.equal(createCalls[0].referredByUserId, 42);
    assert.equal(createCalls[1].referredByUserId, 42);
    assert.match(createCalls[0].referralCode, /^[A-Z0-9]{8}$/);
    assert.match(createCalls[1].referralCode, /^[A-Z0-9]{8}$/);
    assert.notEqual(createCalls[0].referralCode, createCalls[1].referralCode);
  } finally {
    restoreSendVerificationEmail();
    restoreSaveRefreshToken();
    restoreSetEmailVerificationToken();
    restoreCreateUser();
    restoreCountAdmins();
    restoreFindByReferralCode();
    restoreFindByEmail();
    restoreGetRepository();
  }
});

test("UserService: registerWithProvider ignores referral code when the user already exists", async () => {
  let findByReferralCodeCalled = false;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreFindByEmail = patch(UserDBService.prototype, "findByEmail", async () => ({
    id: 88,
    email: "existing@example.com",
    name: "Existing User",
    isAdmin: false,
  }));
  const restoreFindByReferralCode = patch(
    UserDBService.prototype,
    "findByReferralCode",
    async () => {
      findByReferralCodeCalled = true;
      return null;
    }
  );
  const restoreGetProvider = patch(
    UserDBService.prototype,
    "getProvider",
    async () => ({
      id: 1,
      userId: 88,
      provider: "google",
      providerUserId: "google-88",
    })
  );
  const restoreSaveRefreshToken = patch(
    UserDBService.prototype,
    "saveRefreshToken",
    async () => ({ id: 1, tokenHash: "hash", revoked: false })
  );

  try {
    const service = new UserService();
    const result = await service.registerWithProvider(
      "google",
      "google-88",
      "existing@example.com",
      "Existing User",
      false,
      "BADCODE1"
    );

    assert.equal(result.isNewUser, false);
    assert.equal(result.user.id, 88);
    assert.equal(findByReferralCodeCalled, false);
  } finally {
    restoreSaveRefreshToken();
    restoreGetProvider();
    restoreFindByReferralCode();
    restoreFindByEmail();
    restoreGetRepository();
  }
});

test("UserService: getReferralSummary masks user emails and returns full emails for admin views", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreGetReferralSummaryData = patch(
    UserDBService.prototype,
    "getReferralSummaryData",
    async () => ({
      user: {
        id: 9,
        referralCode: "ROOT0009",
      },
      level1Upline: {
        id: 2,
        name: "Parent User",
        email: "parent@example.com",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        referralCode: "PARENT01",
        referredByUserId: null,
      },
      level2Upline: null,
      level1Downline: [
        {
          id: 10,
          name: "Child One",
          email: "child.one@example.com",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          referralCode: "CHILD001",
          referredByUserId: 9,
        },
      ],
      level2Downline: [
        {
          id: 11,
          name: "Grandchild",
          email: "grand.child@example.com",
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
          referralCode: "GRAND001",
          referredByUserId: 10,
        },
      ],
    })
  );

  try {
    const service = new UserService();
    const userView = await service.getReferralSummary(9, false);
    const adminView = await service.getReferralSummary(9, true);

    assert.deepEqual(userView.counts, {
      level1: 1,
      level2: 1,
      total: 2,
    });
    assert.equal(userView.downline.level1[0].maskedEmail, "ch***@example.com");
    assert.equal("email" in userView.downline.level1[0], false);
    assert.equal(adminView.downline.level1[0].email, "child.one@example.com");
    assert.equal("maskedEmail" in adminView.downline.level1[0], false);
  } finally {
    restoreGetReferralSummaryData();
    restoreGetRepository();
  }
});
