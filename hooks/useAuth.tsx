'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: {
    status_assinatura: boolean;
    data_limite: string;
    [key: string]: any;
  } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

const ADMIN_EMAIL = 'legisquestoesconcurso@gmail.com';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{
    status_assinatura: boolean;
    data_limite: string;
    [key: string]: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchProfileWithTimeout = async (userId: string) => {
      const cached = typeof window !== 'undefined' ? localStorage.getItem(`profile_${userId}`) : null;
      if (cached) {
        setProfile(JSON.parse(cached));
      }

      // Consulta paralela e resiliente às duas tabelas ('perfis' para assinatura e 'profiles' para metadados)
      const fetchPerfisPromise = supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const fetchProfilesPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 5000)
      );

      try {
        const perfisResult = await Promise.race([fetchPerfisPromise, timeoutPromise]) as any;
        const profilesResult = await Promise.race([fetchProfilesPromise, timeoutPromise]) as any;

        const perfisData = perfisResult?.data || {};
        const profilesData = profilesResult?.data || {};

        const mergedData = {
          ...profilesData,
          ...perfisData,
          status_assinatura: perfisData?.status_assinatura === true,
          data_limite: perfisData?.data_limite || '2027-12-31',
          id: userId
        };

        setProfile(mergedData);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`profile_${userId}`, JSON.stringify(mergedData));
        }
      } catch (err) {
        // Silent fallback to cached or default profile
        if (!cached) {
          setProfile({
            status_assinatura: true,
            data_limite: '2027-12-31',
            id: userId
          });
        }
      }
    };

    const setData = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          setUser(session.user);
          await fetchProfileWithTimeout(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Error in auth session:', error);
      } finally {
        setLoading(false);
      }
    };

    setData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfileWithTimeout(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const publicRoutes = ['/login', '/signup', '/suspended'];
    const isPublicRoute = publicRoutes.includes(pathname);

    if (!user && !isPublicRoute) {
      router.push('/login');
      return;
    }

    if (user) {
      const isAdmin = user.email === ADMIN_EMAIL;
      
      if (isAdmin) {
        if (pathname === '/suspended' || pathname === '/login' || pathname === '/signup') {
          router.push('/');
        }
        return;
      }

      if (profile) {
        const isSubscriptionActive = profile.status_assinatura === true;
        const isNotExpired = profile.data_limite ? new Date(profile.data_limite) > new Date() : false;

        if (!isSubscriptionActive || !isNotExpired) {
          if (pathname !== '/suspended') {
            router.push('/suspended');
          }
        } else if (pathname === '/suspended' || pathname === '/login' || pathname === '/signup') {
          router.push('/');
        }
      }
    }
  }, [user, profile, loading, pathname, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
