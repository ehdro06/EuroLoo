import { Controller, Post, Req, Res, Headers, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { Webhook } from 'svix';
import { ConfigService } from '@nestjs/config';

@Controller('api/webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Post('clerk')
  async handleClerkWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('svix-id') svix_id: string,
    @Headers('svix-timestamp') svix_timestamp: string,
    @Headers('svix-signature') svix_signature: string,
  ) {
    // 1. Get Secret from Env
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      console.error('Missing CLERK_WEBHOOK_SECRET');
      return res.status(500).json({ error: 'Server config error' });
    }

    // 2. Verify Headers
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: 'Missing svix headers' });
    }

    // 3. Verify Payload    
    // Use rawBody buffer if available for signature verification, otherwise fallback to req.body string (less reliable)
    // NestJS rawBody returns a Buffer
    const payload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt: any;

    try {
      evt = wh.verify(payload, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return res.status(400).json({ error: 'Error occured' });
    }

    // 4. Handle Events
    const { id } = evt.data;
    const eventType = evt.type;
    console.log(`Webhook received: ${eventType} for user ${id}`);

    if (eventType === 'user.created' || eventType === 'user.updated') {
      const { id, email_addresses, username } = evt.data;
      const email = email_addresses[0]?.email_address;

      // Handle email collision: if email exists on a different clerkId (e.g. from a previous dev session),
      // update that record to the new clerkId instead of failing.
      if (email) {
        const existingUser = await this.prisma.user.findUnique({
          where: { email },
        });

        if (existingUser && existingUser.clerkId !== id) {
          console.log(`Merging user ${existingUser.clerkId} to new clerkId ${id}`);
          await this.prisma.user.update({
            where: { email },
            data: { clerkId: id },
          });
        }
      }

      await this.prisma.user.upsert({
        where: { clerkId: id },
        update: {
          email: email,
          username: username || email?.split('@')[0] || 'User',
        },
        create: {
          clerkId: id,
          email: email,
          username: username || email?.split('@')[0] || 'User',
          role: 'USER', // Default role
        },
      });
      console.log(`Synced user ${id} to DB`);
    } else if (eventType === 'user.deleted') {
      await this.prisma.user.delete({
        where: { clerkId: id },
      }).catch(err => console.log('User already deleted or not found'));
       console.log(`Deleted user ${id} from DB`);
    }

    return res.status(200).json({ success: true });
  }
}