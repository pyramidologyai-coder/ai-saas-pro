import { NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/googleCalendar';

export async function GET(req: Request) {
  // Check if there is a memberId or tenantId in the URL
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
  }

  // Generate the URL and pass state
  const stateString = memberId ? `${tenantId}|${memberId}` : tenantId;
  const url = getGoogleAuthUrl(stateString);

  // Redirect the user to Google
  return NextResponse.redirect(url);
}
