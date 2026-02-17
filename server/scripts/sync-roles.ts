
import { PrismaClient } from '@prisma/client';
import { clerkClient } from '@clerk/clerk-sdk-node';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database...');
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users in database.`);

  for (const user of users) {
    if (!user.clerkId) {
      console.warn(`Skipping user ${user.id} (no clerkId)`);
      continue;
    }

    const role = user.role; // e.g. 'ADMIN' or 'USER'
    console.log(`Syncing user ${user.clerkId} with role ${role}...`);

    try {
      await clerkClient.users.updateUser(user.clerkId, {
        publicMetadata: {
          role: role.toLowerCase(), // 'admin' or 'user' for frontend check
        },
      });
      console.log(`✅ User ${user.clerkId} synced successfully.`);
    } catch (error) {
      console.error(`❌ Failed to sync user ${user.clerkId}:`, error);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
