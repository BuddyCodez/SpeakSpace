'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

export function AuthModal() {
    const [isLogin, setIsLogin] = useState(true);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground">
                    {isLogin ? 'Login' : 'Register'}
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                {isLogin ? (
                    <LoginForm onSwitch={() => setIsLogin(false)} />
                ) : (
                    <RegisterForm onSwitch={() => setIsLogin(true)} />
                )}
            </DialogContent>
        </Dialog>
    );
}