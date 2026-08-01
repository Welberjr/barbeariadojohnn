'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Smartphone, Lock, Eye, EyeOff, LogIn } from 'lucide-react';

import { entrarComoCliente } from '../actions';

// O cliente sabe o telefone dele de cor, e quase nunca lembra qual e-mail deu no
// cadastro. Entao a porta aceita os dois, e nao cobra formato de e-mail de quem
// digitou um numero.
const loginSchema = z.object({
  email: z.string().min(6, 'Informe seu telefone ou e-mail'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function CustomerLoginForm() {
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
      const res = await entrarComoCliente({
        identificador: data.email,
        senha: data.password,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success('Bem-vindo de volta!');
      // Cliente que so e cliente cai direto no /cliente. Quem tambem trabalha
      // aqui escolhe por onde entrar, em vez de ser jogado num lado so.
      router.push('/entrar');
      router.refresh();
    } catch {
      toast.error('Erro ao entrar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    // method="post" para a senha nunca ir pelo endereco caso o programa da
    // pagina nao rode. Ver o comentario igual no login da equipe.
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="label flex items-center gap-2">
          <Smartphone className="w-3.5 h-3.5 text-gold/70" />
          <span className="tracking-wider text-[11px] uppercase">Telefone ou e-mail</span>
        </label>
        <input
          id="email"
          type="text"
          inputMode="text"
          autoComplete="username"
          placeholder="(61) 99999-9999"
          className="input pl-4 w-full"
          disabled={isLoading}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-danger flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-danger" />
            {errors.email.message}
          </p>
        )}
      </div>

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

      <p className="text-[11px] text-fg-subtle text-center leading-relaxed">
        Primeiro acesso ou esqueceu a senha?
        <br />
        Fale com seu barbeiro que ele libera na hora.
      </p>
    </form>
  );
}
