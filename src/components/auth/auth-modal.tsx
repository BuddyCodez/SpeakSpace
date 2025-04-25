'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';
import { Button } from '../ui/button';
interface AuthModalProps {
    onlyLogin?: boolean;
}
export function AuthModal({ onlyLogin = false }: AuthModalProps) {
    const [isLogin, setIsLogin] = useState(true);
    if (onlyLogin) {
        return <Dialog>
            <DialogTrigger asChild>
                <Button className="w-full" size="lg" onClick={() => setIsLogin(false)}>
                    Login
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                {isLogin ? (
                    <LoginForm onSwitch={() => setIsLogin(false)} />
                ) : (
                    <RegisterForm onSwitch={() => setIsLogin(true)} />
                )}
            </DialogContent>
        </Dialog>
    }
    return (
        <React.Fragment>
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full" size="lg" onClick={() => setIsLogin(true)}>
                        Sign Up
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    {isLogin ? (
                        <LoginForm onSwitch={() => setIsLogin(false)} />
                    ) : (
                        <RegisterForm onSwitch={() => setIsLogin(true)} />
                    )}
                </DialogContent>
            </Dialog>
            <Dialog>
                <DialogTrigger asChild>
                    <Button className="w-full" size="lg" onClick={() => setIsLogin(false)}>
                        Login
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    {isLogin ? (
                        <LoginForm onSwitch={() => setIsLogin(false)} />
                    ) : (
                        <RegisterForm onSwitch={() => setIsLogin(true)} />
                    )}
                </DialogContent>
            </Dialog>
        </React.Fragment>
    );
}