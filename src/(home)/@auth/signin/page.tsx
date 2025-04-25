import { redirect } from 'next/navigation';
import { AuthModal } from '~/components/auth/auth-modal';

export default function SignInModal() {
    return <AuthModal />;
}