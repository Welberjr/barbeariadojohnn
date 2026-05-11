'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error('Credenciais inválidas. Tente novamente.');
        return;
      }

      toast.success('Bem-vindo de volta!');
      router.push('/admin');
      router.refresh();
    } catch {
      toast.error('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Email */}
      <div className="space-y-2">
        <label htmlFor="email" className="label flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-gold/70" />
          <span className="tracking-wider text-[11px] uppercase">E-mail</span>
        </label>
        <div className="relative group">
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            className="input pl-4 w-full transition-all"
            disabled={isLoading}
            {...register('email')}
          />
          {/* Highlight dourado sutil no focus */}
          <div className="absolute inset-0 rounded-md pointer-events-none border border-transparent group-focus-within:border-gold/40 transition-colors" />
        </div>
        {errors.email && (
          <p className="text-xs text-danger flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-danger" />
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Senha */}
      <div className="space-y-2">
        <label htmlFor="password" className="label flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-gold/70" />
          <span className="tracking-wider text-[11px] uppercase">Senha</span>
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            className="input pl-4 pr-12 w-full"
            disabled={isLoading}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-gold transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-danger flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-danger" />
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Botão principal - estilo "Entrar / Agendar" da imagem 1 */}
      <button
        type="submit"
        disabled={isLoading}
        className="btn-gold-shimmer w-full flex items-center justify-center gap-2.5 mt-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Entrando...</span>
          </>
        ) : (
          <>
            <LogIn className="w-5 h-5" />
            <span>Entrar</span>
          </>
        )}
      </button>
    </form>
  );
}
