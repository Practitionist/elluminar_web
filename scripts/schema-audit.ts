/**
 * Schema-coverage audit (issue #43).
 *
 * The schema is FROZEN before launch: zero migrations once customers are on board.
 * Every post-MVP issue (#1–#29) documents the models/fields it relies on; this script
 * cross-checks those claims against prisma/models/*.prisma so a schema edit that
 * breaks a documented hook fails loudly (runs in CI, no DB needed).
 *
 * Requirement syntax: "Model" | "Model.field" | "Enum.VALUE" (enums share the syntax —
 * the checker matches either a field inside a model block or a value inside an enum block).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MODELS_DIR = join(process.cwd(), "prisma", "models");

/** Post-MVP issue → schema hooks it documents under "Schema already in place". */
const CLAIMS: Record<string, string[]> = {
  "#1 Dodo Payments (MoR)": [
    "PaymentProviderKind.DODO",
    "Payment.providerOrderRef",
    "Payment.providerPaymentRef",
    "Payment.raw",
    "Refund.providerRefundRef",
    "SubscriptionPlan.providerRefs",
    "UserProviderIdentity.externalRef",
    "WebhookEvent.eventRef",
  ],
  "#2 Sprint & Flagship tiers": [
    "Project.tier",
    "Project.defenseRequired",
    "Project.mentorHoursBudget",
    "SubscriptionCredit.creditType",
    "SubscriptionCredit.periodKey",
    "ProjectInstance.subscriptionCreditId",
    "Price.mentorLevel",
  ],
  "#3 Live defense engine": [
    "DefenseSession.aiQuestionPlan",
    "DefenseSession.transcriptAssetId",
    "DefenseSession.recordingVideoAssetId",
    "AiUsageEvent.feature",
  ],
  "#4 AI tutor + wallet": [
    "AiWallet.balanceCredits",
    "AiWallet.dailyAllowance",
    "AiCreditPack",
    "AiUsageEvent.costMicrosUsd",
    "AiConversation",
    "AiMessage",
  ],
  "#5 AI first-pass review": [
    "ProjectReview.aiMetadata",
    "RubricScore",
    "MilestoneSubmission",
  ],
  "#6 Proof-of-Work portfolios": [
    "PortfolioProfile.slug",
    "PortfolioProfile.talentOptIn",
    "PortfolioProfile.featured",
    "MentorEndorsement",
    "Credential",
  ],
  "#7 Free staged funnel": [
    "Program",
    "ProgramItem.unlockAfterItemId",
    "ProgramCohort",
    "ProjectInstanceCollaborator",
    "Project.partnerTenantId",
    "Waitlist.source",
  ],
  "#8 Referrals & affiliates": [
    "ReferralCode.rewardConfig",
    "Referral.rewardLedgerEntryId",
    "Referral.firstOrderId",
    "Coupon.campaign",
  ],
  "#9 EMI & financing": [
    "Subscription.pausedAt",
    "Subscription.resumesAt",
    "Order.metadata",
    "OrderItem.metadata",
  ],
  "#10 Novu notifications": [
    "Notification.channelsSent",
    "NotificationPreference.prefs",
    "DeviceToken",
    "User.phone",
    "User.marketingOptIn",
    "Announcement.channels",
  ],
  "#13 Subdomain/custom domains": [
    "Tenant.subdomain",
    "Tenant.customDomain",
    "Tenant.domainVerifiedAt",
  ],
  "#14 RazorpayX payouts + KYC": [
    "Payout.providerRef",
    "Payout.statementAssetId",
    "LedgerAccount",
    "LedgerEntry",
    "Tenant.payoutDetails",
  ],
  "#15 Community (pods/XP)": [
    "Pod",
    "PodMember",
    "XpEvent",
    "UserStreak",
    "Badge",
    "UserBadge",
  ],
  "#16 Search + soft bundles": ["Bundle", "BundleItem"],
  "#18 Talent marketplace": [
    "TalentBookmark",
    "PortfolioProfile.talentPreferences",
    "Tenant.type",
    "SubscriptionPlan.audience",
  ],
  "#19 Mentor bookings": [
    "MentorOffering.durationMin",
    "MentorBooking.orderItemId",
    "MentorBooking.liveSessionId",
    "LiveSession.calendarEventRef",
    "MentorProfile.availability",
  ],
  "#20 Trust & integrity": [
    "IntegrityFlag",
    "ProctorRecord",
    "Credential.revokedAt",
    "Quiz.proctored",
  ],
  "#21 Regional/PPP pricing": [
    "Price.region",
    "Price.currency",
    "Order.currency",
    "Cart.currency",
  ],
  "#22 Gifting & team seats": [
    "OrderItem.giftRecipientEmail",
    "OrderItem.giftClaimToken",
    "OrderItem.giftClaimedById",
    "CartItem.giftRecipientEmail",
  ],
  "#23 SCORM/xAPI export": ["ReportExport"],
  "#24 Compliance pack": [
    "Invoice.refundId",
    "InvoiceSeries",
    "Order.billTo",
    "OrderItem.taxMinor",
    "OrderItem.taxRateBps",
    "Tenant.gstin",
    "User.anonymizedAt",
  ],
  "#25 Income-share / success-fee": [
    "PaymentAgreement",
    "PaymentAgreement.termsVersion",
    "PaymentAgreement.triggerConditions",
    "PaymentAgreementStatus.WAIVED",
  ],
  "#26 Digital products": ["DigitalProduct.kind", "CommerceItemType.DIGITAL_PRODUCT"],
  "#27 Scholarship campaigns": ["Coupon.campaign", "CouponRedemption", "Waitlist"],
  "#29 Mobile app": ["DeviceToken"],
};

type Block = { kind: "model" | "enum"; body: string };

function parseBlocks(): Map<string, Block> {
  const blocks = new Map<string, Block>();
  for (const file of readdirSync(MODELS_DIR).filter((f) => f.endsWith(".prisma"))) {
    const src = readFileSync(join(MODELS_DIR, file), "utf8");
    const re = /^(model|enum)\s+(\w+)\s+\{([\s\S]*?)^\}/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      blocks.set(m[2]!, { kind: m[1] as Block["kind"], body: m[3]! });
    }
  }
  return blocks;
}

function check(blocks: Map<string, Block>, claim: string): string | null {
  const [name, member] = claim.split(".");
  const block = blocks.get(name!);
  if (!block) return `missing ${name}`;
  if (!member) return null;
  const memberRe =
    block.kind === "model"
      ? new RegExp(`^\\s*${member}\\s+\\S`, "m") // field: name + type
      : new RegExp(`^\\s*${member}\\s*$`, "m"); // enum value on its own line
  return memberRe.test(block.body) ? null : `missing ${block.kind} member ${claim}`;
}

const blocks = parseBlocks();
const failures: string[] = [];
let checked = 0;

for (const [issue, claims] of Object.entries(CLAIMS)) {
  for (const claim of claims) {
    checked += 1;
    const error = check(blocks, claim);
    if (error) failures.push(`${issue}: ${error}`);
  }
}

if (failures.length > 0) {
  console.error(`Schema audit FAILED — ${failures.length} broken hook(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `Schema audit passed: ${checked} documented hooks across ${Object.keys(CLAIMS).length} post-MVP issues all present (${blocks.size} models/enums scanned).`,
);
