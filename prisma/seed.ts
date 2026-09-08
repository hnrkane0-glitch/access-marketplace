import { PrismaClient } from "@prisma/client";
import { PLATFORM_SYSTEM_USER_EMAIL } from "../src/lib/ledger";
import crypto from "crypto";

const db = new PrismaClient();

async function main() {
  // The platform's own "user" row, needed because every LedgerEntry.userId
  // is a real FK — see ARCHITECTURE.md §4. This account can never log in:
  // its password hash is a random, unusable value.
  await db.user.upsert({
    where: { email: PLATFORM_SYSTEM_USER_EMAIL },
    update: {},
    create: {
      email: PLATFORM_SYSTEM_USER_EMAIL,
      fullName: "Platform",
      passwordHash: crypto.randomBytes(32).toString("hex"),
      isAdmin: false,
    },
  });

  await db.platformSetting.upsert({
    where: { key: "platformCommissionBps" },
    update: {},
    create: { key: "platformCommissionBps", value: 1000 },
  });
  await db.platformSetting.upsert({
    where: { key: "payoutHoldDays" },
    update: {},
    create: { key: "payoutHoldDays", value: 5 },
  });
  await db.platformSetting.upsert({
    where: { key: "minWithdrawalKobo" },
    update: {},
    create: { key: "minWithdrawalKobo", value: 500_000 },
  });

  const topLevel = [
    { name: "Spaces", slug: "spaces" },
    { name: "Equipment", slug: "equipment" },
    { name: "People & Skills", slug: "people" },
    { name: "Business Capacity", slug: "capacity" },
    { name: "Mobility", slug: "mobility" },
    { name: "Events", slug: "events" },
    { name: "Storage", slug: "storage" },
    { name: "Work & Learning", slug: "work" },
  ];
  for (const [i, cat] of topLevel.entries()) {
    await db.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { name: cat.name, slug: cat.slug, sortOrder: i },
    });
  }

  const spaces = await db.category.findUniqueOrThrow({ where: { slug: "spaces" } });
  const spacesChildren = [
    { name: "Meeting rooms", slug: "spaces-meeting-rooms" },
    { name: "Studios", slug: "spaces-studios" },
    { name: "Commercial kitchens", slug: "spaces-kitchens" },
    { name: "Warehouses", slug: "spaces-warehouses" },
  ];
  for (const [i, child] of spacesChildren.entries()) {
    await db.category.upsert({
      where: { slug: child.slug },
      update: {},
      create: { name: child.name, slug: child.slug, parentId: spaces.id, sortOrder: i },
    });
  }

  const studios = await db.category.findUniqueOrThrow({ where: { slug: "spaces-studios" } });
  const studioAttrs: Array<{ key: string; label: string; type: "NUMBER" | "BOOLEAN" | "TEXT" }> = [
    { key: "capacity", label: "Capacity (people)", type: "NUMBER" },
    { key: "hasGenerator", label: "Backup power", type: "BOOLEAN" },
    { key: "soundproof", label: "Soundproof", type: "BOOLEAN" },
  ];
  for (const attr of studioAttrs) {
    await db.categoryAttribute.upsert({
      where: { categoryId_key: { categoryId: studios.id, key: attr.key } },
      update: {},
      create: { categoryId: studios.id, key: attr.key, label: attr.label, type: attr.type },
    });
  }

  // Phase 1 is single-currency/single-country (NGN/Nigeria — see
  // ARCHITECTURE.md §1), but the previous seed only had one row (Lagos,
  // Yaba), so every search outside that one neighborhood came back empty.
  // This widens coverage to Nigeria's major commercial hubs. Expanding
  // beyond Nigeria needs multi-currency + a payment provider per market
  // first, since pricing and Paystack are hard-wired to NGN today.
  const locations: { state: string; city: string; area: string }[] = [
    { state: "Lagos", city: "Lagos", area: "Yaba" },
    { state: "Lagos", city: "Lagos", area: "Lekki" },
    { state: "Lagos", city: "Lagos", area: "Victoria Island" },
    { state: "Lagos", city: "Lagos", area: "Ikeja" },
    { state: "Lagos", city: "Lagos", area: "Surulere" },
    { state: "FCT", city: "Abuja", area: "Wuse" },
    { state: "FCT", city: "Abuja", area: "Gwarinpa" },
    { state: "Rivers", city: "Port Harcourt", area: "GRA" },
    { state: "Oyo", city: "Ibadan", area: "Bodija" },
    { state: "Kano", city: "Kano", area: "Nassarawa" },
    { state: "Enugu", city: "Enugu", area: "Independence Layout" },
    { state: "Delta", city: "Asaba", area: "Okpanam Road" },
  ];
  for (const loc of locations) {
    const existing = await db.location.findFirst({
      where: { city: loc.city, area: loc.area },
    });
    if (!existing) {
      await db.location.create({
        data: { country: "Nigeria", state: loc.state, city: loc.city, area: loc.area },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
