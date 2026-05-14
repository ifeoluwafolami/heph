import { FireworksBackground } from '@/components/FireworksBackground';
import { Link, Navigate } from 'react-router-dom';
import { getAccessToken, getStoredUser } from '@/lib/api';

export default function Homepage() {
    const token = getAccessToken()
    const user = getStoredUser()

    if (token && user) {
        return <Navigate to="/dashboard" replace />
    }

    return (
        <div className="relative w-screen h-screen bg-claret text-pink">
            <FireworksBackground className="absolute inset-0" population={0.5} color="#FFBDC5" />
            <div className="relative z-10 flex items-center justify-center h-full">
                <div className='absolute top-4 right-4 md:top-10 md:right-10'>
                    <Link to='/login'>
                        <div className='inline-block font-pompiere text-xl tracking-widest hover:underline underline-offset-5 hover:scale-105 transition-transform duration-300 cursor-pointer'>LOGIN</div>
                    </Link>
                    
                </div>
                <h1 className="font-modern font-black text-7xl md:text-9xl">heph</h1>
            </div>
        </div>
    );
}