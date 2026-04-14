import process from "node:process";

import { getFirebaseAdminFirestore } from "../apps/web/src/lib/firestore-admin";
import {
  buildFirestoreMigrationPlan,
  createMigrationParityReport,
  type FirestoreMigrationPlan
} from "../apps/web/src/lib/firestore-migration";
import { readNotionMigrationSource } from "../apps/web/src/lib/notion-migration-source";

type CliOptions = {
  dryRun: boolean;
  userId?: string;
};

function printUsage(): void {
  console.log("Usage: tsx scripts/migrate-notion-to-firestore.ts [--dry-run] [--user <legacyUserId>]");
}

function parseArgs(argv: string[]): CliOptions {
  let dryRun = false;
  let userId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--user") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value for --user");
      }
      userId = next;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    dryRun,
    ...(userId ? { userId } : {})
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function applyMigration(plan: FirestoreMigrationPlan): Promise<void> {
  const db = getFirebaseAdminFirestore();
  const writes = plan.users.flatMap((userPlan) => [userPlan.user, ...userPlan.writes]);

  for (const batchItems of chunk(writes, 400)) {
    const batch = db.batch();
    for (const write of batchItems) {
      batch.set(db.doc(write.path), write.data, { merge: write.merge });
    }
    await batch.commit();
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const migratedAt = new Date().toISOString();

  const source = await readNotionMigrationSource(options.userId);
  const plan = buildFirestoreMigrationPlan(source, { migratedAt });
  const report = createMigrationParityReport(source, plan);

  console.log(
    JSON.stringify(
      {
        mode: options.dryRun ? "dry-run" : "write",
        migratedAt,
        userFilter: options.userId ?? null,
        userCount: plan.users.length,
        writeCount: plan.writeCount,
        parity: report.totals
      },
      null,
      2
    )
  );

  if (options.dryRun) {
    return;
  }

  await applyMigration(plan);
  console.log(`Committed ${plan.writeCount} Firestore writes across ${plan.users.length} users.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
