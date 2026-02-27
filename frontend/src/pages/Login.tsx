import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';
import { FaEye, FaEyeSlash, FaLock, FaEnvelope } from 'react-icons/fa';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida')
});

const twoFASchema = z.object({
  token: z.string().length(6, 'Código de 6 dígitos')
});

type LoginForm = z.infer<typeof loginSchema>;
type TwoFAForm = z.infer<typeof twoFASchema>;

const Login: React.FC = () => {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [userId2FA, setUserId2FA] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const { register: register2FA, handleSubmit: handleSubmit2FA, formState: { errors: errors2FA } } = useForm<TwoFAForm>({
    resolver: zodResolver(twoFASchema)
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await authAPI.login(data);
      if (res.data.requiresTwoFactor) {
        setRequires2FA(true);
        setUserId2FA(res.data.userId);
        toast.success('Ingresa tu código 2FA');
        return;
      }
      const profileRes = await authAPI.getProfile();
      login(res.data, profileRes.data);
      toast.success(`¡Bienvenido, ${profileRes.data.nombre}!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error de inicio de sesión');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit2FA = async (data: TwoFAForm) => {
    setLoading(true);
    try {
      const res = await authAPI.login2FA({ userId: userId2FA, token: data.token });
      const profileRes = await authAPI.getProfile();
      login(res.data, profileRes.data);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">SB</span>
          </div>
          <h1 className="text-3xl font-bold text-white">SportBets<span className="text-indigo-400">AI</span></h1>
          <p className="text-slate-400 mt-2">Portal de Análisis de Apuestas Deportivas</p>
        </div>

        <div className="card">
          {!requires2FA ? (
            <>
              <h2 className="text-xl font-bold text-white mb-6">Iniciar Sesión</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <div className="relative">
                    <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                      {...register('email')}
                      type="email"
                      className="input-field pl-10"
                      placeholder="tu@email.com"
                    />
                  </div>
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
                  <div className="relative">
                    <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      className="input-field pl-10 pr-10"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                  {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <p className="text-slate-400 text-sm">
                  ¿No tienes cuenta?{' '}
                  <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
                    Regístrate
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Verificación 2FA</h2>
              <p className="text-slate-400 text-sm mb-6">Ingresa el código de tu aplicación autenticadora</p>
              <form onSubmit={handleSubmit2FA(onSubmit2FA)} className="space-y-4">
                <div>
                  <input
                    {...register2FA('token')}
                    type="text"
                    className="input-field text-center text-2xl font-mono tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                  />
                  {errors2FA.token && <p className="text-red-400 text-xs mt-1">{errors2FA.token.message}</p>}
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Verificando...' : 'Verificar'}
                </button>
                <button type="button" onClick={() => setRequires2FA(false)} className="btn-secondary w-full">
                  Volver
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
