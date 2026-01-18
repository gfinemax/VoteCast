import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request) {
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api (API routes - keep them public or handle auth inside)
         * - projector (public projector display)
         * - checkin (public check-in page for now)
         */
        '/((?!_next/static|_next/image|favicon.ico|api|projector|checkin|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
