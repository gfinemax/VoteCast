import { redirect } from 'next/navigation';
import LandingPageClient from '@/components/landing/LandingPageClient';
import { createClient } from '@/utils/supabase/server';

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <LandingPageClient initialUser={user} />;
}
