'use client';
import { Button } from '@/components/ui/button';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { ChromeIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export function AuthForm() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  const handleSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      await signInWithPopup(auth, provider);
      router.push('/dashboard');
    } catch (error) {
      console.error('Error signing in with Google', error);
      toast({
        title: 'Authentication Error',
        description: 'Failed to sign in with Google. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button onClick={handleSignIn} className="w-full" variant="outline">
      <ChromeIcon className="mr-2 h-4 w-4" />
      Sign in with Google
    </Button>
  );
}
