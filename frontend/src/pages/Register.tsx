import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const schema = z.object({
  nombre: z.string().min(2, 'Nombre mínimo 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(12, 'Mínimo 12 caracteres')
    .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe tener al menos un número')
    .regex(/[!@#$%^&*]/, 'Debe tener al menos un símbolo (!@#$%^&*)'),
  confirmPassword: z.string()
}).refine(d => d.password === d.confirmPassword, { message: 'Las contraseñas no coinciden', path: ['confirmPassword'] });

type FormData = z.infer<typeof schema>;

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const password = watch('password', '');
  const passwordStrength = () => {
    let score = 0;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*]/.test(password)) score++;
    return score;
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await authAPI.register({ email: data.email, password: data.password, nombre: data.nombre });
      toast.success('Cuenta creada. Inicia sesión.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength();
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  const strengthLabels = ['Muy débil', 'Débil', 'Regular', 'Fuerte'];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">SB</span>
          </div>
          <h1 className="text-3xl font-bold text-white">SportBets<span className="text-indigo-400">AI</span></h1>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-white mb-6">Crear Cuenta</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre completo</label>
              <input {...register('nombre')} className="input-field" placeholder="Tu nombre" />
              {errors.nombre && <p className="text-red-400 text-xs mt-1">{errors.nombre.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input {...register('email')} type="email" className="input-field" placeholder="tu@email.com" />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="Mín. 12 chars, mayúsculas, números, símbolos"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i < strength ? strengthColors[strength-1] : 'bg-slate-700'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">{strength > 0 ? strengthLabels[strength-1] : ''}</p>
                </div>
              )}
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar contraseña</label>
              <input {...register('confirmPassword')} type="password" className="input-field" placeholder="Repite la contraseña" />
              {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <div className="text-xs text-slate-500 bg-slate-900/50 p-3 rounded-lg">
              Al registrarte aceptas los Términos de Uso y la Política de Privacidad. Las apuestas son solo para mayores de 18 años.
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-slate-400 text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Inicia sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
