import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/auth/AuthLayout';
import AuthField from '../components/auth/AuthField';
import { FormAlert, SubmitButton } from '../components/auth/AuthForm';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { shake } from '../components/landing/gsap';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // An invite link sends visitors here first; return them to it afterwards
  const redirectTo = location.state?.from || '/dashboard';

  const validate = () => {
    const next = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter the email you signed up with.';
    if (!password) next.password = 'Enter your password.';
    return next;
  };

  // Typing into a field clears its own error only
  const update = (setter, key) => (e) => {
    setter(e.target.value);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return shake(formRef.current);

    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success('Welcome back!');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(error.response?.data?.message || 'Login failed. Please try again.');
      shake(formRef.current);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to get back to your study spaces."
      aside="Pick up right where your group left off."
      footer={
        <>
          New to StudySync?{' '}
          <Link to="/signup" state={location.state} className="font-medium text-ink underline-offset-4 hover:text-flame hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className="grid gap-6">
        <GoogleSignInButton redirectTo={redirectTo} text="signin_with" />

        <form ref={formRef} onSubmit={handleLogin} noValidate className="grid gap-5">
          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@college.edu"
            value={email}
            onChange={update(setEmail, 'email')}
            error={errors.email}
            disabled={loading}
          />
          <AuthField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={update(setPassword, 'password')}
            error={errors.password}
            disabled={loading}
          />
          <FormAlert message={formError} />
          <SubmitButton loading={loading} loadingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </form>
      </div>
    </AuthLayout>
  );
}
