import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

function getValidCronSecret(): string | null {
  const secret = process.env.CRON_SECRET;

  if (secret === undefined) return null;

  const normalized = secret.trim().toLowerCase();
  if (normalized === '' || normalized === 'undefined' || normalized === 'null') {
    return null;
  }

  return secret;
}

function isInvalidBearerToken(token: string): boolean {
  const normalized = token.trim().toLowerCase();
  return normalized === '' || normalized === 'undefined' || normalized === 'null';
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function authorizeCronRequest(request: Request): NextResponse | null {
  const cronSecret = getValidCronSecret();

  if (cronSecret === null) {
    console.error('[CRON] CRON_SECRET is not configured.');
    return NextResponse.json({ error: 'Cron authentication is unavailable' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bearerToken = authHeader.slice('Bearer '.length);
  if (isInvalidBearerToken(bearerToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!constantTimeEqual(bearerToken, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
