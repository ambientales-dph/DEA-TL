import Image from 'next/image';
import { AuthForm } from '@/components/auth/auth-form';
import { Logo } from '@/components/icons/logo';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LoginPage() {
  const loginImage = PlaceHolderImages.find((p) => p.id === 'login-hero');

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="flex min-h-screen items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-4 text-center">
            <div className="flex justify-center items-center gap-2 mb-2">
              <Logo className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold font-headline">
                Trello AI Assistant
              </h1>
            </div>
            <p className="text-balance text-muted-foreground">
              Sign in to supercharge your Trello boards with AI
            </p>
          </div>
          <AuthForm />
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        {loginImage && (
          <Image
            src={loginImage.imageUrl}
            alt={loginImage.description}
            width="1920"
            height="1080"
            className="h-full max-h-screen w-full object-cover dark:brightness-[0.2] dark:grayscale"
            data-ai-hint={loginImage.imageHint}
            priority
          />
        )}
      </div>
    </div>
  );
}
