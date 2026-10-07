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
// Mirrors the server's rule in models/User.js
const MIN_PASSWORD = 6;

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // An invite link sends visitors here first; return them to it afterwards
  const redirectTo = location.state?.from || '/dashboard';

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Tell your group what to call you.';
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < MIN_PASSWORD) next.password = `Use at least ${MIN_PASSWORD} characters.`;
    return next;
  };

  // Typing into a field clears its own error only
  const update = (setter, key) => (e) => {
    setter(e.target.value);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return shake(formRef.current);

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      toast.success('Account created. Welcome to Hive!');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(error.response?.data?.message || 'Registration failed. Please try again.');
      shake(formRef.current);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account."
      subtitle="It takes a minute. Then start a space and invite your group."
      aside="Bring the whole study group into one room."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-medium text-ink underline-offset-4 hover:text-flame hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="grid gap-6">
        <GoogleSignInButton redirectTo={redirectTo} text="signup_with" />

        <form ref={formRef} onSubmit={handleSignup} noValidate className="grid gap-5">
          <AuthField
            label="Full name"
            autoComplete="name"
            placeholder="Aarav Mehta"
            value={name}
            onChange={update(setName, 'name')}
            error={errors.name}
            disabled={loading}
          />
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
            autoComplete="new-password"
            value={password}
            onChange={update(setPassword, 'password')}
            error={errors.password}
            helper={`At least ${MIN_PASSWORD} characters.`}
            disabled={loading}
          />
          <FormAlert message={formError} />
          <SubmitButton loading={loading} loadingLabel="Creating your account…">
            Create account
          </SubmitButton>
        </form>
      </div>
    </AuthLayout>
  );
}
